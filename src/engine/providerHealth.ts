import {
  canonicalProviderMarketIds,
  isInherentlyFreeMarketDataSource,
  isMarketDataSource,
  isProviderHealthStatus,
  isProviderMode,
} from './providerContracts';
import type {
  HealthCheckedProvider,
  MarketDataSource,
  ProviderHealth,
  ProviderMetadata,
  ProviderMode,
} from './providerContracts';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_DATE_MS = 8.64e15;

function normalizeObservationClock(value: unknown): { nowMs: number; valid: boolean } {
  if (typeof value === 'number' && Number.isFinite(value) && value >= -MAX_DATE_MS && value <= MAX_DATE_MS) return { nowMs: value, valid: true };
  return { nowMs: 0, valid: false };
}
function parseTimestamp(value: unknown): number | undefined { if (typeof value !== 'string' || !value.trim()) return undefined; const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : undefined; }
function canonicalTimestamp(value: unknown): string | undefined { const parsed = parseTimestamp(value); return parsed === undefined ? undefined : new Date(parsed).toISOString(); }
function normalizeNonNegativeFinite(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined; }
function canonicalHealthMessage(value: unknown): string | undefined { if (typeof value !== 'string') return undefined; const trimmed = value.trim(); return trimmed || undefined; }
function appendMessage(base: string | undefined, detail: string): string { return base ? `${base} ${detail}` : detail; }
function degradeHealth(health: ProviderHealth, detail: string): ProviderHealth { return health.status === 'UNAVAILABLE' || health.status === 'STALE' ? { ...health, message: appendMessage(health.message, detail) } : { ...health, status: 'DEGRADED', message: appendMessage(health.message, detail) }; }
function failHealthClosed(health: ProviderHealth, detail: string): ProviderHealth { return { ...health, status: 'UNAVAILABLE', message: appendMessage(health.message, detail) }; }
function providerErrorMessage(error: unknown): string { if (error instanceof Error && error.message.trim()) return error.message.trim(); if (typeof error === 'string' && error.trim()) return error.trim(); return 'Unknown provider health-check failure.'; }

export function normalizeProviderHealth(health: ProviderHealth, nowMs: number = Date.now()): ProviderHealth {
  const observationClock = normalizeObservationClock(nowMs); const effectiveNowMs = observationClock.nowMs;
  const isHealthObject = Boolean(health) && typeof health === 'object' && !Array.isArray(health);
  if (!isHealthObject) {
    const malformed: ProviderHealth = { status: 'UNAVAILABLE', checkedAt: new Date(observationClock.nowMs).toISOString(), message: 'Provider health payload is malformed; expected an object.' };
    return observationClock.valid ? malformed : failHealthClosed(malformed, 'Provider observation clock is invalid.');
  }
  const runtimeHealth = health as ProviderHealth & { status?: unknown; checkedAt?: unknown; lastSuccessfulSyncAt?: unknown; latencyMs?: unknown; staleAfterSeconds?: unknown; message?: unknown };
  const reportedStatus = runtimeHealth.status; const hasValidStatus = isProviderHealthStatus(reportedStatus);
  const checkedAtMs = parseTimestamp(runtimeHealth.checkedAt); const lastSuccessfulSyncMs = parseTimestamp(runtimeHealth.lastSuccessfulSyncAt); const canonicalMessage = canonicalHealthMessage(runtimeHealth.message);
  // Reconstruct the provider-neutral health contract explicitly. Concrete adapters may
  // attach vendor diagnostics or mutable transport state; downstream engine layers must
  // only observe canonical health evidence.
  let normalized: ProviderHealth = { status: hasValidStatus ? reportedStatus : 'UNAVAILABLE', checkedAt: canonicalTimestamp(runtimeHealth.checkedAt) ?? '', lastSuccessfulSyncAt: canonicalTimestamp(runtimeHealth.lastSuccessfulSyncAt), latencyMs: normalizeNonNegativeFinite(runtimeHealth.latencyMs), staleAfterSeconds: normalizeNonNegativeFinite(runtimeHealth.staleAfterSeconds), message: canonicalMessage };
  if (!hasValidStatus) normalized = { ...normalized, message: appendMessage(normalized.message, `Invalid provider health status "${String(reportedStatus)}"; failing closed as UNAVAILABLE.`) };
  if (runtimeHealth.message !== undefined && canonicalMessage === undefined) normalized = degradeHealth(normalized, 'Invalid provider health message ignored.');
  if (runtimeHealth.latencyMs !== undefined && normalized.latencyMs === undefined) normalized = degradeHealth(normalized, 'Invalid provider latency metadata ignored.');
  if (runtimeHealth.staleAfterSeconds !== undefined && normalized.staleAfterSeconds === undefined) normalized = degradeHealth(normalized, 'Invalid freshness threshold ignored.');
  if (!observationClock.valid) return failHealthClosed(normalized, 'Provider observation clock is invalid.');
  if (checkedAtMs === undefined) normalized = failHealthClosed(normalized, 'Provider health check timestamp is invalid.'); else if (checkedAtMs > effectiveNowMs + MAX_CLOCK_SKEW_MS) normalized = failHealthClosed(normalized, 'Provider health check timestamp is unexpectedly in the future.');
  if (normalized.status === 'UNAVAILABLE') return normalized;
  const staleAfterSeconds = normalized.staleAfterSeconds;
  if (runtimeHealth.lastSuccessfulSyncAt !== undefined && lastSuccessfulSyncMs === undefined) normalized = degradeHealth(normalized, 'Last successful sync timestamp is invalid.');
  if (lastSuccessfulSyncMs !== undefined && lastSuccessfulSyncMs > effectiveNowMs + MAX_CLOCK_SKEW_MS) normalized = degradeHealth(normalized, 'Last successful sync timestamp is unexpectedly in the future.');
  if (checkedAtMs !== undefined && lastSuccessfulSyncMs !== undefined && lastSuccessfulSyncMs > checkedAtMs + MAX_CLOCK_SKEW_MS) normalized = degradeHealth(normalized, 'Last successful sync timestamp is later than the provider health check timestamp.');
  if (staleAfterSeconds !== undefined && lastSuccessfulSyncMs === undefined) normalized = degradeHealth(normalized, 'Freshness threshold is declared but last successful sync time is unavailable.');
  if (lastSuccessfulSyncMs !== undefined && staleAfterSeconds !== undefined && effectiveNowMs - lastSuccessfulSyncMs > staleAfterSeconds * 1000) return { ...normalized, status: 'STALE', message: appendMessage(normalized.message, 'Freshness threshold exceeded.') };
  return normalized;
}

