import { providerHealthEvidenceError, providerHealthReadinessError } from '../src/engine/providerHealthPolicy';
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

for (const status of ['DEGRADED', 'STALE', 'UNAVAILABLE'] as const) {
  const neverSynced: ProviderHealth = {
    status,
    checkedAt: healthy.checkedAt,
    staleAfterSeconds: 300,
    message: 'Provider has not completed a successful synchronization.',
  };
  if (providerHealthEvidenceError(neverSynced) !== null) {
    throw new Error(`${status} providers must be able to report trustworthy health before their first successful sync.`);
  }
  const readinessError = providerHealthReadinessError(neverSynced);
  if (!readinessError?.includes(`provider health is ${status}`)) {
    throw new Error(`${status} never-synced providers must fail readiness because of status, not missing provenance.`);
  }

  for (const malformedMissingSync of [null, ''] as unknown[]) {
    const malformedError = providerHealthEvidenceError({
      ...neverSynced,
      lastSuccessfulSyncAt: malformedMissingSync,
    } as ProviderHealth);
    if (!malformedError?.includes('no valid lastSuccessfulSyncAt timestamp')) {
      throw new Error(`${status} providers must omit absent sync provenance; null/empty runtime values are schema drift.`);
    }
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

const malformedRoots: unknown[] = [null, undefined, 'healthy', 42, []];
for (const malformed of malformedRoots) {
  const error = providerHealthReadinessError(malformed as ProviderHealth);
  if (!error?.includes('evidence is malformed')) {
    throw new Error('Malformed provider-health roots must fail closed without native property-access errors.');
  }
}

for (const malformedStatus of [undefined, null, '', 'healthy', 'UNKNOWN', 42, {}, []] as unknown[]) {
  const error = providerHealthReadinessError({
    ...healthy,
    status: malformedStatus,
  } as ProviderHealth);
  if (!error?.includes('invalid status')) {
    throw new Error('Runtime provider-health status must use the canonical status vocabulary.');
  }
}

for (const malformedTimestamp of [42, [], {}, '   ', '2026-09-18', '09/18/2026 00:00:00', '2026-09-18T00:00:00'] as unknown[]) {
  const error = providerHealthReadinessError({
    ...healthy,
    checkedAt: malformedTimestamp,
  } as ProviderHealth);
  if (!error?.includes('no valid checkedAt timestamp')) {
    throw new Error('Runtime checkedAt values must be explicit parseable RFC3339-style instants.');
  }
}

for (const malformedTimestamp of [42, [], {}, '   ', '2026-09-17', '09/17/2026 23:59:30', '2026-09-17T23:59:30'] as unknown[]) {
  const error = providerHealthReadinessError({
    ...healthy,
    lastSuccessfulSyncAt: malformedTimestamp,
  } as ProviderHealth);
  if (!error?.includes('no valid lastSuccessfulSyncAt timestamp')) {
    throw new Error('Runtime sync timestamps must be explicit parseable RFC3339-style instants.');
  }
}

const offsetInstant = providerHealthReadinessError({
  ...healthy,
  checkedAt: '2026-09-18T07:00:00+07:00',
  lastSuccessfulSyncAt: '2026-09-18T06:59:30+07:00',
});
if (offsetInstant !== null) {
  throw new Error('Explicit timezone-offset provider instants must remain valid evidence.');
}

if (providerHealthReadinessError({ ...healthy, latencyMs: 0 }) !== null) {
  throw new Error('Zero provider latency is valid evidence for in-process/mock adapters.');
}

for (const malformedLatency of [-1, Number.NaN, Number.POSITIVE_INFINITY, '12', null, {}, []] as unknown[]) {
  const error = providerHealthReadinessError({
    ...healthy,
    latencyMs: malformedLatency,
  } as ProviderHealth);
  if (!error?.includes('latencyMs must be a non-negative finite number')) {
    throw new Error('Runtime provider latency must remain non-negative finite numeric evidence.');
  }
}

for (const malformedThreshold of ['300', null, {}, []] as unknown[]) {
  const error = providerHealthReadinessError({
    ...healthy,
    staleAfterSeconds: malformedThreshold,
  } as ProviderHealth);
  if (!error?.includes('staleAfterSeconds must be a positive finite number')) {
    throw new Error('Runtime freshness thresholds must remain numeric positive finite evidence.');
  }
}

if (providerHealthReadinessError({ ...healthy, message: 'Provider operational.' }) !== null) {
  throw new Error('String provider-health messages must remain valid optional diagnostic evidence.');
}

for (const malformedMessage of [null, 42, {}, []] as unknown[]) {
  const error = providerHealthReadinessError({
    ...healthy,
    message: malformedMessage,
  } as ProviderHealth);
  if (!error?.includes('message must be a string when provided')) {
    throw new Error('Runtime provider-health messages must remain string diagnostic evidence.');
  }
}

console.log('Provider-health readiness smoke passed: downstream consumers share one fail-closed health, freshness, provenance, clock-skew, explicit-instant, status-vocabulary, latency, message, never-synced outage, strict optional-sync shape, and runtime-shape policy.');
