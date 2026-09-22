import assert from 'node:assert/strict';
import {
  RESEARCH_PIPELINE_STAGE_ORDER,
  RESEARCH_EXECUTION_ELIGIBILITY_STATUSES,
  ResearchPipelineStageOrderError,
  isResearchPipelineStage,
  isResearchExecutionEligibilityStatus,
  assertNextResearchPipelineStage,
  createUnevaluatedExecutionEligibility,
  createApprovedExecutionEligibility,
  createBlockedExecutionEligibility,
  assertExecutionEligible,
} from '../src/engine/researchPipelineStagePolicy';

assert.deepEqual(RESEARCH_PIPELINE_STAGE_ORDER, [
  'DATA_PROVIDER',
  'FEATURE_ENGINE',
  'STRATEGY_ENGINE',
  'RISK_EXECUTION',
  'APPLICATION_UI',
]);

assert.equal(
  new Set(RESEARCH_PIPELINE_STAGE_ORDER).size,
  RESEARCH_PIPELINE_STAGE_ORDER.length,
  'Canonical pipeline stage vocabulary must not contain duplicates.',
);
for (const stage of RESEARCH_PIPELINE_STAGE_ORDER) {
  assert.equal(isResearchPipelineStage(stage), true, `Canonical stage ${stage} must pass its runtime guard.`);
}
for (const invalidStage of [undefined, null, '', 'PROVIDER', 'UI', 'DATA_PROVIDER ']) {
  assert.equal(
    isResearchPipelineStage(invalidStage),
    false,
    `Non-canonical stage ${String(invalidStage)} must fail closed at the runtime boundary.`,
  );
}

assert.deepEqual(RESEARCH_EXECUTION_ELIGIBILITY_STATUSES, [
  'NOT_EVALUATED',
  'APPROVED',
  'BLOCKED',
]);
assert.equal(
  new Set(RESEARCH_EXECUTION_ELIGIBILITY_STATUSES).size,
  RESEARCH_EXECUTION_ELIGIBILITY_STATUSES.length,
  'Canonical execution-eligibility status vocabulary must not contain duplicates.',
);
for (const status of RESEARCH_EXECUTION_ELIGIBILITY_STATUSES) {
  assert.equal(
    isResearchExecutionEligibilityStatus(status),
    true,
    `Canonical execution-eligibility status ${status} must pass its runtime guard.`,
  );
}
for (const invalidStatus of [undefined, null, '', 'PENDING', 'EXECUTABLE', 'APPROVED ']) {
  assert.equal(
    isResearchExecutionEligibilityStatus(invalidStatus),
    false,
    `Non-canonical execution-eligibility status ${String(invalidStatus)} must fail closed at the runtime boundary.`,
  );
}

for (let index = 0; index < RESEARCH_PIPELINE_STAGE_ORDER.length - 1; index += 1) {
  assert.doesNotThrow(() => assertNextResearchPipelineStage(
    RESEARCH_PIPELINE_STAGE_ORDER[index],
    RESEARCH_PIPELINE_STAGE_ORDER[index + 1],
  ));
}

assert.throws(
  () => assertNextResearchPipelineStage('DATA_PROVIDER', 'STRATEGY_ENGINE'),
  ResearchPipelineStageOrderError,
  'Provider must not bypass the Feature Engine.',
);
assert.throws(
  () => assertNextResearchPipelineStage('STRATEGY_ENGINE', 'APPLICATION_UI'),
  ResearchPipelineStageOrderError,
  'Strategy output must not bypass Risk/Execution on its way to executable UI.',
);
assert.throws(
  () => assertNextResearchPipelineStage('APPLICATION_UI', 'RISK_EXECUTION'),
  ResearchPipelineStageOrderError,
  'Presentation must not drive upstream engine stages.',
);

const unevaluated = createUnevaluatedExecutionEligibility();
assert.equal(unevaluated.stage, 'RISK_EXECUTION');
assert.equal(unevaluated.status, 'NOT_EVALUATED');
assert.equal(unevaluated.executable, false);
assert.match(unevaluated.reason, /Risk\/Execution boundary/);
assert.throws(
  () => assertExecutionEligible(unevaluated),
  /Execution blocked/,
  'Research shortlist must fail closed before explicit Risk/Execution approval.',
);

const blocked = createBlockedExecutionEligibility('Risk budget unavailable.');
assert.equal(blocked.status, 'BLOCKED');
assert.equal(blocked.executable, false);
assert.throws(() => assertExecutionEligible(blocked), /Execution blocked/);

const forgedApproval = Object.freeze({
  stage: 'RISK_EXECUTION' as const,
  status: 'APPROVED' as const,
  executable: true,
  reason: 'UI-shaped approval without canonical Risk/Execution provenance.',
});
assert.throws(
  () => assertExecutionEligible(forgedApproval),
  /Execution blocked/,
  'Structurally valid approval objects must not bypass canonical Risk/Execution provenance.',
);

assert.throws(
  () => createApprovedExecutionEligibility('   '),
  /requires a canonical Risk\/Execution policy reason/,
  'Canonical approvals must retain auditable policy rationale.',
);

const approved = createApprovedExecutionEligibility(
  'Canonical risk and execution policy approved the candidate.',
);
assert.equal(approved.status, 'APPROVED');
assert.equal(approved.executable, true);
assert.doesNotThrow(() => assertExecutionEligible(approved));

console.log('research-pipeline-stage-policy-smoke: ok');
