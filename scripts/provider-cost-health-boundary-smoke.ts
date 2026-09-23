import { MockMarketDataProvider, type ProviderHealth } from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';

const nowMs = Date.parse('2026-09-23T04:00:00.000Z');
const healthy: ProviderHealth = {
  status: 'HEALTHY',
  checkedAt: '2026-09-23T04:00:00.000Z',
};

for (const source of ['MOCK_ENGINE', 'GOOGLE_FINANCE', 'FREE_API'] as const) {
  const provider = new MockMarketDataProvider();
  const metadata = provider.metadata as unknown as {
    source: typeof source;
    mode: 'MOCK' | 'EOD';
    isPaid: boolean;
    supportsRealtime: boolean;
  };
  metadata.source = source;
  metadata.mode = source === 'MOCK_ENGINE' ? 'MOCK' : 'EOD';
  metadata.isPaid = true;
  metadata.supportsRealtime = false;

  const snapshot = await getProviderHealthSnapshot(provider, healthy, nowMs);
  if (snapshot.health.status !== 'UNAVAILABLE') {
    throw new Error(`${source} marked paid must fail closed at the provider-health boundary.`);
  }
  if (!snapshot.health.message?.includes('source/isPaid')) {
    throw new Error(`${source} cost-semantic failure must expose source/isPaid context.`);
  }
  if (snapshot.metadata.isPaid !== false || snapshot.metadata.supportsHistorical !== false) {
    throw new Error(`${source} malformed cost metadata must be sanitized before downstream use.`);
  }
}

console.log('Provider cost/health boundary smoke passed: inherently-free sources cannot be marked paid, fail closed as UNAVAILABLE, expose source/isPaid context, and sanitize capabilities before downstream use.');
