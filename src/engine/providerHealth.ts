import {
  HealthCheckedProvider,
  MarketDataSource,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderMetadata,
  ProviderMode,
} from './dataProviders';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const PROVIDER_HEALTH_STATUSES: readonly ProviderHealthStatus[] = [
  'HEALTHY',
  'DEGRADED',
  'STALE',
  'UNAVAILABLE',
];
const MARKET_DATA_SOURCES: readonly MarketDataSource[] = [
  'MOCK_ENGINE',
  'GOOGLE_FINANCE',
  'FREE_API',
  'IDX_FEED',
  'BROKER_API',
];
const PROVIDER_MODES: readonly ProviderMode[] = ['MOCK', 'DELAYED', 'EOD', 'REALTIME'];

function parseTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeNonNegativeFinite(value?: number): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

function isProviderHealthStatus(value: unknown): value is ProviderHealthStatus {
  return typeof value === 'string' && PROVIDER_HEALTH_STATUSES.includes(value as ProviderHealthStatus);
}

function isMarketDataSource(value: unknown): value is MarketDataSource {
  return typeof value === 'string' && MARKET_DATA_SOURCES.includes(value as MarketDataSource);
}

function isProviderMode(value: unknown): value is ProviderMode {
  return typeof value === 'string' && PROVIDER_MODES.includes(value as ProviderMode);
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

function failHealthClosed(
  health: ProviderHealth,
  detail: string,
): ProviderHealth {
  return {
    ...health,
    status: 'UNAVAILABLE',
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
  const reportedStatus = (health as { status?: unknown }).status;
  const hasValidStatus = isProviderHealthStatus(reportedStatus);

  let normalized: ProviderHealth = {
    ...health,
    status: hasValidStatus ? reportedStatus : 'UNAVAILABLE',
    latencyMs: normalizeNonNegativeFinite(health.latencyMs),
    staleAfterSeconds: normalizeNonNegativeFinite(health.staleAfterSeconds),
  };

  // Provider payloads cross a runtime boundary. TypeScript cannot guarantee that
  // JSON/free-feed/paid-adapter responses actually honour the declared union, so
  // unknown status values must fail closed before Feature/Strategy/UI sees them.
  if (!hasValidStatus) {
    normalized = {
      ...normalized,
      message: appendMessage(
        normalized.message,
        `Invalid provider health status "${String(reportedStatus)}"; failing closed as UNAVAILABLE.`,
      ),
    };
  }

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

function snapshotProviderMetadata(metadata: ProviderMetadata): {
  metadata: ProviderMetadata;
  issues: string[];
} {
  const runtimeMetadata = metadata as ProviderMetadata & {
    id?: unknown;
    name?: unknown;
    source?: unknown;
    mode?: unknown;
    isPaid?: unknown;
    supportedMarkets?: unknown;
    supportsHistorical?: unknown;
    supportsIntraday?: unknown;
    supportsRealtime?: unknown;
  };
  const issues: string[] = [];

  if (typeof runtimeMetadata.id !== 'string' || !runtimeMetadata.id.trim()) issues.push('id');
  if (typeof runtimeMetadata.name !== 'string' || !runtimeMetadata.name.trim()) issues.push('name');
  if (!isMarketDataSource(runtimeMetadata.source)) issues.push('source');
  if (!isProviderMode(runtimeMetadata.mode)) issues.push('mode');
  if (typeof runtimeMetadata.isPaid !== 'boolean') issues.push('isPaid');
  if (typeof runtimeMetadata.supportsHistorical !== 'boolean') issues.push('supportsHistorical');
  if (typeof runtimeMetadata.supportsIntraday !== 'boolean') issues.push('supportsIntraday');
  if (typeof runtimeMetadata.supportsRealtime !== 'boolean') issues.push('supportsRealtime');

  const supportedMarkets = Array.isArray(runtimeMetadata.supportedMarkets)
    ? runtimeMetadata.supportedMarkets.filter(
        (market): market is string => typeof market === 'string' && market.trim().length > 0,
      )
    : [];
  if (
    !Array.isArray(runtimeMetadata.supportedMarkets) ||
    supportedMarkets.length !== runtimeMetadata.supportedMarkets.length ||
    supportedMarkets.length === 0
  ) {
    issues.push('supportedMarkets');
  }

  return {
    metadata: Object.freeze({
      ...metadata,
      supportedMarkets: Object.freeze([...supportedMarkets]),
    }) as ProviderMetadata,
    issues,
  };
}

function snapshotProviderHealth(health: ProviderHealth): ProviderHealth {
  return Object.freeze({ ...health });
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
  const capturedMetadata = snapshotProviderMetadata(provider.metadata);
  let health = healthSnapshot
    ? normalizeProviderHealth(healthSnapshot, nowMs)
    : await captureProviderHealth(provider, nowMs);

  if (capturedMetadata.issues.length > 0) {
    health = failHealthClosed(
      health,
      `Invalid provider metadata fields: ${capturedMetadata.issues.join(', ')}; failing closed as UNAVAILABLE.`,
    );
  }

  return Object.freeze({
    metadata: capturedMetadata.metadata,
    health: snapshotProviderHealth(health),
    capturedAt: new Date(nowMs).toISOString(),
  });
}
