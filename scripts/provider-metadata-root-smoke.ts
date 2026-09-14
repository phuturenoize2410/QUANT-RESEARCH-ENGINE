import type {
  HealthCheckedProvider,
  ProviderHealth,
  ProviderMetadata,
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

const malformedFields = {
  id: 'runtime-bad-fields',
  name: 'Runtime Bad Fields',
  source: 'UNTRUSTED_VENDOR',
  mode: 'STREAMING',
  isPaid: 'yes',
  supportedMarkets: [' idx '],
  supportsHistorical: 'yes',
  supportsIntraday: 1,
  supportsRealtime: 'true',
} as unknown as ProviderMetadata;

const malformedFieldSnapshot = await getProviderHealthSnapshot(
  malformedProvider(malformedFields),
  healthy,
  nowMs,
);

if (malformedFieldSnapshot.health.status !== 'UNAVAILABLE') {
  throw new Error('malformed provider metadata fields must fail closed as UNAVAILABLE.');
}
if (
  malformedFieldSnapshot.metadata.source !== 'MOCK_ENGINE' ||
  malformedFieldSnapshot.metadata.mode !== 'MOCK' ||
  malformedFieldSnapshot.metadata.isPaid !== false
) {
  throw new Error('malformed provider identity/delivery fields must not leak raw runtime values into canonical snapshots.');
}
if (
  malformedFieldSnapshot.metadata.supportsHistorical !== false ||
  malformedFieldSnapshot.metadata.supportsIntraday !== false ||
  malformedFieldSnapshot.metadata.supportsRealtime !== false
) {
  throw new Error('malformed provider capability fields must collapse to zero capability before downstream consumption.');
}
if (malformedFieldSnapshot.metadata.supportedMarkets[0] !== 'IDX') {
  throw new Error('well-formed market identifiers should still be canonicalized even when sibling metadata fields fail closed.');
}

console.log('Provider metadata root smoke passed: malformed roots and fields fail closed into immutable canonical zero-capability snapshots before downstream research layers can consume them.');
