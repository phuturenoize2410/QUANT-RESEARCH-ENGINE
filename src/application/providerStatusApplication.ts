import type { HealthCheckedProvider, ProviderHealth } from '../engine/dataProviders';
import { getProviderHealthSnapshot } from '../engine/providerHealth';

export type ProviderDataReadiness = 'RESEARCH_ONLY' | 'READY' | 'CAUTION' | 'BLOCKED';
export type ProviderCapabilityBlockReason = 'UNSUPPORTED' | 'HEALTH_BLOCKED' | 'RESEARCH_ONLY' | null;

function providerStatusMessage(
  readiness: ProviderDataReadiness,
  health: ProviderHealth,
): string {
  if (health.message?.trim()) return health.message.trim();
  if (readiness === 'RESEARCH_ONLY') return 'Synthetic provider available for research only. Not for live trading.';
  if (readiness === 'READY') return 'Provider is healthy and available for its declared capabilities.';
  if (readiness === 'CAUTION') return 'Provider is degraded. Research may continue only within declared capabilities.';
  if (health.status === 'STALE') return 'Provider data is stale. Capability use is blocked until freshness recovers.';
  return 'Provider is unavailable. Capability use is blocked.';
}

/**
 * Presentation-facing provider status read model.
 *
 * Provider metadata/health semantics remain engine-owned. This application seam
 * is the only shape React should need for status presentation, so future Google
 * Finance/free IDX/broker/paid adapters can be swapped without UI components
 * importing provider implementations or reinterpreting health/freshness rules.
 *
 * Keep presentation flags, provenance labels, capability gates/reasons and
 * data-readiness semantics here: React must not independently decide what
 * provider health or capabilities mean, or weaken MOCK/synthetic disclosure.
 */
export async function buildProviderStatusReadModel(
  provider: HealthCheckedProvider,
  healthSnapshot?: ProviderHealth,
  nowMs: number = Date.now(),
) {
  const snapshot = await getProviderHealthSnapshot(provider, healthSnapshot, nowMs);
  const healthStatus = snapshot.health.status;
  const isMock = snapshot.metadata.mode === 'MOCK';
  const dataReadiness: ProviderDataReadiness = isMock
    ? 'RESEARCH_ONLY'
    : healthStatus === 'HEALTHY'
      ? 'READY'
      : healthStatus === 'DEGRADED'
        ? 'CAUTION'
        : 'BLOCKED';
  const healthBlocked = healthStatus === 'STALE' || healthStatus === 'UNAVAILABLE';
  const canServeHistoricalResearch = snapshot.metadata.supportsHistorical && !healthBlocked;
  const canServeIntradayResearch = snapshot.metadata.supportsIntraday && !healthBlocked;
  const canServeRealtime = !isMock
    && snapshot.metadata.supportsRealtime
    && snapshot.metadata.mode === 'REALTIME'
    && dataReadiness === 'READY';
  const historicalBlockReason: ProviderCapabilityBlockReason = canServeHistoricalResearch
    ? null
    : !snapshot.metadata.supportsHistorical ? 'UNSUPPORTED' : 'HEALTH_BLOCKED';
  const intradayBlockReason: ProviderCapabilityBlockReason = canServeIntradayResearch
    ? null
    : !snapshot.metadata.supportsIntraday ? 'UNSUPPORTED' : 'HEALTH_BLOCKED';
  const realtimeBlockReason: ProviderCapabilityBlockReason = canServeRealtime
    ? null
    : isMock ? 'RESEARCH_ONLY'
      : !snapshot.metadata.supportsRealtime || snapshot.metadata.mode !== 'REALTIME' ? 'UNSUPPORTED'
        : 'HEALTH_BLOCKED';

  return Object.freeze({
    provider: snapshot.metadata,
    health: snapshot.health,
    capturedAt: snapshot.capturedAt,
    isMock,
    isPaid: snapshot.metadata.isPaid,
    isRealTime: snapshot.metadata.supportsRealtime && snapshot.metadata.mode === 'REALTIME',
    isHealthy: healthStatus === 'HEALTHY',
    requiresAttention: healthStatus !== 'HEALTHY',
    isUnavailable: healthStatus === 'UNAVAILABLE',
    isStale: healthStatus === 'STALE',
    dataReadiness,
    statusMessage: providerStatusMessage(dataReadiness, snapshot.health),
    canServeHistoricalResearch,
    canServeIntradayResearch,
    canServeRealtime,
    historicalBlockReason,
    intradayBlockReason,
    realtimeBlockReason,
    dataDisclosure: isMock
      ? 'MOCK / SYNTHETIC DATA — NOT FOR LIVE TRADING'
      : `${snapshot.metadata.mode} DATA — ${snapshot.metadata.source}`,
  });
}

export type ProviderStatusReadModel = Awaited<ReturnType<typeof buildProviderStatusReadModel>>;
