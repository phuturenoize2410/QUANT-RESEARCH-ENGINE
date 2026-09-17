import {
  ResearchExecutionEligibility,
  createApprovedExecutionEligibility,
  createBlockedExecutionEligibility,
} from './researchPipelineStagePolicy';

/**
 * Minimum evidence required before research output can become execution-eligible.
 * This contract deliberately separates data provenance, demonstrated edge, and
 * risk approval so no single UI/strategy flag can promote a candidate.
 */
export interface ResearchExecutionEvidence {
  readonly dataMode: 'MOCK' | 'REAL';
  readonly providerHealthy: boolean;
  readonly backtestEdgeValidated: boolean;
  readonly riskChecksPassed: boolean;
}

/**
 * Canonical fail-closed evaluator for the research -> execution transition.
 *
 * MOCK data can never produce executable approval. REAL data is also insufficient
 * by itself: provider health, validated backtest edge, and risk checks must all
 * pass. This keeps future free/paid provider integrations from silently becoming
 * an execution shortcut before the research case is demonstrated.
 */
export function evaluateResearchExecutionEligibility(
  evidence: ResearchExecutionEvidence,
): ResearchExecutionEligibility {
  if (evidence.dataMode !== 'REAL') {
    return createBlockedExecutionEligibility(
      'Execution blocked: research uses MOCK data and is not eligible for live execution.',
    );
  }

  if (!evidence.providerHealthy) {
    return createBlockedExecutionEligibility(
      'Execution blocked: real-data provider health is not confirmed.',
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
    'Canonical Risk/Execution policy approved REAL healthy-provider research with validated backtest edge and passed risk checks.',
  );
}
