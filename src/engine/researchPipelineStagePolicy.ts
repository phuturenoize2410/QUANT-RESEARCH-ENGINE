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
  readonly stage: 'RISK_EXECUTION';
  readonly executable: boolean;
  readonly status: 'NOT_EVALUATED' | 'APPROVED' | 'BLOCKED';
  readonly reason: string;
}

// Runtime provenance for canonical approvals. TypeScript interfaces are structural,
// so a presentation/application consumer could otherwise forge an APPROVED-shaped
// object. WeakSet membership makes assertExecutionEligible fail closed unless the
// approval was actually issued by this Risk/Execution policy boundary.
const CANONICAL_EXECUTION_APPROVALS = new WeakSet<object>();

export function createUnevaluatedExecutionEligibility(): ResearchExecutionEligibility {
  return Object.freeze({
    stage: 'RISK_EXECUTION' as const,
    executable: false,
    status: 'NOT_EVALUATED' as const,
    reason: 'Strategy output has not passed the canonical Risk/Execution boundary.',
  });
}

/**
 * Issue execution approval from the canonical Risk/Execution boundary.
 * Callers must supply a non-empty policy reason so approval remains auditable.
 * This does not itself implement portfolio/risk rules; those evaluators must call
 * this only after their checks pass.
 */
export function createApprovedExecutionEligibility(reason: string): ResearchExecutionEligibility {
  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new Error('Execution approval requires a canonical Risk/Execution policy reason.');
  }

  const approval = Object.freeze({
    stage: 'RISK_EXECUTION' as const,
    executable: true,
    status: 'APPROVED' as const,
    reason: normalizedReason,
  });
  CANONICAL_EXECUTION_APPROVALS.add(approval);
  return approval;
}

export function createBlockedExecutionEligibility(reason: string): ResearchExecutionEligibility {
  const normalizedReason = reason.trim() || 'Canonical Risk/Execution policy blocked the candidate.';
  return Object.freeze({
    stage: 'RISK_EXECUTION' as const,
    executable: false,
    status: 'BLOCKED' as const,
    reason: normalizedReason,
  });
}

export function assertExecutionEligible(eligibility: ResearchExecutionEligibility): void {
  if (
    eligibility.status !== 'APPROVED' ||
    eligibility.executable !== true ||
    !CANONICAL_EXECUTION_APPROVALS.has(eligibility)
  ) {
    throw new Error(`Execution blocked: ${eligibility.reason}`);
  }
}
