import assert from 'node:assert/strict';
import { buildUniverse } from '../src/data/mockStocks';
import { DEFAULT_STRATEGY_SETTINGS } from '../src/engine/analytics';
import { MarketAdapter } from '../src/engine/market/marketAdapter';
import { ResearchApplicationService } from '../src/engine/researchApplication';
import { createPrototypeResearchPipeline, ResearchPipeline } from '../src/engine/researchPipeline';

const basePipeline = createPrototypeResearchPipeline();

const oneShareUsdMarket: MarketAdapter = {
  identity: {
    marketId: 'TEST-US',
    currency: 'USD',
    timezone: 'America/New_York',
    timezoneLabel: 'ET',
  },
  microstructure: {
    sharesPerLot: () => 1,
  },
};

// Keep provider/refresh behavior delegated to the existing prototype pipeline,
// while overriding only the execution market exposed through the application
// boundary. This isolates the contract under test: UI intent must inherit the
// active pipeline market rather than falling back to IDX defaults.
const marketBoundPipeline: ResearchPipeline = {
  refresh: settings => basePipeline.refresh(settings),
  getProvider: () => basePipeline.getProvider(),
  getMarket: () => oneShareUsdMarket,
};

const service = new ResearchApplicationService(marketBoundPipeline);
const stock = buildUniverse()[0];
assert.ok(stock, 'prototype universe should provide a stock fixture');

const defaultSettings = service.getDefaultStrategySettings();
assert.deepEqual(defaultSettings, DEFAULT_STRATEGY_SETTINGS);
assert.notEqual(
  defaultSettings,
  DEFAULT_STRATEGY_SETTINGS,
  'application boundary must return a defensive default-settings copy',
);
defaultSettings.buyFeePct = 99;
assert.equal(
  service.getDefaultStrategySettings().buyFeePct,
  DEFAULT_STRATEGY_SETTINGS.buyFeePct,
  'UI edits must not mutate canonical strategy defaults',
);

const executionSettings = service.getDefaultStrategySettings();
assert.equal(
  service.calculateExecutionFrictionPct(executionSettings),
  executionSettings.buyFeePct + executionSettings.sellFeePct + executionSettings.slippagePct,
  'execution friction shown in UI must come from canonical execution policy',
);
const parsedExecutionSettings = service.applyExecutionCostInput(
  executionSettings,
  'slippagePct',
  '0.12',
);
assert.equal(parsedExecutionSettings.slippagePct, 0.12);
assert.equal(
  executionSettings.slippagePct,
  DEFAULT_STRATEGY_SETTINGS.slippagePct,
  'execution input parsing must not mutate the caller settings object',
);
const fallbackExecutionSettings = service.applyExecutionCostInput(
  executionSettings,
  'buyFeePct',
  'not-a-number',
);
assert.equal(
  fallbackExecutionSettings.buyFeePct,
  DEFAULT_STRATEGY_SETTINGS.buyFeePct,
  'invalid execution-cost input must fail back to the canonical default',
);
const negativeExecutionSettings = service.applyExecutionCostInput(
  executionSettings,
  'sellFeePct',
  '-1',
);
assert.equal(
  negativeExecutionSettings.sellFeePct,
  DEFAULT_STRATEGY_SETTINGS.sellFeePct,
  'negative execution-cost input must fail back through canonical execution policy',
);
const oversizedExecutionSettings = service.applyExecutionCostInput(
  executionSettings,
  'slippagePct',
  '150',
);
assert.equal(
  oversizedExecutionSettings.slippagePct,
  DEFAULT_STRATEGY_SETTINGS.slippagePct,
  'execution-cost input above the canonical percentage domain must fail back to policy default',
);

const snapshot = await service.refresh(DEFAULT_STRATEGY_SETTINGS);
assert.equal(
  snapshot.providerHealth.status,
  'HEALTHY',
  'prototype snapshot health must describe the seeded provider state that supplied its universe',
);
assert.ok(
  snapshot.providerHealth.lastSuccessfulSyncAt,
  'prototype snapshot should expose the successful mock-universe refresh timestamp',
);
assert.equal(
  snapshot.providerReadiness.EOD_RESEARCH.allowed,
  true,
  'seeded prototype provider should remain eligible for explicitly simulated EOD research',
);
assert.equal(
  snapshot.providerReadiness.EOD_RESEARCH.warnings.some(warning => /degraded/i.test(warning)),
  false,
  'post-refresh readiness must not carry a stale degraded warning from the pre-seed provider state',
);

