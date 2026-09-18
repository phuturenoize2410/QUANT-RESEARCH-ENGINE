import { providerHealthReadinessError } from '../src/engine/providerHealthPolicy';
import type { ProviderHealth } from '../src/engine/dataProviders';

const healthy: ProviderHealth = {
  status: 'HEALTHY',
  checkedAt: '2026-09-18T00:00:00.000Z',
  lastSuccessfulSyncAt: '2026-09-17T23:59:30.000Z',
  staleAfterSeconds: 300,
};

if (providerHealthReadinessError(healthy) !== null) {
  throw new Error('Fresh HEALTHY provider evidence must be research-ready.');
}

for (const status of ['DEGRADED', 'STALE', 'UNAVAILABLE'] as const) {
  const error = providerHealthReadinessError({ ...healthy, status });
  if (!error?.includes(`provider health is ${status}`)) {
    throw new Error(`${status} provider evidence must fail canonical readiness.`);
  }
}

const stale = providerHealthReadinessError({
  ...healthy,
  lastSuccessfulSyncAt: '2026-09-17T23:50:00.000Z',
});
if (!stale?.includes('stale relative to staleAfterSeconds')) {
  throw new Error('HEALTHY labels must not bypass canonical freshness evidence.');
}

const missingSync = providerHealthReadinessError({
  status: 'HEALTHY',
  checkedAt: healthy.checkedAt,
});
if (!missingSync?.includes('no lastSuccessfulSyncAt evidence')) {
  throw new Error('HEALTHY labels without sync provenance must fail closed.');
}

const toleratedSkew = providerHealthReadinessError({
  ...healthy,
  lastSuccessfulSyncAt: '2026-09-18T00:04:00.000Z',
});
if (toleratedSkew !== null) {
  throw new Error('Canonical readiness must preserve the provider clock-skew tolerance.');
}

const excessiveSkew = providerHealthReadinessError({
  ...healthy,
  lastSuccessfulSyncAt: '2026-09-18T00:06:00.000Z',
});
if (!excessiveSkew?.includes('exceeds allowed clock skew')) {
  throw new Error('Provider evidence beyond canonical clock skew must fail closed.');
}

console.log('Provider-health readiness smoke passed: downstream consumers share one fail-closed health, freshness, provenance, and clock-skew policy.');
