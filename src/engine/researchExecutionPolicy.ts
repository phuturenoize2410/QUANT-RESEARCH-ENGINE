import { ProviderHealth } from './dataProviders';
import {
  ResearchExecutionEligibility,
  createApprovedExecutionEligibility,
  createBlockedExecutionEligibility,
} from './researchPipelineStagePolicy';

/**
 * Minimum evidence required before research output can become execution-eligible.
 * Provider health crosses the boundary as the canonical observation rather than a
 * duplicated status scalar, preserving timestamp/freshness evidence for future
 * free or paid adapters and preventing downstream layers from discarding it.
 */
export interface ResearchExecutionEvidence {
  readonly dataMode: 'MOCK' | 'REAL';
  readonly providerHealth: ProviderHealth;
  readonly backtestEdgeValidated: boolean;
  readonly riskChecksPassed: boolean;
}

function providerHealthEvidenceError(providerHealth: ProviderHealth): string | null {
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

/** Canonical fail-closed evaluator for the research -> execution transition. */
export function evaluateResearchExecutionEligibility(
  evidence: ResearchExecutionEvidence,
): ResearchExecutionEligibility {
  if (evidence.dataMode !== 'REAL') {
    return createBlockedExecutionEligibility(
      'Execution blocked: research uses MOCK data and is not eligible for live execution.',
    );
  }

  const healthEvidenceError = providerHealthEvidenceError(evidence.providerHealth);
  if (healthEvidenceError) {
    return createBlockedExecutionEligibility(`Execution blocked: ${healthEvidenceError}.`);
  }

  if (evidence.providerHealth.status !== 'HEALTHY') {
    return createBlockedExecutionEligibility(
      `Execution blocked: provider health is ${evidence.providerHealth.status}; HEALTHY is required.`,
    );
  }

  if (!evidence.backtestEdgeValidated) {
    return createBlockedExecutionEligibility(
      'Execution blocked: robust backtest edge has not been validated.',
    );
  }

  if (!evidence.riskChecksPassed) {
    return createBlockedExecutionEligibility(
      'Execution blocked: canonical risk checks have not passed.',
    );
  }

  return createApprovedExecutionEligibility(
    'Canonical Risk/Execution policy approved REAL research with timestamped, freshness-consistent HEALTHY provider evidence, validated backtest edge, and passed risk checks.',
  );
}
