import type { HealthCheckedProvider, ProviderHealth } from '../engine/dataProviders';
import { getProviderHealthSnapshot } from '../engine/providerHealth';

export type ProviderDataReadiness = 'RESEARCH_ONLY' | 'READY' | 'CAUTION' | 'BLOCKED';

/**
 * Presentation-facing provider status read model.
 *
 * Provider metadata/health semantics remain engine-owned. This application seam
 * is the only shape React should need for status presentation, so future Google
 * Finance/free IDX/broker/paid adapters can be swapped without UI components
 * importing provider implementations or reinterpreting health/freshness rules.
 *
 * Keep presentation flags, provenance labels and data-readiness semantics here:
 * React must not independently decide what HEALTHY/DEGRADED/STALE/UNAVAILABLE
 * means or weaken MOCK/synthetic disclosure when rendering provider state.
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
    dataDisclosure: isMock
      ? 'MOCK / SYNTHETIC DATA — NOT FOR LIVE TRADING'
      : `${snapshot.metadata.mode} DATA — ${snapshot.metadata.source}`,
  });
}

export type ProviderStatusReadModel = Awaited<ReturnType<typeof buildProviderStatusReadModel>>;
