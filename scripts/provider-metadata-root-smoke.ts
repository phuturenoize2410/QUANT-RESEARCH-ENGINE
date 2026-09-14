import type {
  HealthCheckedProvider,
  ProviderHealth,
} from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';

const nowMs = Date.parse('2026-09-14T05:00:00.000Z');
const healthy: ProviderHealth = {
  status: 'HEALTHY',
  checkedAt: '2026-09-14T05:00:00.000Z',
};

function malformedProvider(metadata: unknown): HealthCheckedProvider {
  return {
    metadata,
    async getHealth() {
      return healthy;
    },
  } as unknown as HealthCheckedProvider;
}

for (const metadata of [null, [], 'not-metadata']) {
  const snapshot = await getProviderHealthSnapshot(
    malformedProvider(metadata),
    healthy,
    nowMs,
  );

  if (snapshot.health.status !== 'UNAVAILABLE') {
    throw new Error('malformed provider metadata roots must fail closed as UNAVAILABLE.');
  }
  if (!snapshot.health.message?.includes('metadata')) {
    throw new Error('malformed provider metadata roots must retain actionable metadata diagnostics.');
  }
  if (snapshot.metadata.supportedMarkets.length !== 0) {
    throw new Error('malformed provider metadata roots must advertise no supported markets.');
  }
  if (
    snapshot.metadata.supportsHistorical ||
    snapshot.metadata.supportsIntraday ||
    snapshot.metadata.supportsRealtime
  ) {
    throw new Error('malformed provider metadata roots must advertise no usable data capability.');
  }
  if (snapshot.metadata.mode !== 'MOCK' || snapshot.metadata.source !== 'MOCK_ENGINE') {
    throw new Error('malformed metadata roots must serialize through the conservative mock sentinel.');
  }
  if (!Object.isFrozen(snapshot.metadata) || !Object.isFrozen(snapshot.metadata.supportedMarkets)) {
    throw new Error('malformed metadata sentinels must remain immutable.');
  }
}

console.log('Provider metadata root smoke passed: null, array and primitive adapter metadata fail closed into immutable zero-capability snapshots before downstream research layers can consume them.');
