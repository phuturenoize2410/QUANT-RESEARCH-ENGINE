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

const snapshot = await service.refresh(DEFAULT_STRATEGY_SETTINGS);
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
