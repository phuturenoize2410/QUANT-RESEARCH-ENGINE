import {
  HealthCheckedProvider,
  ProviderHealth,
  ProviderMetadata,
} from './dataProviders';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function parseTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeNonNegativeFinite(value?: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

function appendMessage(base: string | undefined, detail: string): string {
  return base ? `${base} ${detail}` : detail;
}

function degradeHealth(
  health: ProviderHealth,
  detail: string,
): ProviderHealth {
  if (health.status === 'UNAVAILABLE' || health.status === 'STALE') {
    return {
      ...health,
      message: appendMessage(health.message, detail),
    };
  }

  return {
    ...health,
    status: 'DEGRADED',
    message: appendMessage(health.message, detail),
  };
}

function providerErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Unknown provider health-check failure.';
}

/**
 * Converts provider-reported health into one canonical health snapshot.
 *
 * Health normalization belongs to the provider boundary, not research-use-case
 * policy. Keeping it here means market-data, broker-flow and future alternative
 * providers share freshness/timestamp semantics without depending on strategy or
 * execution readiness decisions.
 */
export function normalizeProviderHealth(
  health: ProviderHealth,
  nowMs: number = Date.now(),
): ProviderHealth {
  let normalized: ProviderHealth = {
    ...health,
    latencyMs: normalizeNonNegativeFinite(health.latencyMs),
    staleAfterSeconds: normalizeNonNegativeFinite(health.staleAfterSeconds),
  };

  if (health.latencyMs !== undefined && normalized.latencyMs === undefined) {
    normalized = degradeHealth(normalized, 'Invalid provider latency metadata ignored.');
  }

  if (health.staleAfterSeconds !== undefined && normalized.staleAfterSeconds === undefined) {
    normalized = degradeHealth(normalized, 'Invalid freshness threshold ignored.');
  }

  const checkedAtMs = parseTimestamp(normalized.checkedAt);
  if (checkedAtMs === undefined) {
    normalized = degradeHealth(normalized, 'Provider health check timestamp is invalid.');
  } else if (checkedAtMs > nowMs + MAX_CLOCK_SKEW_MS) {
    normalized = degradeHealth(normalized, 'Provider health check timestamp is unexpectedly in the future.');
  }

  if (normalized.status === 'UNAVAILABLE') return normalized;

  const lastSuccessfulSyncMs = parseTimestamp(normalized.lastSuccessfulSyncAt);
  const staleAfterSeconds = normalized.staleAfterSeconds;

  if (normalized.lastSuccessfulSyncAt && lastSuccessfulSyncMs === undefined) {
    normalized = degradeHealth(normalized, 'Last successful sync timestamp is invalid.');
  }

  if (lastSuccessfulSyncMs !== undefined && lastSuccessfulSyncMs > nowMs + MAX_CLOCK_SKEW_MS) {
    normalized = degradeHealth(normalized, 'Last successful sync timestamp is unexpectedly in the future.');
  }

  if (staleAfterSeconds !== undefined && lastSuccessfulSyncMs === undefined) {
    normalized = degradeHealth(
      normalized,
      'Freshness threshold is declared but last successful sync time is unavailable.',
    );
  }

  if (
    lastSuccessfulSyncMs !== undefined &&
    staleAfterSeconds !== undefined &&
    nowMs - lastSuccessfulSyncMs > staleAfterSeconds * 1000
  ) {
    return {
      ...normalized,
      status: 'STALE',
      message: appendMessage(normalized.message, 'Freshness threshold exceeded.'),
    };
  }

  return normalized;
}

/**
 * Capture provider health behind a failure-safe external-system boundary.
 * A failed probe becomes canonical UNAVAILABLE state before feature, strategy,
 * risk/execution or UI layers can interpret provider failures independently.
 */
export async function captureProviderHealth(
  provider: HealthCheckedProvider,
  nowMs: number = Date.now(),
): Promise<ProviderHealth> {
  try {
    return normalizeProviderHealth(await provider.getHealth(), nowMs);
  } catch (error) {
    return {
      status: 'UNAVAILABLE',
      checkedAt: new Date(nowMs).toISOString(),
      message: `Provider health check failed: ${providerErrorMessage(error)}`,
    };
  }
}

/**
 * Vendor-neutral health/status envelope shared by every external data adapter.
 *
 * This intentionally stops before market-data readiness. Market-data providers
 * additionally need research-use-case capability policy, while broker-flow or
 * future alternative-data providers still need the same canonical metadata,
 * health normalization and capture timestamp semantics.
 */
export interface ProviderHealthSnapshot {
  metadata: ProviderMetadata;
  health: ProviderHealth;
  capturedAt: string;
}

/**
 * Capture one canonical health snapshot for any provider crossing an external
 * system boundary. Callers may inject an already captured health payload when
 * coordinating multiple status decisions at the same instant; the payload is
 * still normalized by engine-owned health semantics.
 */
export async function getProviderHealthSnapshot(
  provider: HealthCheckedProvider,
  healthSnapshot?: ProviderHealth,
  nowMs: number = Date.now(),
): Promise<ProviderHealthSnapshot> {
  const health = healthSnapshot
    ? normalizeProviderHealth(healthSnapshot, nowMs)
    : await captureProviderHealth(provider, nowMs);

  return {
    metadata: provider.metadata,
    health,
    capturedAt: new Date(nowMs).toISOString(),
  };
}
