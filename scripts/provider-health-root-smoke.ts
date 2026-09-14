import type {
  HealthCheckedProvider,
  ProviderHealth,
  ProviderMetadata,
} from '../src/engine/dataProviders';
import {
  captureProviderHealth,
  getProviderHealthSnapshot,
  normalizeProviderHealth,
} from '../src/engine/providerHealth';

const nowMs = Date.parse('2026-09-14T06:30:00.000Z');
const metadata: ProviderMetadata = {
  id: 'mock-health-root-smoke',
  name: 'Mock Health Root Smoke',
  source: 'MOCK_ENGINE',
  mode: 'MOCK',
  isPaid: false,
  supportedMarkets: ['IDX'],
  supportsHistorical: true,
  supportsIntraday: false,
  supportsRealtime: false,
};

function malformedHealthProvider(health: unknown): HealthCheckedProvider {
  return {
    metadata,
    async getHealth() {
      return health;
    },
  } as unknown as HealthCheckedProvider;
}

for (const malformed of [null, [], 'not-health', 42]) {
  const direct = normalizeProviderHealth(
    malformed as unknown as ProviderHealth,
    nowMs,
  );

  if (direct.status !== 'UNAVAILABLE') {
    throw new Error('malformed provider health roots must normalize to UNAVAILABLE.');
  }
  if (!direct.message?.includes('malformed')) {
    throw new Error('malformed provider health roots must retain actionable diagnostics.');
  }
  if (direct.checkedAt !== new Date(nowMs).toISOString()) {
    throw new Error('malformed provider health roots must retain a deterministic observation timestamp.');
  }

  const captured = await captureProviderHealth(
    malformedHealthProvider(malformed),
    nowMs,
  );

  if (captured.status !== 'UNAVAILABLE') {
    throw new Error('provider capture must fail closed for malformed health roots.');
  }
  if (!captured.message?.includes('malformed')) {
    throw new Error('provider capture must expose malformed-root diagnostics.');
  }
}

let injectedSnapshotProbeCalls = 0;
const providerWithObservableProbe: HealthCheckedProvider = {
  metadata,
  async getHealth() {
    injectedSnapshotProbeCalls += 1;
    return {
      status: 'HEALTHY',
      checkedAt: new Date(nowMs).toISOString(),
    };
  },
};

const injectedNullSnapshot = await getProviderHealthSnapshot(
  providerWithObservableProbe,
  null as unknown as ProviderHealth,
  nowMs,
);
if (injectedNullSnapshot.health.status !== 'UNAVAILABLE') {
  throw new Error('an explicitly injected null health snapshot must fail closed as UNAVAILABLE.');
}
if (!injectedNullSnapshot.health.message?.includes('malformed')) {
  throw new Error('an injected null health snapshot must retain malformed-payload diagnostics.');
}
if (injectedSnapshotProbeCalls !== 0) {
  throw new Error('an explicitly injected health snapshot must never be replaced by a fresh provider probe.');
}

const invalidClock = normalizeProviderHealth(
  null as unknown as ProviderHealth,
  Number.NaN,
);
if (invalidClock.status !== 'UNAVAILABLE') {
  throw new Error('malformed health plus invalid observation clock must remain UNAVAILABLE.');
}
if (!invalidClock.message?.includes('observation clock is invalid')) {
  throw new Error('invalid observation clock diagnostics must survive malformed health handling.');
}
if (invalidClock.checkedAt !== '1970-01-01T00:00:00.000Z') {
  throw new Error('invalid observation clocks must keep the deterministic epoch sentinel.');
}

console.log('Provider health root smoke passed: malformed and explicitly injected null health responses fail closed without hidden reprobes before Feature/Strategy/Risk/UI layers can consume them.');
