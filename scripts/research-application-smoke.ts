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
