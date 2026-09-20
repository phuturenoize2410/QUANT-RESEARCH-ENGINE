import type {
  HealthCheckedProvider,
  MarketDataSource,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderMetadata,
  ProviderMode,
} from './providerContracts';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_DATE_MS = 8.64e15;
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

function normalizeObservationClock(value: unknown): { nowMs: number; valid: boolean } {
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -MAX_DATE_MS &&
    value <= MAX_DATE_MS
  ) {
    return { nowMs: value, valid: true };
  }

  const fallback = Date.now();
  return {
    nowMs: Number.isFinite(fallback) && fallback >= -MAX_DATE_MS && fallback <= MAX_DATE_MS ? fallback : 0,
    valid: false,
  };
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  try {
    return new Date(parsed).toISOString();
  } catch {
    return null;
  }
}

function normalizeNonNegativeFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizePositiveFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeMarketDataSource(value: unknown): MarketDataSource | null {
  return typeof value === 'string' && MARKET_DATA_SOURCES.includes(value as MarketDataSource)
    ? (value as MarketDataSource)
    : null;
}

function normalizeProviderMode(value: unknown): ProviderMode | null {
  return typeof value === 'string' && PROVIDER_MODES.includes(value as ProviderMode)
    ? (value as ProviderMode)
    : null;
}

