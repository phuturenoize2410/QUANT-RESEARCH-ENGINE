export const RESEARCH_PIPELINE_STAGE_ORDER = [
  'DATA_PROVIDER',
  'FEATURE_ENGINE',
  'STRATEGY_ENGINE',
  'RISK_EXECUTION',
  'APPLICATION_UI',
] as const;

export type ResearchPipelineStage = typeof RESEARCH_PIPELINE_STAGE_ORDER[number];

const STAGE_INDEX = new Map<ResearchPipelineStage, number>(
  RESEARCH_PIPELINE_STAGE_ORDER.map((stage, index) => [stage, index]),
);

export class ResearchPipelineStageOrderError extends Error {
  constructor(
    readonly from: ResearchPipelineStage,
    readonly to: ResearchPipelineStage,
  ) {
    super(`Invalid research pipeline transition ${from} -> ${to}. Stages must advance exactly one boundary at a time.`);
    this.name = 'ResearchPipelineStageOrderError';
  }
}

/**
 * Canonical architecture policy for the research path.
 *
 * The policy deliberately forbids skipping boundaries (for example Provider -> UI
 * or Strategy -> UI). Future real-data adapters must therefore enter through the
 * provider boundary and execution-capable presentation must pass through the
 * risk/execution boundary first.
 */
export function assertNextResearchPipelineStage(
  from: ResearchPipelineStage,
  to: ResearchPipelineStage,
): void {
  const fromIndex = STAGE_INDEX.get(from);
  const toIndex = STAGE_INDEX.get(to);

  if (fromIndex === undefined || toIndex === undefined || toIndex !== fromIndex + 1) {
    throw new ResearchPipelineStageOrderError(from, to);
  }
}

/**
 * Fail-closed execution eligibility used while the current research pipeline is
 * still provider/feature/strategy oriented. A shortlist is research output, not
 * an executable order, until the Risk/Execution boundary explicitly approves it.
 */
export interface ResearchExecutionEligibility {
  stage: 'RISK_EXECUTION';
  executable: boolean;
  status: 'NOT_EVALUATED' | 'APPROVED' | 'BLOCKED';
  reason: string;
}

export function createUnevaluatedExecutionEligibility(): ResearchExecutionEligibility {
  return Object.freeze({
    stage: 'RISK_EXECUTION' as const,
    executable: false,
    status: 'NOT_EVALUATED' as const,
    reason: 'Strategy output has not passed the canonical Risk/Execution boundary.',
  });
}

export function assertExecutionEligible(eligibility: ResearchExecutionEligibility): void {
  if (eligibility.status !== 'APPROVED' || eligibility.executable !== true) {
    throw new Error(`Execution blocked: ${eligibility.reason}`);
  }
}
