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

// Health only depends on adapter load state here; the sentinel is intentionally
// not consumed as market data. This keeps the smoke focused on provider status.
const loadedSentinel = { ticker: 'TEST' } as StockData;
const initialUniverse = [loadedSentinel];
const marketProvider = new MockMarketDataProvider(initialUniverse);
const brokerProvider = new MockBrokerDataProvider(initialUniverse);

// Provider state must not be mutable through an input array after construction.
initialUniverse.length = 0;
if ((await marketProvider.getHealth()).status !== 'HEALTHY') {
  throw new Error('market adapter: constructor input mutation must not clear provider-owned universe state.');
}
if ((await brokerProvider.getHealth()).status !== 'HEALTHY') {
  throw new Error('broker adapter: constructor input mutation must not clear provider-owned universe state.');
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

// Missing ticker data must fail explicitly rather than silently becoming [] or 0.
await assertMissingDataFailsExplicitly(
  'market quote',
  () => marketProvider.getQuote('MISSING'),
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

// Market consumers receive a snapshot array, not the provider's cache object.
const marketUniverseSnapshot = await marketProvider.getUniverse();
marketUniverseSnapshot.length = 0;
const secondMarketSnapshot = await marketProvider.getUniverse();
if (secondMarketSnapshot.length !== 1) {
  throw new Error('market adapter: getUniverse() consumer mutation must not alter provider-owned cache.');
}
if ((await marketProvider.getHealth()).status !== 'HEALTHY') {
  throw new Error('market adapter: consumer snapshot mutation must not affect provider health.');
}

const replacementUniverse = [loadedSentinel];
marketProvider.setUniverse(replacementUniverse);
brokerProvider.setUniverse(replacementUniverse);
replacementUniverse.length = 0;
if ((await marketProvider.getUniverse()).length !== 1) {
  throw new Error('market adapter: setUniverse() must copy its input before storing it.');
}
if ((await brokerProvider.getHealth()).status !== 'HEALTHY') {
  throw new Error('broker adapter: setUniverse() input mutation must not alter provider-owned state.');
}

marketProvider.setUniverse([]);
brokerProvider.setUniverse([]);
await assertEmptyProviderIsDegraded('market adapter after clear', marketProvider);
await assertEmptyProviderIsDegraded('broker adapter after clear', brokerProvider);

console.log('Provider-adapter smoke passed: mock providers own their universe snapshots, report DEGRADED until simulated data is loaded, fail explicitly on missing ticker data, and clear successful-sync state when emptied.');