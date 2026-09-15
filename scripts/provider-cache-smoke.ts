import type { StockData } from '../src/types';
import { MockMarketDataProvider, ProviderRequestError } from '../src/engine/dataProviders';
import { CachedMarketDataProvider, ProviderCachePolicyError } from '../src/engine/providerCache';

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

const delegate = new MockMarketDataProvider([sentinel]);
for (const [field, value] of [
  ['quoteTtlMs', -1],
  ['dailyBarsTtlMs', Number.NaN],
  ['universeTtlMs', Number.POSITIVE_INFINITY],
] as const) {
  try {
    new CachedMarketDataProvider(delegate, { [field]: value });
    throw new Error(`cached provider accepted malformed ${field}.`);
  } catch (error) {
    if (!(error instanceof ProviderCachePolicyError) || error.field !== field) throw error;
  }
}

const provider = new CachedMarketDataProvider(delegate);
const cachedProviderId = provider.metadata.id;
const cachedSupportedMarkets = [...provider.metadata.supportedMarkets];
const delegateMetadata = delegate.metadata as unknown as { id: string; supportedMarkets: string[] };
delegateMetadata.id = 'MUTATED_PROVIDER';
delegateMetadata.supportedMarkets.push('US');
if (provider.metadata.id !== cachedProviderId) {
  throw new Error('cached provider metadata identity must be detached from delegate mutation.');
}
if (provider.metadata.supportedMarkets.join(',') !== cachedSupportedMarkets.join(',')) {
  throw new Error('cached provider supported markets must be detached from delegate mutation.');
}
if (!Object.isFrozen(provider.metadata) || !Object.isFrozen(provider.metadata.supportedMarkets)) {
  throw new Error('cached provider metadata snapshot must be immutable.');
}

const health = await provider.getHealth();
if (!Object.isFrozen(health)) {
  throw new Error('cached provider health snapshot must be immutable at the wrapper boundary.');
}

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

for (const malformedTicker of ['', '   ']) {
  try {
    await provider.getQuote(malformedTicker);
    throw new Error('cached quote boundary accepted malformed ticker identity.');
  } catch (error) {
    if (!(error instanceof ProviderRequestError) || error.field !== 'ticker') throw error;
  }
}

for (const malformedLimit of [0, -1, 1.5, Number.NaN]) {
  try {
    await provider.getDailyBars('CACHE', malformedLimit);
    throw new Error('cached daily-bar boundary accepted malformed limit.');
  } catch (error) {
    if (!(error instanceof ProviderRequestError) || error.field !== 'limit') throw error;
  }
}

const snapshot = provider.getCacheSnapshot();
if (!snapshot.universeCached || snapshot.stats.hits < 1) {
  throw new Error('ownership isolation must preserve normal cache-hit behavior.');
}
if (snapshot.quoteEntries !== 0 || snapshot.dailyBarEntries !== 0) {
  throw new Error('invalid provider requests must fail before polluting cache identity/state.');
}
if (!Object.isFrozen(snapshot) || !Object.isFrozen(snapshot.policy) || !Object.isFrozen(snapshot.stats)) {
  throw new Error('provider cache evidence must be immutable at the observation boundary.');
}
const capturedHits = snapshot.stats.hits;
await provider.getUniverse();
if (snapshot.stats.hits !== capturedHits) {
  throw new Error('provider cache evidence must remain point-in-time after later cache activity.');
}

const coverageProvider = new CachedMarketDataProvider(new MockMarketDataProvider([sentinel]));
await coverageProvider.getDailyBars('CACHE', 1);
const beforeCoverageExpansion = coverageProvider.getCacheSnapshot();
await coverageProvider.getDailyBars('CACHE', 2);
const afterCoverageExpansion = coverageProvider.getCacheSnapshot();
if (afterCoverageExpansion.stats.hits !== beforeCoverageExpansion.stats.hits) {
  throw new Error('insufficient daily-bar cache coverage must not be classified as a cache hit.');
}
if (afterCoverageExpansion.stats.misses !== beforeCoverageExpansion.stats.misses + 1) {
  throw new Error('insufficient daily-bar cache coverage must be classified as a cache miss before refetch.');
}
if (afterCoverageExpansion.stats.writes !== beforeCoverageExpansion.stats.writes + 1) {
  throw new Error('insufficient daily-bar cache coverage must refetch and replace cached evidence.');
}

const immediateExpiryProvider = new CachedMarketDataProvider(
  new MockMarketDataProvider([sentinel]),
  { quoteTtlMs: 0, dailyBarsTtlMs: 0, universeTtlMs: 0 },
);
await immediateExpiryProvider.getQuote('CACHE');
await immediateExpiryProvider.getDailyBars('CACHE', 1);
await immediateExpiryProvider.getUniverse();
// A second read must evict each expired entry before delegating and writing its replacement.
await immediateExpiryProvider.getQuote('CACHE');
await immediateExpiryProvider.getDailyBars('CACHE', 1);
await immediateExpiryProvider.getUniverse();
const expiredSnapshot = immediateExpiryProvider.getCacheSnapshot();
if (expiredSnapshot.quoteEntries !== 0 || expiredSnapshot.dailyBarEntries !== 0 || expiredSnapshot.universeCached) {
  throw new Error('provider cache evidence must exclude entries whose TTL has already expired.');
}
if (expiredSnapshot.oldestEntryAt !== undefined || expiredSnapshot.newestEntryAt !== undefined) {
  throw new Error('provider cache evidence timestamps must describe only live cache entries.');
}
if (expiredSnapshot.stats.evictions !== 6) {
  throw new Error(`expired provider entries must be evicted on read and observation boundaries; received ${expiredSnapshot.stats.evictions}.`);
}

console.log('Provider-cache smoke passed: metadata/health/cache ownership, request-coverage semantics, read-time expiry eviction, and immutable live-cache evidence are isolated; policy/request boundaries fail closed.');
