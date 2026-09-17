import { ProviderHealthStatus } from './dataProviders';
import {
  ResearchExecutionEligibility,
  createApprovedExecutionEligibility,
  createBlockedExecutionEligibility,
} from './researchPipelineStagePolicy';

/**
 * Minimum evidence required before research output can become execution-eligible.
 * Provider health uses the canonical provider-boundary status rather than a
 * duplicated boolean so DEGRADED/STALE/UNAVAILABLE cannot be collapsed upstream.
 */
export interface ResearchExecutionEvidence {
  readonly dataMode: 'MOCK' | 'REAL';
  readonly providerHealthStatus: ProviderHealthStatus;
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

  if (evidence.providerHealthStatus !== 'HEALTHY') {
    return createBlockedExecutionEligibility(
      `Execution blocked: provider health is ${evidence.providerHealthStatus}; HEALTHY is required.`,
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
    'Canonical Risk/Execution policy approved REAL research with HEALTHY provider status, validated backtest edge, and passed risk checks.',
  );
}
