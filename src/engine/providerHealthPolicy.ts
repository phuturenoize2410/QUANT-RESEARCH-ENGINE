import { ProviderHealth } from './dataProviders';

// Keep boundary validation consistent with provider-health normalization: small
// timestamp differences can occur when provider systems stamp sync/check events
// independently. Larger inversions remain untrustworthy and fail closed.
const MAX_PROVIDER_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Canonical validation for provider health evidence crossing engine boundaries.
 * Provider adapters own health semantics; downstream strategy/risk/UI layers must
 * consume this result rather than reimplement timestamp or freshness rules.
 */
export function providerHealthEvidenceError(providerHealth: ProviderHealth): string | null {
  const checkedAtMs = Date.parse(providerHealth.checkedAt);
  if (!Number.isFinite(checkedAtMs)) return 'provider health observation has no valid checkedAt timestamp';

  if (!providerHealth.lastSuccessfulSyncAt) return 'provider health observation has no lastSuccessfulSyncAt evidence';

  const lastSuccessfulSyncAtMs = Date.parse(providerHealth.lastSuccessfulSyncAt);
  if (!Number.isFinite(lastSuccessfulSyncAtMs)) return 'provider health observation has no valid lastSuccessfulSyncAt timestamp';
  if (lastSuccessfulSyncAtMs > checkedAtMs + MAX_PROVIDER_CLOCK_SKEW_MS) {
    return 'provider health lastSuccessfulSyncAt exceeds allowed clock skew relative to checkedAt';
  }

  if (providerHealth.staleAfterSeconds !== undefined) {
    if (!Number.isFinite(providerHealth.staleAfterSeconds) || providerHealth.staleAfterSeconds <= 0) {
      return 'provider health staleAfterSeconds must be a positive finite number';
    }
    // A sync timestamp within the accepted clock-skew window can be slightly later
    // than checkedAt. Clamp age at zero so that tolerated skew never manufactures
    // negative freshness or bypasses the declared staleness window.
    const ageSeconds = Math.max(0, (checkedAtMs - lastSuccessfulSyncAtMs) / 1000);
    if (ageSeconds > providerHealth.staleAfterSeconds) {
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