function normalizeProviderHealthStatus(value: unknown): ProviderHealthStatus | null {
  return typeof value === 'string' && PROVIDER_HEALTH_STATUSES.includes(value as ProviderHealthStatus)
    ? (value as ProviderHealthStatus)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function freezeArray<T>(values: T[]): readonly T[] {
  return Object.freeze(values.slice());
}

function freezeMetadata(metadata: ProviderMetadata): ProviderMetadata {
  return Object.freeze({
    ...metadata,
    markets: freezeArray([...metadata.markets]),
  });
}

function freezeHealth(health: ProviderHealth): ProviderHealth {
  return Object.freeze({ ...health });
}

export interface ProviderHealthSnapshot {
  metadata: ProviderMetadata;
  health: ProviderHealth;
  observedAt: string;
  observationClockValid: boolean;
  contractValid: boolean;
  contractIssues: readonly string[];
}

function invalidMetadata(issues: string[]): ProviderMetadata {
  issues.push('provider metadata unavailable or invalid');
  return freezeMetadata({
    id: 'UNKNOWN_PROVIDER',
    name: 'Unknown provider',
    source: 'MOCK_ENGINE',
    mode: 'MOCK',
    isPaid: false,
    supportsRealtime: false,
    markets: [],
  });
}

function invalidHealth(issues: string[], observedAt: string): ProviderHealth {
  issues.push('provider health unavailable or invalid');
  return freezeHealth({
    status: 'UNAVAILABLE',
    checkedAt: observedAt,
    message: 'Provider health contract unavailable or invalid.',
  });
}

function normalizeMetadata(value: unknown, issues: string[]): ProviderMetadata {
  if (!isRecord(value)) return invalidMetadata(issues);

  const id = normalizeString(value.id);
  const name = normalizeString(value.name);
  const source = normalizeMarketDataSource(value.source);
  const mode = normalizeProviderMode(value.mode);
  const isPaid = normalizeBoolean(value.isPaid);
  const supportsRealtime = normalizeBoolean(value.supportsRealtime);
  const markets = Array.isArray(value.markets)
    ? value.markets.filter((market): market is string => typeof market === 'string' && market.trim().length > 0)
    : null;

  if (!id) issues.push('provider metadata id is invalid');
  if (!name) issues.push('provider metadata name is invalid');
  if (!source) issues.push('provider metadata source is invalid');
  if (!mode) issues.push('provider metadata mode is invalid');
  if (isPaid === null) issues.push('provider metadata isPaid is invalid');
  if (supportsRealtime === null) issues.push('provider metadata supportsRealtime is invalid');
  if (!markets) issues.push('provider metadata markets is invalid');

  if (!id || !name || !source || !mode || isPaid === null || supportsRealtime === null || !markets) {
    return invalidMetadata([]);
  }

  return freezeMetadata({
    id,
    name,
    source,
    mode,
    isPaid,
    supportsRealtime,
    markets: markets.map((market) => market.trim()),
  });
}

function normalizeHealth(
  value: unknown,
  issues: string[],
  observedAt: string,
  observedAtMs: number,
): ProviderHealth {
  if (!isRecord(value)) return invalidHealth(issues, observedAt);

  const status = normalizeProviderHealthStatus(value.status);
  const checkedAt = normalizeTimestamp(value.checkedAt);
  const latencyMs = value.latencyMs === undefined ? undefined : normalizeNonNegativeFinite(value.latencyMs);
  const message = value.message === undefined ? undefined : normalizeString(value.message);
  const lastSuccessfulFetchAt =
    value.lastSuccessfulFetchAt === undefined ? undefined : normalizeTimestamp(value.lastSuccessfulFetchAt);
  const lastQuoteAt = value.lastQuoteAt === undefined ? undefined : normalizeTimestamp(value.lastQuoteAt);
  const lastBarAt = value.lastBarAt === undefined ? undefined : normalizeTimestamp(value.lastBarAt);
  const consecutiveFailures =
    value.consecutiveFailures === undefined ? undefined : normalizeInteger(value.consecutiveFailures);
  const rateLimitRemaining =
    value.rateLimitRemaining === undefined ? undefined : normalizeInteger(value.rateLimitRemaining);
  const rateLimitResetAt =
    value.rateLimitResetAt === undefined ? undefined : normalizeTimestamp(value.rateLimitResetAt);

  if (!status) issues.push('provider health status is invalid');
  if (!checkedAt) issues.push('provider health checkedAt is invalid');
  if (latencyMs === null) issues.push('provider health latencyMs is invalid');
  if (message === null) issues.push('provider health message is invalid');
  if (lastSuccessfulFetchAt === null) issues.push('provider health lastSuccessfulFetchAt is invalid');
  if (lastQuoteAt === null) issues.push('provider health lastQuoteAt is invalid');
  if (lastBarAt === null) issues.push('provider health lastBarAt is invalid');
  if (consecutiveFailures === null || (consecutiveFailures !== undefined && consecutiveFailures < 0)) {
    issues.push('provider health consecutiveFailures is invalid');
  }
  if (rateLimitRemaining === null || (rateLimitRemaining !== undefined && rateLimitRemaining < 0)) {
    issues.push('provider health rateLimitRemaining is invalid');
  }
  if (rateLimitResetAt === null) issues.push('provider health rateLimitResetAt is invalid');

  if (checkedAt) {
    const checkedAtMs = Date.parse(checkedAt);
    if (checkedAtMs > observedAtMs + MAX_CLOCK_SKEW_MS) {
      issues.push('provider health checkedAt is implausibly in the future');
    }
  }

  if (!status || !checkedAt) return invalidHealth([], observedAt);

  return freezeHealth({
    status,
    checkedAt,
    ...(latencyMs !== undefined && latencyMs !== null ? { latencyMs } : {}),
    ...(message !== undefined && message !== null ? { message } : {}),
    ...(lastSuccessfulFetchAt !== undefined && lastSuccessfulFetchAt !== null ? { lastSuccessfulFetchAt } : {}),
    ...(lastQuoteAt !== undefined && lastQuoteAt !== null ? { lastQuoteAt } : {}),
    ...(lastBarAt !== undefined && lastBarAt !== null ? { lastBarAt } : {}),
    ...(consecutiveFailures !== undefined && consecutiveFailures !== null ? { consecutiveFailures } : {}),
    ...(rateLimitRemaining !== undefined && rateLimitRemaining !== null ? { rateLimitRemaining } : {}),
    ...(rateLimitResetAt !== undefined && rateLimitResetAt !== null ? { rateLimitResetAt } : {}),
  });
}

export async function observeProviderHealth(
  provider: HealthCheckedProvider,
  nowMs: number = Date.now(),
): Promise<ProviderHealthSnapshot> {
  const observationClock = normalizeObservationClock(nowMs);
  const observedAt = new Date(observationClock.nowMs).toISOString();
  const issues: string[] = [];

  if (!observationClock.valid) {
    issues.push('provider health observation clock is invalid');
  }

  let metadataValue: unknown;
  try {
    metadataValue = provider?.getMetadata?.();
  } catch {
    metadataValue = undefined;
    issues.push('provider metadata read failed');
  }
  const metadata = normalizeMetadata(metadataValue, issues);

  let healthValue: unknown;
  try {
    healthValue = await provider?.getHealth?.();
  } catch {
    healthValue = undefined;
    issues.push('provider health read failed');
  }
  const health = normalizeHealth(healthValue, issues, observedAt, observationClock.nowMs);

  const contractIssues = freezeArray(issues);
  return Object.freeze({
    metadata,
    health,
    observedAt,
    observationClockValid: observationClock.valid,
    contractValid: contractIssues.length === 0,
    contractIssues,
  });
}

export function providerHealthAgeMs(snapshot: ProviderHealthSnapshot, nowMs: number = Date.now()): number | null {
  const now = normalizeObservationClock(nowMs);
  if (!now.valid) return null;
  const checkedAtMs = Date.parse(snapshot.health.checkedAt);
  if (!Number.isFinite(checkedAtMs)) return null;
  return Math.max(0, now.nowMs - checkedAtMs);
}

export function providerLastDataAgeMs(
  snapshot: ProviderHealthSnapshot,
  nowMs: number = Date.now(),
): number | null {
  const now = normalizeObservationClock(nowMs);
  if (!now.valid) return null;
  const candidates = [
    snapshot.health.lastQuoteAt,
    snapshot.health.lastBarAt,
    snapshot.health.lastSuccessfulFetchAt,
  ]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  if (candidates.length === 0) return null;
  return Math.max(0, now.nowMs - Math.max(...candidates));
}

export function providerRateLimitResetMs(
  snapshot: ProviderHealthSnapshot,
  nowMs: number = Date.now(),
): number | null {
  const now = normalizeObservationClock(nowMs);
  if (!now.valid || !snapshot.health.rateLimitResetAt) return null;
  const resetAtMs = Date.parse(snapshot.health.rateLimitResetAt);
  if (!Number.isFinite(resetAtMs)) return null;
  return Math.max(0, resetAtMs - now.nowMs);
}

export function providerLatencyMs(snapshot: ProviderHealthSnapshot): number | null {
  return normalizeNonNegativeFinite(snapshot.health.latencyMs);
}

export function providerFailureCount(snapshot: ProviderHealthSnapshot): number | null {
  const value = normalizeInteger(snapshot.health.consecutiveFailures);
  return value !== null && value >= 0 ? value : null;
}

export function providerRateLimitRemaining(snapshot: ProviderHealthSnapshot): number | null {
  const value = normalizeInteger(snapshot.health.rateLimitRemaining);
  return value !== null && value >= 0 ? value : null;
}

export function providerSupportsRealtime(snapshot: ProviderHealthSnapshot): boolean {
  return snapshot.metadata.supportsRealtime && snapshot.metadata.mode === 'REALTIME';
}

export function providerIsPaid(snapshot: ProviderHealthSnapshot): boolean {
  return snapshot.metadata.isPaid;
}

export function providerContractValid(snapshot: ProviderHealthSnapshot): boolean {
  return snapshot.contractValid && snapshot.observationClockValid;
}

export function providerHealthy(snapshot: ProviderHealthSnapshot): boolean {
  return providerContractValid(snapshot) && snapshot.health.status === 'HEALTHY';
}

export function providerUsable(snapshot: ProviderHealthSnapshot): boolean {
  return providerContractValid(snapshot) && ['HEALTHY', 'DEGRADED'].includes(snapshot.health.status);
}

export function providerHasMarket(snapshot: ProviderHealthSnapshot, market: string): boolean {
  return snapshot.metadata.markets.includes(market);
}

export function providerSource(snapshot: ProviderHealthSnapshot): MarketDataSource {
  return snapshot.metadata.source;
}

export function providerMode(snapshot: ProviderHealthSnapshot): ProviderMode {
  return snapshot.metadata.mode;
}

export function providerStatus(snapshot: ProviderHealthSnapshot): ProviderHealthStatus {
  return snapshot.health.status;
}

export function providerName(snapshot: ProviderHealthSnapshot): string {
  return snapshot.metadata.name;
}

export function providerId(snapshot: ProviderHealthSnapshot): string {
  return snapshot.metadata.id;
}

export function providerMessage(snapshot: ProviderHealthSnapshot): string | null {
  return normalizeString(snapshot.health.message);
}

export function providerHealthCheckedAt(snapshot: ProviderHealthSnapshot): string {
  return snapshot.health.checkedAt;
}

export function providerObservedAt(snapshot: ProviderHealthSnapshot): string {
  return snapshot.observedAt;
}

export function providerHealthContractIssues(snapshot: ProviderHealthSnapshot): readonly string[] {
  return snapshot.contractIssues;
}

export function providerHealthSnapshotSummary(snapshot: ProviderHealthSnapshot): string {
  const issueSuffix = snapshot.contractIssues.length > 0 ? `; issues=${snapshot.contractIssues.join(', ')}` : '';
  return `${snapshot.metadata.id}:${snapshot.health.status}:${snapshot.metadata.mode}${issueSuffix}`;
}

export function providerHealthFreshWithin(
  snapshot: ProviderHealthSnapshot,
  maxAgeMs: number,
  nowMs: number = Date.now(),
): boolean {
  const threshold = normalizePositiveFinite(maxAgeMs);
  const age = providerHealthAgeMs(snapshot, nowMs);
  return threshold !== null && age !== null && age <= threshold;
}

export function providerDataFreshWithin(
  snapshot: ProviderHealthSnapshot,
  maxAgeMs: number,
  nowMs: number = Date.now(),
): boolean {
  const threshold = normalizePositiveFinite(maxAgeMs);
  const age = providerLastDataAgeMs(snapshot, nowMs);
  return threshold !== null && age !== null && age <= threshold;
}
