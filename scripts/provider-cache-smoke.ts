import type { StockData } from '../src/types';
import { MockMarketDataProvider } from '../src/engine/dataProviders';
import { CachedMarketDataProvider } from '../src/engine/providerCache';

const sentinel = {
  ticker: 'CACHE',
  price: 100,
  change: 1,
  changePct: 1,
  volume: 1000,
  turnover: 100000,
  historicalBars: [
    { date: '2026-09-15', open: 99, high: 101, low: 98, close: 100, volume: 1000, turnover: 100000 },
  ],
  technical: { rsi14: 50 },
  bandarmology: {
    netForeignFlow: 123,
    topBuyers: [{ brokerCode: 'AA', brokerName: 'Alpha' }],
    topSellers: [{ brokerCode: 'BB', brokerName: 'Beta' }],
  },
  historicalStats: { matchedTrades: [{ date: '2026-09-14', gapPct: 0.5 }] },
  prefilterFailReasons: ['NONE'],
  positiveFactors: ['A'],
  riskFactors: ['B'],
} as unknown as StockData;

const provider = new CachedMarketDataProvider(new MockMarketDataProvider([sentinel]));
const first = await provider.getUniverse();
first[0].historicalBars[0].close = 777;
first[0].bandarmology.topBuyers[0].brokerCode = 'MUTATED';
first[0].historicalStats.matchedTrades[0].gapPct = 99;
first[0].positiveFactors[0] = 'MUTATED';

const second = await provider.getUniverse();
if (second[0].historicalBars[0].close !== 100) {
  throw new Error('cached provider universe must detach nested historical bars from consumers.');
}
if (second[0].bandarmology.topBuyers[0].brokerCode !== 'AA') {
  throw new Error('cached provider universe must detach nested broker-flow records from consumers.');
}
if (second[0].historicalStats.matchedTrades[0].gapPct !== 0.5) {
  throw new Error('cached provider universe must detach nested historical statistics from consumers.');
}
if (second[0].positiveFactors[0] !== 'A') {
  throw new Error('cached provider universe must detach nested factor arrays from consumers.');
}

const snapshot = provider.getCacheSnapshot();
if (!snapshot.universeCached || snapshot.stats.hits < 1) {
  throw new Error('ownership isolation must preserve normal cache-hit behavior.');
}

console.log('Provider-cache smoke passed: cached universe records retain provider ownership across nested consumer mutations without disabling cache hits.');
