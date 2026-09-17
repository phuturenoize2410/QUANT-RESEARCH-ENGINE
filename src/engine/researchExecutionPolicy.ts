import { ProviderHealth } from './dataProviders';
import { providerHealthEvidenceError } from './providerHealthPolicy';
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
