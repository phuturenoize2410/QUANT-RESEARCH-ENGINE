import type { StockData } from '../src/types';
import {
  MockBrokerDataProvider,
  MockMarketDataProvider,
  ProviderDataError,
} from '../src/engine/dataProviders';

async function assertEmptyProviderIsDegraded(
  name: string,
  provider: MockMarketDataProvider | MockBrokerDataProvider,
) {
  const health = await provider.getHealth();

  if (health.status !== 'DEGRADED') {
    throw new Error(`${name}: empty mock provider must be DEGRADED, got ${health.status}.`);
  }
  if (health.lastSuccessfulSyncAt !== undefined) {
    throw new Error(`${name}: empty mock provider must not report a successful sync timestamp.`);
  }
  if (!health.message?.includes('no simulated universe is loaded')) {
    throw new Error(`${name}: degraded health must explain that no simulated universe is loaded.`);
  }
}

async function assertMissingDataFailsExplicitly(
  name: string,
  action: () => Promise<unknown>,
  providerId: string,
  ticker: string,
) {
  try {
    await action();
    throw new Error(`${name}: missing provider data must not be represented as valid empty/zero data.`);
  } catch (error) {
    if (!(error instanceof ProviderDataError)) {
      throw new Error(`${name}: expected ProviderDataError for missing ticker data.`);
    }
    if (error.providerId !== providerId || error.ticker !== ticker) {
      throw new Error(`${name}: ProviderDataError must preserve provider and ticker identity.`);
    }
  }
}

await assertEmptyProviderIsDegraded('market adapter', new MockMarketDataProvider());
await assertEmptyProviderIsDegraded('broker adapter', new MockBrokerDataProvider());

// This deliberately minimal sentinel contains every nested mutable structure used
// by this smoke test. It is cast to StockData because provider snapshot ownership,
// not domain-value completeness, is the contract under test here.
const loadedSentinel = {
  ticker: 'TEST',
  price: 100,
  change: 1,
  changePct: 1,
  volume: 1000,
  turnover: 100000,
  historicalBars: [
    { date: '2026-09-11', open: 99, high: 101, low: 98, close: 100, volume: 1000, turnover: 100000 },
  ],
  technical: { rsi14: 50 },
  bandarmology: {
    netForeignFlow: 123,
    topBuyers: [{ brokerCode: 'AA', brokerName: 'Alpha' }],
    topSellers: [{ brokerCode: 'BB', brokerName: 'Beta' }],
  },
  historicalStats: {
    matchedTrades: [{ date: '2026-09-10', gapPct: 0.5 }],
  },
  prefilterFailReasons: ['NONE'],
  positiveFactors: ['A'],
  riskFactors: ['B'],
} as unknown as StockData;

const initialUniverse = [loadedSentinel];
const marketProvider = new MockMarketDataProvider(initialUniverse);
const brokerProvider = new MockBrokerDataProvider(initialUniverse);

// Provider state must not be mutable through the input array or nested input records
// after construction.
initialUniverse.length = 0;
loadedSentinel.historicalBars[0].close = 999;
loadedSentinel.bandarmology.topBuyers[0].brokerCode = 'MUTATED';
loadedSentinel.positiveFactors[0] = 'MUTATED';

const constructorSnapshot = await marketProvider.getUniverse();
if (constructorSnapshot[0].historicalBars[0].close !== 100) {
  throw new Error('market adapter: constructor must snapshot nested historical bars.');
}
if (constructorSnapshot[0].bandarmology.topBuyers[0].brokerCode !== 'AA') {
  throw new Error('market adapter: constructor must snapshot nested broker-flow records.');
}
if (constructorSnapshot[0].positiveFactors[0] !== 'A') {
  throw new Error('market adapter: constructor must snapshot nested factor arrays.');
}

for (const [name, provider] of [
  ['market adapter', marketProvider],
  ['broker adapter', brokerProvider],
] as const) {
  const health = await provider.getHealth();
  if (health.status !== 'HEALTHY') {
    throw new Error(`${name}: loaded mock provider should be HEALTHY, got ${health.status}.`);
  }
  if (!health.lastSuccessfulSyncAt) {
    throw new Error(`${name}: loaded mock provider must report its successful load timestamp.`);
  }
}

// Provider requests use the same canonical symbol normalization as instrument identity.
// Future adapters can therefore map provider-specific symbols without leaking casing or
// whitespace differences into feature/strategy consumers.
const normalizedQuote = await marketProvider.getQuote('  test  ');
if (normalizedQuote.ticker !== 'TEST' || normalizedQuote.price !== 100) {
  throw new Error('market adapter: quote lookup must canonicalize symbol identity.');
}
if ((await marketProvider.getDailyBars(' test ')).length !== 1) {
  throw new Error('market adapter: daily-bar lookup must canonicalize symbol identity.');
}
if ((await brokerProvider.getBrokerSummary(' test ')).netForeignFlow !== 123) {
  throw new Error('broker adapter: broker-summary lookup must canonicalize symbol identity.');
}
if ((await brokerProvider.getNetForeignFlow(' test ')) !== 123) {
  throw new Error('broker adapter: foreign-flow lookup must canonicalize symbol identity.');
}

