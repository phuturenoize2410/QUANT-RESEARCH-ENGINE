import { ProviderHealth } from './dataProviders';

// Keep boundary validation consistent with provider-health normalization: small
// timestamp differences can occur when provider systems stamp sync/check events
// independently. Larger inversions remain untrustworthy and fail closed.
const MAX_PROVIDER_CLOCK_SKEW_MS = 5 * 60 * 1000;
const PROVIDER_HEALTH_STATUSES = new Set(['HEALTHY', 'DEGRADED', 'STALE', 'UNAVAILABLE']);

function isNonEmptyTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

/**
 * Canonical validation for provider health evidence crossing engine boundaries.
 * Provider adapters own health semantics; downstream strategy/risk/UI layers must
 * consume this result rather than reimplement timestamp or freshness rules.
 */
export function providerHealthEvidenceError(providerHealth: ProviderHealth): string | null {
  // Health evidence ultimately originates at an external/runtime boundary. Do not
  // trust the compile-time ProviderHealth shape here: callers can receive null,
  // arrays, primitives or schema-drifted JSON from future free/paid adapters.
  if (!providerHealth || typeof providerHealth !== 'object' || Array.isArray(providerHealth)) {
    return 'provider health evidence is malformed; expected an object';
  }

  const runtimeHealth = providerHealth as ProviderHealth & {
    status?: unknown;
    checkedAt?: unknown;
    lastSuccessfulSyncAt?: unknown;
    latencyMs?: unknown;
    staleAfterSeconds?: unknown;
  };

  if (typeof runtimeHealth.status !== 'string' || !PROVIDER_HEALTH_STATUSES.has(runtimeHealth.status)) {
    return 'provider health observation has an invalid status';
  }

  if (!isNonEmptyTimestamp(runtimeHealth.checkedAt)) {
    return 'provider health observation has no valid checkedAt timestamp';
  }
  const checkedAtMs = Date.parse(runtimeHealth.checkedAt);

  if (runtimeHealth.lastSuccessfulSyncAt === undefined || runtimeHealth.lastSuccessfulSyncAt === null || runtimeHealth.lastSuccessfulSyncAt === '') {
    return 'provider health observation has no lastSuccessfulSyncAt evidence';
  }
  if (!isNonEmptyTimestamp(runtimeHealth.lastSuccessfulSyncAt)) {
    return 'provider health observation has no valid lastSuccessfulSyncAt timestamp';
  }

  const lastSuccessfulSyncAtMs = Date.parse(runtimeHealth.lastSuccessfulSyncAt);
  if (lastSuccessfulSyncAtMs > checkedAtMs + MAX_PROVIDER_CLOCK_SKEW_MS) {
    return 'provider health lastSuccessfulSyncAt exceeds allowed clock skew relative to checkedAt';
  }

  if (runtimeHealth.latencyMs !== undefined) {
    if (
      typeof runtimeHealth.latencyMs !== 'number' ||
      !Number.isFinite(runtimeHealth.latencyMs) ||
      runtimeHealth.latencyMs < 0
    ) {
      return 'provider health latencyMs must be a non-negative finite number';
    }
  }

  if (runtimeHealth.staleAfterSeconds !== undefined) {
    if (
      typeof runtimeHealth.staleAfterSeconds !== 'number' ||
      !Number.isFinite(runtimeHealth.staleAfterSeconds) ||
      runtimeHealth.staleAfterSeconds <= 0
    ) {
      return 'provider health staleAfterSeconds must be a positive finite number';
    }
    // A sync timestamp within the accepted clock-skew window can be slightly later
    // than checkedAt. Clamp age at zero so that tolerated skew never manufactures
    // negative freshness or bypasses the declared staleness window.
    const ageSeconds = Math.max(0, (checkedAtMs - lastSuccessfulSyncAtMs) / 1000);
    if (ageSeconds > runtimeHealth.staleAfterSeconds) {
      return 'provider health evidence is stale relative to staleAfterSeconds';
    }
  }

  return null;
}

/**
 * Canonical readiness decision for consumers that require trustworthy provider
 * data. This deliberately composes evidence validation with the provider-owned
 * status vocabulary so execution/application layers never reinterpret HEALTHY,
 * DEGRADED, STALE, or UNAVAILABLE independently.
 */
export function providerHealthReadinessError(providerHealth: ProviderHealth): string | null {
  const evidenceError = providerHealthEvidenceError(providerHealth);
  if (evidenceError) return evidenceError;

  if (providerHealth.status !== 'HEALTHY') {
    return `provider health is ${providerHealth.status}; HEALTHY is required`;
  }

  return null;
}
