import type { HealthCheckedProvider, ProviderHealth } from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';

const nowMs = Date.parse('2026-09-14T09:00:00.000Z');
const healthySnapshot: ProviderHealth = {
  status: 'HEALTHY',
  checkedAt: '2026-09-14T09:00:00.000Z',
};

const malformedProviders: unknown[] = [
  null,
  [],
  'provider',
  42,
  {},
  { metadata: {} },
  { metadata: {}, getHealth: 'not-a-function' },
];

for (const malformedProvider of malformedProviders) {
  const snapshot = await getProviderHealthSnapshot(
    malformedProvider as HealthCheckedProvider,
    undefined,
    nowMs,
  );

  if (snapshot.health.status !== 'UNAVAILABLE') {
    throw new Error('malformed provider roots must fail closed as UNAVAILABLE.');
  }
  if (!snapshot.health.message?.includes('Invalid provider root contract')) {
    throw new Error('malformed provider roots must preserve explicit provider-contract diagnostics.');
  }
  if (snapshot.metadata.supportsHistorical || snapshot.metadata.supportsIntraday || snapshot.metadata.supportsRealtime) {
    throw new Error('malformed provider roots must expose zero usable data capabilities.');
  }
  if (snapshot.capturedAt !== '2026-09-14T09:00:00.000Z') {
    throw new Error('malformed provider roots must still return a deterministic canonical capture instant.');
  }
}

let unexpectedHealthProbe = false;
const malformedProviderWithCallableHealth = {
  metadata: null,
  async getHealth(): Promise<ProviderHealth> {
    unexpectedHealthProbe = true;
    return healthySnapshot;
  },
} as unknown as HealthCheckedProvider;

const injectedSnapshot = await getProviderHealthSnapshot(
  malformedProviderWithCallableHealth,
  healthySnapshot,
  nowMs,
);

if (unexpectedHealthProbe) {
  throw new Error('explicit injected health must not trigger a hidden provider health probe.');
}
if (injectedSnapshot.health.status !== 'UNAVAILABLE') {
  throw new Error('valid injected health must not override malformed provider metadata/root safety.');
}
if (injectedSnapshot.metadata.source !== 'MOCK_ENGINE' || injectedSnapshot.metadata.mode !== 'MOCK') {
  throw new Error('malformed provider contracts must remain conservatively labeled at the shared boundary.');
}

console.log('Provider-root contract smoke passed: malformed provider roots fail closed without throwing, expose zero usable capabilities, preserve deterministic capture state, and injected health never causes a hidden probe.');