const decisionEvaluation = service.evaluateDecisionCandidate(
  stock,
  snapshot.featureContext,
);

assert.equal(decisionEvaluation.ensemble.ticker, stock.ticker);
assert.equal(decisionEvaluation.overnightML.ticker, stock.ticker);
assert.equal(decisionEvaluation.gapRisk.ticker, stock.ticker);
assert.equal(decisionEvaluation.overnightML.explanation.isSimulated, true);
assert.equal(
  decisionEvaluation.ensemble.mlProbability,
  decisionEvaluation.overnightML.probNetPositiveOpen,
  'ensemble and detail model must share the same point-in-time feature context',
);

const journalSeed = service.getMorningJournalSeed();
assert.equal(journalSeed.provenance.source, 'PROTOTYPE_SIMULATION');
assert.equal(journalSeed.provenance.isLiveTradingEvidence, false);
assert.equal(journalSeed.provenance.isBacktestEvidence, false);
assert.ok(journalSeed.positions.length > 0, 'prototype journal should expose demonstration rows');

const secondJournalSeed = service.getMorningJournalSeed();
assert.notEqual(
  journalSeed.positions,
  secondJournalSeed.positions,
  'application boundary must return a defensive journal-array copy',
);
assert.notEqual(
  journalSeed.positions[0],
  secondJournalSeed.positions[0],
  'application boundary must return defensive position copies',
);
const canonicalTicker = secondJournalSeed.positions[0]?.ticker;
if (journalSeed.positions[0]) journalSeed.positions[0].ticker = 'MUTATED';
assert.equal(
  service.getMorningJournalSeed().positions[0]?.ticker,
  canonicalTicker,
  'UI journal edits must not mutate the canonical prototype fixture',
);

const edgeCatalog = service.getStrategyLabCatalog('edge');
assert.equal(edgeCatalog.provenance.isBacktestEvidence, false);
assert.equal(edgeCatalog.provenance.mode, 'PROTOTYPE_SIMULATION');
assert.ok(edgeCatalog.combinations.length > 1);
assert.ok(
  edgeCatalog.combinations[0].riskAdjustedEdgeScore >= edgeCatalog.combinations[1].riskAdjustedEdgeScore,
  'application boundary should rank Strategy Lab rows by risk-adjusted edge',
);

const safestGapCatalog = service.getStrategyLabCatalog('lowestBadGap');
assert.ok(
  safestGapCatalog.combinations[0].badGapProb <= safestGapCatalog.combinations[1].badGapProb,
  'application boundary should own bad-gap ranking',
);

const institutionalFlowCatalog = service.getStrategyLabCatalog('winRate', 'Institutional Flow');
assert.ok(institutionalFlowCatalog.combinations.length > 0);
assert.ok(
  institutionalFlowCatalog.combinations.every(combo => combo.category === 'Institutional Flow'),
  'application boundary should own Strategy Lab category filtering',
);

const lots = 2;
const strategyPosition = service.buildStrategyJournalPosition(
  stock,
  DEFAULT_STRATEGY_SETTINGS,
  lots,
);

assert.equal(strategyPosition.currency, 'USD');
assert.equal(strategyPosition.totalCost, stock.price * lots);
assert.match(strategyPosition.purchaseDate, /ET$/);

const manualPosition = service.buildManualJournalPosition(
  {
    ticker: stock.ticker,
    entryPrice: stock.price,
    lots,
  },
  stock,
  DEFAULT_STRATEGY_SETTINGS,
);

assert.equal(manualPosition.currency, 'USD');
assert.equal(manualPosition.totalCost, stock.price * lots);
assert.match(manualPosition.purchaseDate, /ET$/);
assert.match(manualPosition.id, /^pos-/);
assert.match(manualPosition.notes, /simulated/i);

console.log('Research application boundary smoke checks passed.');
