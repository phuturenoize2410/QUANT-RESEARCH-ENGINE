import { ProviderMetadata } from './dataProviders';
import {
  ProviderReadiness,
  ProviderStatusSnapshot,
  ResearchUseCase,
} from './providerPolicy';

export class ProviderReadinessError extends Error {
  readonly status: ProviderStatusSnapshot;
  readonly provider: ProviderMetadata;
  readonly useCase: ResearchUseCase;
  readonly readiness: ProviderReadiness;

  constructor(status: ProviderStatusSnapshot, useCase: ResearchUseCase) {
    const readiness = status.readiness[useCase];
    const marketContext = status.targetMarket
      ? ` for target market ${status.targetMarket}`
      : '';
    const reasons = readiness.reasons.length > 0
      ? ` ${readiness.reasons.join(' ')}`
      : '';

    super(
      `Provider ${status.metadata.name} is not ready for ${useCase}${marketContext}.` +
      `${reasons} Pipeline rejected before data ingestion.`,
    );

    this.name = 'ProviderReadinessError';
    // Preserve the canonical policy snapshot that caused the rejection. Future
    // UI/telemetry consumers can inspect health, capture time, target market,
    // readiness reasons and warnings without re-running or duplicating policy.
    this.status = status;
    this.provider = status.metadata;
    this.useCase = useCase;
    this.readiness = readiness;
  }
}

/**
 * Canonical enforcement boundary for provider suitability.
 *
 * ProviderPolicy owns the suitability decision; orchestration, strategy and UI
 * consumers should enforce that decision through this gate instead of rebuilding
 * market, freshness or capability rules locally. Keeping the thrown error typed
 * and carrying the original ProviderStatusSnapshot gives downstream status
 * surfaces a stable, vendor-neutral failure contract without re-evaluating policy.
 */
export function assertProviderReady(
  status: ProviderStatusSnapshot,
  useCase: ResearchUseCase,
): ProviderReadiness {
  const readiness = status.readiness[useCase];
  if (!readiness.allowed) {
    throw new ProviderReadinessError(status, useCase);
  }

  return readiness;
}
