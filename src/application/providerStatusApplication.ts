import type { HealthCheckedProvider, ProviderHealth } from '../engine/dataProviders';
import type { MarketId } from '../engine/market/marketAdapter';
import { getProviderHealthSnapshot } from '../engine/providerHealth';
import { providerHealthEvidenceError } from '../engine/providerHealthPolicy';

export type ProviderDataReadiness = 'RESEARCH_ONLY' | 'READY' | 'CAUTION' | 'BLOCKED';
export type ProviderCapabilityBlockReason = 'UNSUPPORTED' | 'MARKET_UNSUPPORTED' | 'HEALTH_BLOCKED' | 'RESEARCH_ONLY' | null;

function providerStatusMessage(
  readiness: ProviderDataReadiness,
  health: ProviderHealth,
  requestedMarket: MarketId | undefined,
  supportsRequestedMarket: boolean,
  healthEvidenceError: string | null,
): string {
  if (!supportsRequestedMarket) return `Provider does not support requested market ${requestedMarket}. Capability use is blocked.`;
  // Engine-owned trust failures and non-ready health states must dominate
  // adapter-supplied prose. Otherwise a provider can be CAUTION/BLOCKED while
  // still presenting a misleading message such as "ready for trading".
  if (healthEvidenceError) return `Provider health evidence is not trustworthy (${healthEvidenceError}). Capability use is blocked.`;
  if (readiness === 'RESEARCH_ONLY') return 'Synthetic provider available for research only. Not for live trading.';
  if (readiness === 'CAUTION') return 'Provider is degraded. Research may continue only within declared capabilities.';
  if (health.status === 'STALE') return 'Provider data is stale. Capability use is blocked until freshness recovers.';
  if (health.status === 'UNAVAILABLE') return 'Provider is unavailable. Capability use is blocked.';
  if (health.message?.trim()) return health.message.trim();
  return 'Provider is healthy and available for its declared capabilities.';
}

/**
 * Presentation-facing provider status read model.
 *
 * Provider metadata/health semantics remain engine-owned. This application seam
 * is the only shape React should need for status presentation, so future Google
 * Finance/free IDX/broker/paid adapters can be swapped without UI components
 * importing provider implementations or reinterpreting health/freshness rules.
 *
 * Keep presentation flags, provenance labels, market compatibility, capability
 * gates/reasons and data-readiness semantics here: React must not independently
 * decide what provider health or capabilities mean, or weaken MOCK disclosure.
 */
export async function buildProviderStatusReadModel(
  provider: HealthCheckedProvider,
  healthSnapshot?: ProviderHealth,
  nowMs: number = Date.now(),
  requestedMarket?: MarketId,
) {
  const snapshot = await getProviderHealthSnapshot(provider, healthSnapshot, nowMs);
  const healthStatus = snapshot.health.status;
  const isMock = snapshot.metadata.mode === 'MOCK';
  // MOCK providers remain explicitly research-only and may intentionally lack a
  // real sync provenance. Non-mock providers must satisfy the engine-owned
  // evidence policy before application/UI can present any capability as usable.
  const healthEvidenceError = isMock ? null : providerHealthEvidenceError(snapshot.health);
  const supportsRequestedMarket = requestedMarket === undefined
    || snapshot.metadata.supportedMarkets.includes(requestedMarket);
  const healthReadiness: ProviderDataReadiness = isMock
    ? 'RESEARCH_ONLY'
    : healthEvidenceError
      ? 'BLOCKED'
      : healthStatus === 'HEALTHY'
        ? 'READY'
        : healthStatus === 'DEGRADED'
          ? 'CAUTION'
          : 'BLOCKED';
  const marketBlocked = !supportsRequestedMarket;
  const dataReadiness: ProviderDataReadiness = marketBlocked ? 'BLOCKED' : healthReadiness;
  const healthBlocked = healthStatus === 'STALE' || healthStatus === 'UNAVAILABLE' || healthEvidenceError !== null;
  const canServeHistoricalResearch = snapshot.metadata.supportsHistorical && !healthBlocked && !marketBlocked;
  const canServeIntradayResearch = snapshot.metadata.supportsIntraday && !healthBlocked && !marketBlocked;
  const canServeRealtime = !isMock
    && snapshot.metadata.supportsRealtime
    && snapshot.metadata.mode === 'REALTIME'
    && dataReadiness === 'READY'
    && !marketBlocked;
  const historicalBlockReason: ProviderCapabilityBlockReason = canServeHistoricalResearch
    ? null
    : marketBlocked ? 'MARKET_UNSUPPORTED'
      : !snapshot.metadata.supportsHistorical ? 'UNSUPPORTED' : 'HEALTH_BLOCKED';
  const intradayBlockReason: ProviderCapabilityBlockReason = canServeIntradayResearch
    ? null
    : marketBlocked ? 'MARKET_UNSUPPORTED'
      : !snapshot.metadata.supportsIntraday ? 'UNSUPPORTED' : 'HEALTH_BLOCKED';
  const realtimeBlockReason: ProviderCapabilityBlockReason = canServeRealtime
    ? null
    : marketBlocked ? 'MARKET_UNSUPPORTED'
      : isMock ? 'RESEARCH_ONLY'
        : !snapshot.metadata.supportsRealtime || snapshot.metadata.mode !== 'REALTIME' ? 'UNSUPPORTED'
          : 'HEALTH_BLOCKED';

  return Object.freeze({
    provider: snapshot.metadata,
    health: snapshot.health,
    capturedAt: snapshot.capturedAt,
    requestedMarket: requestedMarket ?? null,
    supportsRequestedMarket,
    marketBlockReason: marketBlocked ? 'MARKET_UNSUPPORTED' as const : null,
    isMock,
    isPaid: snapshot.metadata.isPaid,
    isRealTime: snapshot.metadata.supportsRealtime && snapshot.metadata.mode === 'REALTIME',
    isHealthy: healthStatus === 'HEALTHY' && healthEvidenceError === null,
    requiresAttention: healthStatus !== 'HEALTHY' || healthEvidenceError !== null || marketBlocked,
    isUnavailable: healthStatus === 'UNAVAILABLE',
    isStale: healthStatus === 'STALE',
    dataReadiness,
    statusMessage: providerStatusMessage(dataReadiness, snapshot.health, requestedMarket, supportsRequestedMarket, healthEvidenceError),
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
