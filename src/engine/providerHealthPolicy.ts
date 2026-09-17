import { ProviderHealth } from './dataProviders';

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
  if (lastSuccessfulSyncAtMs > checkedAtMs) return 'provider health lastSuccessfulSyncAt is later than checkedAt';

  if (providerHealth.staleAfterSeconds !== undefined) {
    if (!Number.isFinite(providerHealth.staleAfterSeconds) || providerHealth.staleAfterSeconds <= 0) {
      return 'provider health staleAfterSeconds must be a positive finite number';
    }
    const ageSeconds = (checkedAtMs - lastSuccessfulSyncAtMs) / 1000;
    if (ageSeconds > providerHealth.staleAfterSeconds) {
      return 'provider health evidence is stale relative to staleAfterSeconds';
    }
  }

  return null;
}