// Missing ticker data must fail explicitly rather than silently becoming [] or 0.
await assertMissingDataFailsExplicitly(
  'market quote',
  () => marketProvider.getQuote(' missing '),
  marketProvider.metadata.id,
  'MISSING',
);
await assertMissingDataFailsExplicitly(
  'daily bars',
  () => marketProvider.getDailyBars('MISSING'),
  marketProvider.metadata.id,
  'MISSING',
);
await assertMissingDataFailsExplicitly(
  'broker summary',
  () => brokerProvider.getBrokerSummary('MISSING'),
  brokerProvider.metadata.id,
  'MISSING',
);
await assertMissingDataFailsExplicitly(
  'foreign flow',
  () => brokerProvider.getNetForeignFlow('MISSING'),
  brokerProvider.metadata.id,
  'MISSING',
);

// Market consumers receive detached nested snapshots, not references into the
// provider-owned cache.
const marketUniverseSnapshot = await marketProvider.getUniverse();
marketUniverseSnapshot.length = 0;
const secondMarketSnapshot = await marketProvider.getUniverse();
if (secondMarketSnapshot.length !== 1) {
  throw new Error('market adapter: getUniverse() consumer mutation must not alter provider-owned cache.');
}
secondMarketSnapshot[0].historicalBars[0].close = 777;
secondMarketSnapshot[0].bandarmology.topBuyers[0].brokerCode = 'CHANGED';
secondMarketSnapshot[0].historicalStats.matchedTrades[0].gapPct = 99;
secondMarketSnapshot[0].prefilterFailReasons[0] = 'CHANGED';
if ((await marketProvider.getUniverse())[0].historicalBars[0].close !== 100) {
  throw new Error('market adapter: nested universe snapshot mutation must not alter cached bars.');
}
if ((await marketProvider.getUniverse())[0].bandarmology.topBuyers[0].brokerCode !== 'AA') {
  throw new Error('market adapter: nested universe snapshot mutation must not alter cached broker flow.');
}
if ((await marketProvider.getUniverse())[0].historicalStats.matchedTrades[0].gapPct !== 0.5) {
  throw new Error('market adapter: nested universe snapshot mutation must not alter cached historical stats.');
}
if ((await marketProvider.getUniverse())[0].prefilterFailReasons[0] !== 'NONE') {
  throw new Error('market adapter: nested universe snapshot mutation must not alter cached reason arrays.');
}
if ((await marketProvider.getHealth()).status !== 'HEALTHY') {
  throw new Error('market adapter: consumer snapshot mutation must not affect provider health.');
}

const bars = await marketProvider.getDailyBars('TEST');
bars[0].close = 555;
if ((await marketProvider.getDailyBars('TEST'))[0].close !== 100) {
  throw new Error('market adapter: getDailyBars() must return detached bar snapshots.');
}

const brokerSummary = await brokerProvider.getBrokerSummary('TEST');
brokerSummary.topBuyers[0].brokerCode = 'CHANGED';
if ((await brokerProvider.getBrokerSummary('TEST')).topBuyers[0].brokerCode !== 'AA') {
  throw new Error('broker adapter: getBrokerSummary() must return a detached broker-flow snapshot.');
}

const replacementSentinel = {
  ...loadedSentinel,
  historicalBars: [
    { date: '2026-09-11', open: 99, high: 101, low: 98, close: 100, volume: 1000, turnover: 100000 },
  ],
  bandarmology: {
    ...loadedSentinel.bandarmology,
    topBuyers: [{ ...loadedSentinel.bandarmology.topBuyers[0], brokerCode: 'AA' }],
    topSellers: [{ ...loadedSentinel.bandarmology.topSellers[0], brokerCode: 'BB' }],
  },
  historicalStats: {
    ...loadedSentinel.historicalStats,
    matchedTrades: [{ ...loadedSentinel.historicalStats.matchedTrades[0], gapPct: 0.5 }],
  },
  prefilterFailReasons: ['NONE'],
  positiveFactors: ['A'],
  riskFactors: ['B'],
} as StockData;
const replacementUniverse = [replacementSentinel];
marketProvider.setUniverse(replacementUniverse);
brokerProvider.setUniverse(replacementUniverse);
replacementUniverse.length = 0;
replacementSentinel.historicalBars[0].close = 888;
replacementSentinel.bandarmology.topBuyers[0].brokerCode = 'MUTATED';
if ((await marketProvider.getUniverse())[0].historicalBars[0].close !== 100) {
  throw new Error('market adapter: setUniverse() must snapshot nested input records before storing them.');
}
if ((await brokerProvider.getBrokerSummary('TEST')).topBuyers[0].brokerCode !== 'AA') {
  throw new Error('broker adapter: setUniverse() must snapshot nested broker-flow input before storing it.');
}

marketProvider.setUniverse([]);
brokerProvider.setUniverse([]);
await assertEmptyProviderIsDegraded('market adapter after clear', marketProvider);
await assertEmptyProviderIsDegraded('broker adapter after clear', brokerProvider);

console.log('Provider-adapter smoke passed: mock providers use canonical instrument symbols, own detached nested universe snapshots, report DEGRADED until simulated data is loaded, fail explicitly on missing ticker data, and clear successful-sync state when emptied.');
