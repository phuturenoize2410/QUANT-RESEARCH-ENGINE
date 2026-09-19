import type {
  HealthCheckedProvider,
  ProviderHealth,
  ProviderMetadata,
} from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';
import {
  evaluateProviderReadiness,
  providerSupportsMarket,
  validateProviderMetadata,
} from '../src/engine/providerPolicy';

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

// Public policy helpers are runtime boundaries too. Future external adapters can
// hand them schema-drifted JSON before a health snapshot has canonicalized it, so
// malformed roots must return fail-closed diagnostics rather than throw.
for (const metadata of [null, [], 'not-metadata', 42, true]) {
  const runtimeMetadata = metadata as unknown as ProviderMetadata;
  const issues = validateProviderMetadata(runtimeMetadata);
  if (!issues.some(issue => issue.includes('metadata must be an object'))) {
    throw new Error('metadata validation must diagnose malformed runtime roots.');
  }
  if (providerSupportsMarket(runtimeMetadata, 'IDX')) {
    throw new Error('malformed metadata roots must never advertise market compatibility.');
  }
  const readiness = evaluateProviderReadiness(runtimeMetadata, healthy, 'EOD_RESEARCH', 'IDX');
  if (readiness.allowed || !readiness.reasons.some(reason => reason.includes('metadata must be an object'))) {
    throw new Error('malformed metadata roots must fail closed at direct readiness evaluation.');
  }
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

console.log('Provider metadata root smoke passed: malformed roots fail closed in direct policy helpers and snapshots, while malformed fields collapse into immutable canonical zero-capability evidence.');