export async function captureProviderHealth(provider: HealthCheckedProvider, nowMs: number = Date.now()): Promise<ProviderHealth> {
  const observationClock = normalizeObservationClock(nowMs);
  try { return normalizeProviderHealth(await provider.getHealth(), nowMs); } catch (error) { const baseMessage = `Provider health check failed: ${providerErrorMessage(error)}`; return { status: 'UNAVAILABLE', checkedAt: new Date(observationClock.nowMs).toISOString(), message: observationClock.valid ? baseMessage : appendMessage(baseMessage, 'Provider observation clock is invalid.') }; }
}
function canonicalMetadataText(value: unknown): string | undefined { if (typeof value !== 'string') return undefined; const trimmed = value.trim(); return trimmed || undefined; }

function snapshotProviderMetadata(metadata: ProviderMetadata): { metadata: ProviderMetadata; issues: string[] } {
  const isMetadataObject = Boolean(metadata) && typeof metadata === 'object' && !Array.isArray(metadata);
  const runtimeMetadata = (isMetadataObject ? metadata : {}) as ProviderMetadata & { id?: unknown; name?: unknown; source?: unknown; mode?: unknown; isPaid?: unknown; supportedMarkets?: unknown; supportsHistorical?: unknown; supportsIntraday?: unknown; supportsRealtime?: unknown; notes?: unknown };
  const issues: string[] = []; if (!isMetadataObject) issues.push('metadata');
  const id = canonicalMetadataText(runtimeMetadata.id); const name = canonicalMetadataText(runtimeMetadata.name); const notes = runtimeMetadata.notes === undefined ? undefined : canonicalMetadataText(runtimeMetadata.notes);
  const hasValidSource = isMarketDataSource(runtimeMetadata.source); const hasValidMode = isProviderMode(runtimeMetadata.mode); const hasValidPaidFlag = typeof runtimeMetadata.isPaid === 'boolean';
  const hasValidHistoricalCapability = typeof runtimeMetadata.supportsHistorical === 'boolean'; const hasValidIntradayCapability = typeof runtimeMetadata.supportsIntraday === 'boolean'; const hasValidRealtimeCapability = typeof runtimeMetadata.supportsRealtime === 'boolean';
  if (!id) issues.push('id'); if (!name) issues.push('name'); if (!hasValidSource) issues.push('source'); if (!hasValidMode) issues.push('mode'); if (!hasValidPaidFlag) issues.push('isPaid');
  if (hasValidSource && hasValidPaidFlag && runtimeMetadata.isPaid && isInherentlyFreeMarketDataSource(runtimeMetadata.source)) issues.push('source/isPaid');
  if (!hasValidHistoricalCapability) issues.push('supportsHistorical'); if (!hasValidIntradayCapability) issues.push('supportsIntraday'); if (!hasValidRealtimeCapability) issues.push('supportsRealtime'); if (runtimeMetadata.notes !== undefined && notes === undefined) issues.push('notes');
  if (hasValidMode && hasValidRealtimeCapability && (runtimeMetadata.mode === 'REALTIME') !== runtimeMetadata.supportsRealtime) issues.push('mode/supportsRealtime');
  if (hasValidRealtimeCapability && hasValidIntradayCapability && runtimeMetadata.supportsRealtime && !runtimeMetadata.supportsIntraday) issues.push('supportsRealtime/supportsIntraday');
  if (hasValidMode && hasValidIntradayCapability && runtimeMetadata.mode === 'EOD' && runtimeMetadata.supportsIntraday) issues.push('mode/supportsIntraday');
  if (hasValidSource && hasValidMode && (runtimeMetadata.source === 'MOCK_ENGINE') !== (runtimeMetadata.mode === 'MOCK')) issues.push('source/mode');
  const supportedMarkets = canonicalProviderMarketIds(runtimeMetadata.supportedMarkets);
  if (!supportedMarkets.isValid) issues.push('supportedMarkets');
  const hasMalformedContract = issues.length > 0;
  // Reconstruct the canonical contract explicitly instead of spreading provider-owned
  // metadata. Concrete adapters may carry vendor credentials, caches or mutable
  // diagnostics; none of those belong in provider-neutral downstream evidence.
  const safeMetadata: ProviderMetadata = isMetadataObject ? { id: id ?? '', name: name ?? '', source: hasMalformedContract ? 'MOCK_ENGINE' : runtimeMetadata.source as MarketDataSource, mode: hasMalformedContract ? 'MOCK' : runtimeMetadata.mode as ProviderMode, isPaid: hasMalformedContract ? false : runtimeMetadata.isPaid as boolean, notes, supportedMarkets: Object.freeze([...supportedMarkets.markets]), supportsHistorical: hasMalformedContract ? false : runtimeMetadata.supportsHistorical as boolean, supportsIntraday: hasMalformedContract ? false : runtimeMetadata.supportsIntraday as boolean, supportsRealtime: hasMalformedContract ? false : runtimeMetadata.supportsRealtime as boolean } : { id: '', name: '', source: 'MOCK_ENGINE', mode: 'MOCK', isPaid: false, supportedMarkets: Object.freeze([]), supportsHistorical: false, supportsIntraday: false, supportsRealtime: false };
  return { metadata: Object.freeze(safeMetadata), issues };
}
function snapshotProviderHealth(health: ProviderHealth): ProviderHealth { return Object.freeze({ status: health.status, checkedAt: health.checkedAt, lastSuccessfulSyncAt: health.lastSuccessfulSyncAt, latencyMs: health.latencyMs, staleAfterSeconds: health.staleAfterSeconds, message: health.message }); }
export interface ProviderHealthSnapshot { metadata: ProviderMetadata; health: ProviderHealth; capturedAt: string; }
export async function getProviderHealthSnapshot(provider: HealthCheckedProvider, healthSnapshot?: ProviderHealth, nowMs: number = Date.now()): Promise<ProviderHealthSnapshot> {
  const observationClock = normalizeObservationClock(nowMs); const isProviderObject = Boolean(provider) && typeof provider === 'object' && !Array.isArray(provider); const runtimeProvider = (isProviderObject ? provider : {}) as Partial<HealthCheckedProvider> & { metadata?: unknown; getHealth?: unknown }; const hasHealthCheck = typeof runtimeProvider.getHealth === 'function'; const capturedMetadata = snapshotProviderMetadata(runtimeProvider.metadata as ProviderMetadata); const hasInjectedHealthSnapshot = healthSnapshot !== undefined;
  let health = hasInjectedHealthSnapshot ? normalizeProviderHealth(healthSnapshot as ProviderHealth, nowMs) : hasHealthCheck ? await captureProviderHealth(provider, nowMs) : normalizeProviderHealth({ status: 'UNAVAILABLE', checkedAt: new Date(observationClock.nowMs).toISOString(), message: 'Provider contract is malformed; expected an object with getHealth().' }, nowMs);
  if (!isProviderObject || !hasHealthCheck) health = failHealthClosed(health, 'Invalid provider root contract; failing closed as UNAVAILABLE.');
  if (capturedMetadata.issues.length > 0) health = failHealthClosed(health, `Invalid provider metadata fields: ${capturedMetadata.issues.join(', ')}; failing closed as UNAVAILABLE.`);
  return Object.freeze({ metadata: capturedMetadata.metadata, health: snapshotProviderHealth(health), capturedAt: new Date(observationClock.nowMs).toISOString() });
}
