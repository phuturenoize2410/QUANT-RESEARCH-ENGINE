export const RESEARCH_PIPELINE_STAGE_ORDER = [
  'DATA_PROVIDER',
  'FEATURE_ENGINE',
  'STRATEGY_ENGINE',
  'RISK_EXECUTION',
  'APPLICATION_UI',
] as const;

export type ResearchPipelineStage = typeof RESEARCH_PIPELINE_STAGE_ORDER[number];

/** Canonical runtime guard for stage values crossing adapter/application boundaries. */
export function isResearchPipelineStage(value: unknown): value is ResearchPipelineStage {
  return typeof value === 'string'
    && (RESEARCH_PIPELINE_STAGE_ORDER as readonly string[]).includes(value);
}

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

export const RESEARCH_EXECUTION_ELIGIBILITY_STATUSES = [
  'NOT_EVALUATED',
  'APPROVED',
  'BLOCKED',
] as const;

export type ResearchExecutionEligibilityStatus = typeof RESEARCH_EXECUTION_ELIGIBILITY_STATUSES[number];

export function isResearchExecutionEligibilityStatus(
  value: unknown,
): value is ResearchExecutionEligibilityStatus {
  return typeof value === 'string'
    && (RESEARCH_EXECUTION_ELIGIBILITY_STATUSES as readonly string[]).includes(value);
}

export interface ResearchExecutionEligibility {
  readonly stage: 'RISK_EXECUTION';
  readonly executable: boolean;
  readonly status: ResearchExecutionEligibilityStatus;
  readonly reason: string;
}

/**
 * Structural guard for execution eligibility crossing application/UI boundaries.
 * Approval provenance is intentionally NOT established here; assertExecutionEligible
 * remains the authority for executable approval.
 */
export function isResearchExecutionEligibility(value: unknown): value is ResearchExecutionEligibility {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.stage !== 'RISK_EXECUTION'
    || !isResearchExecutionEligibilityStatus(candidate.status)
    || typeof candidate.executable !== 'boolean'
    || typeof candidate.reason !== 'string'
    || candidate.reason.trim().length === 0
  ) return false;

  if (candidate.status === 'APPROVED') return candidate.executable === true;
  return candidate.executable === false;
}

const CANONICAL_EXECUTION_APPROVALS = new WeakSet<object>();

export function createUnevaluatedExecutionEligibility(): ResearchExecutionEligibility {
  return Object.freeze({
    stage: 'RISK_EXECUTION' as const,
    executable: false,
    status: 'NOT_EVALUATED' as const,
    reason: 'Strategy output has not passed the canonical Risk/Execution boundary.',
  });
}

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

export function assertExecutionEligible(eligibility: unknown): asserts eligibility is ResearchExecutionEligibility {
  if (!isResearchExecutionEligibility(eligibility)) {
    throw new Error('Execution blocked: malformed Risk/Execution eligibility payload.');
  }

  if (
    eligibility.status !== 'APPROVED'
    || eligibility.executable !== true
    || !CANONICAL_EXECUTION_APPROVALS.has(eligibility)
  ) {
    throw new Error(`Execution blocked: ${eligibility.reason}`);
  }
}
