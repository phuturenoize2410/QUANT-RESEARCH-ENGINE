import type { ResearchExecutionEligibility } from '../engine/researchPipelineStagePolicy';
import {
  assertNextResearchPipelineStage,
  createUnevaluatedExecutionEligibility,
} from '../engine/researchPipelineStagePolicy';

/**
 * Presentation-safe envelope for Strategy Engine output.
 *
 * This boundary deliberately does not approve execution. It records that strategy
 * output has arrived at Risk/Execution and keeps it fail-closed until a canonical
 * risk/execution evaluator explicitly replaces NOT_EVALUATED with an approval.
 */
export interface ResearchRiskExecutionEnvelope<TStrategyOutput> {
  strategyOutput: TStrategyOutput;
  executionEligibility: ResearchExecutionEligibility;
}

export function enterResearchRiskExecutionBoundary<TStrategyOutput>(
  strategyOutput: TStrategyOutput,
): ResearchRiskExecutionEnvelope<TStrategyOutput> {
  assertNextResearchPipelineStage('STRATEGY_ENGINE', 'RISK_EXECUTION');

  return Object.freeze({
    strategyOutput,
    executionEligibility: createUnevaluatedExecutionEligibility(),
  });
}

/**
 * Application/UI may inspect research output, but this function never upgrades
 * execution eligibility. Approval belongs to the canonical Risk/Execution engine.
 */
export function exposeResearchToPresentation<TStrategyOutput>(
  envelope: ResearchRiskExecutionEnvelope<TStrategyOutput>,
): ResearchRiskExecutionEnvelope<TStrategyOutput> {
  assertNextResearchPipelineStage('RISK_EXECUTION', 'APPLICATION_UI');
  return envelope;
}
