import type { ProviderHealth } from './providerContracts';

// Keep boundary validation consistent with provider-health normalization: small
// timestamp differences can occur when provider systems stamp sync/check events
// independently. Larger inversions remain untrustworthy and fail closed.
const MAX_PROVIDER_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_SAFE_STALE_AFTER_SECONDS = Number.MAX_SAFE_INTEGER / 1000;
const PROVIDER_HEALTH_STATUSES = new Set(['HEALTHY', 'DEGRADED', 'STALE', 'UNAVAILABLE']);
// Provider-health timestamps are cross-system evidence, so require an explicit
// RFC3339-style instant with timezone rather than relying on Date.parse's
// implementation-dependent acceptance of date-only or locale-shaped strings.
const PROVIDER_HEALTH_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isNonEmptyTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const match = PROVIDER_HEALTH_INSTANT.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetSign, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  // Date.parse can normalize impossible calendar values on some runtimes (for
  // example February 30). Validate the RFC3339 calendar/time fields explicitly
  // before using the parsed instant for freshness or clock-skew decisions.
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;

  if (offsetHourText !== undefined && offsetMinuteText !== undefined) {
    const offsetHour = Number(offsetHourText);
    const offsetMinute = Number(offsetMinuteText);
    // RFC3339 numeric offsets are bounded to ±14:00. Date parsers may accept
    // wider implementation-specific offsets, but provider provenance must remain
    // portable across adapters/runtimes rather than inheriting parser leniency.
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
    // RFC3339 reserves -00:00 to signal an unknown local offset. Provider-health
    // timestamps are provenance used for freshness/clock-skew decisions, so an
    // unknown offset is not sufficiently authoritative even though it denotes the
    // same numeric instant as UTC in generic timestamp parsers. Require Z/+00:00
    // when the producer intends to assert UTC.
    if (offsetSign === '-' && offsetHour === 0 && offsetMinute === 0) return false;
  }

  return Number.isFinite(Date.parse(value));
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
    message?: unknown;
  };

  if (typeof runtimeHealth.status !== 'string' || !PROVIDER_HEALTH_STATUSES.has(runtimeHealth.status)) {
    return 'provider health observation has an invalid status';
  }

  if (!isNonEmptyTimestamp(runtimeHealth.checkedAt)) {
    return 'provider health observation has no valid checkedAt timestamp';
  }
  const checkedAtMs = Date.parse(runtimeHealth.checkedAt);

  // Optional means omitted/undefined only. Runtime null/empty-string values are
  // schema drift from JSON/vendor adapters and must not masquerade as the valid
  // "never synchronized" state available to non-healthy providers.
  const hasSyncEvidence = runtimeHealth.lastSuccessfulSyncAt !== undefined;

  // A provider that has never synchronized can still report trustworthy
  // DEGRADED/STALE/UNAVAILABLE health. Requiring sync provenance for those states
  // would turn an honest outage observation into malformed evidence. HEALTHY is
  // different: readiness must always be backed by a successful synchronization.
  if (!hasSyncEvidence && runtimeHealth.status === 'HEALTHY') {
    return 'provider health observation has no lastSuccessfulSyncAt evidence';
  }

  let lastSuccessfulSyncAtMs: number | null = null;
  if (hasSyncEvidence) {
    if (!isNonEmptyTimestamp(runtimeHealth.lastSuccessfulSyncAt)) {
      return 'provider health observation has no valid lastSuccessfulSyncAt timestamp';
    }

    lastSuccessfulSyncAtMs = Date.parse(runtimeHealth.lastSuccessfulSyncAt);
    if (lastSuccessfulSyncAtMs > checkedAtMs + MAX_PROVIDER_CLOCK_SKEW_MS) {
      return 'provider health lastSuccessfulSyncAt exceeds allowed clock skew relative to checkedAt';
    }
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
      runtimeHealth.staleAfterSeconds <= 0 ||
      runtimeHealth.staleAfterSeconds > MAX_SAFE_STALE_AFTER_SECONDS
    ) {
      return 'provider health staleAfterSeconds must be a positive finite number within safe freshness arithmetic bounds';
    }
    if (lastSuccessfulSyncAtMs !== null) {
      // A sync timestamp within the accepted clock-skew window can be slightly later
      // than checkedAt. Clamp age at zero so that tolerated skew never manufactures
      // negative freshness or bypasses the declared staleness window.
      const ageSeconds = Math.max(0, (checkedAtMs - lastSuccessfulSyncAtMs) / 1000);
      if (ageSeconds > runtimeHealth.staleAfterSeconds) {
        return 'provider health evidence is stale relative to staleAfterSeconds';
      }
    }
  }

  // Normalization treats blank diagnostic text as absent/invalid. Keep the
  // canonical evidence policy aligned so direct readiness callers cannot accept a
  // payload that the provider boundary would degrade. This matters for future
  // JSON-backed adapters where empty strings are common schema-drift sentinels.
  if (
    runtimeHealth.message !== undefined &&
    (typeof runtimeHealth.message !== 'string' || runtimeHealth.message.trim().length === 0)
  ) {
    return 'provider health message must be a non-empty string when provided';
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
