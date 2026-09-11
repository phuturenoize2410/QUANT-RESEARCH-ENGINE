import type { StockData } from '../src/types';
import { MockBrokerDataProvider, MockMarketDataProvider } from '../src/engine/dataProviders';

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

await assertEmptyProviderIsDegraded('market adapter', new MockMarketDataProvider());
await assertEmptyProviderIsDegraded('broker adapter', new MockBrokerDataProvider());

// Health only depends on adapter load state here; the sentinel is intentionally
// not consumed as market data. This keeps the smoke focused on provider status.
const loadedSentinel = {} as StockData;
const marketProvider = new MockMarketDataProvider([loadedSentinel]);
const brokerProvider = new MockBrokerDataProvider([loadedSentinel]);

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

marketProvider.setUniverse([]);
brokerProvider.setUniverse([]);
await assertEmptyProviderIsDegraded('market adapter after clear', marketProvider);
await assertEmptyProviderIsDegraded('broker adapter after clear', brokerProvider);

console.log('Provider-adapter smoke passed: mock providers report DEGRADED until simulated data is loaded and clear successful-sync state when their universe is emptied.');
