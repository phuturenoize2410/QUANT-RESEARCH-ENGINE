import assert from 'node:assert/strict';
import {
  RESEARCH_PIPELINE_STAGE_ORDER,
  RESEARCH_EXECUTION_ELIGIBILITY_STATUSES,
  ResearchPipelineStageOrderError,
  isResearchPipelineStage,
  isResearchExecutionEligibilityStatus,
  isResearchExecutionEligibility,
  assertNextResearchPipelineStage,
  createUnevaluatedExecutionEligibility,
  createApprovedExecutionEligibility,
  createBlockedExecutionEligibility,
  assertExecutionEligible,
} from '../src/engine/researchPipelineStagePolicy';

assert.deepEqual(RESEARCH_PIPELINE_STAGE_ORDER, [
  'DATA_PROVIDER', 'FEATURE_ENGINE', 'STRATEGY_ENGINE', 'RISK_EXECUTION', 'APPLICATION_UI',
]);
assert.equal(new Set(RESEARCH_PIPELINE_STAGE_ORDER).size, RESEARCH_PIPELINE_STAGE_ORDER.length);
for (const stage of RESEARCH_PIPELINE_STAGE_ORDER) assert.equal(isResearchPipelineStage(stage), true);
for (const invalidStage of [undefined, null, '', 'PROVIDER', 'UI', 'DATA_PROVIDER ']) {
  assert.equal(isResearchPipelineStage(invalidStage), false);
}

assert.deepEqual(RESEARCH_EXECUTION_ELIGIBILITY_STATUSES, ['NOT_EVALUATED', 'APPROVED', 'BLOCKED']);
assert.equal(new Set(RESEARCH_EXECUTION_ELIGIBILITY_STATUSES).size, RESEARCH_EXECUTION_ELIGIBILITY_STATUSES.length);
for (const status of RESEARCH_EXECUTION_ELIGIBILITY_STATUSES) assert.equal(isResearchExecutionEligibilityStatus(status), true);
for (const invalidStatus of [undefined, null, '', 'PENDING', 'EXECUTABLE', 'APPROVED ']) {
  assert.equal(isResearchExecutionEligibilityStatus(invalidStatus), false);
}

for (let index = 0; index < RESEARCH_PIPELINE_STAGE_ORDER.length - 1; index += 1) {
  assert.doesNotThrow(() => assertNextResearchPipelineStage(RESEARCH_PIPELINE_STAGE_ORDER[index], RESEARCH_PIPELINE_STAGE_ORDER[index + 1]));
}
assert.throws(() => assertNextResearchPipelineStage('DATA_PROVIDER', 'STRATEGY_ENGINE'), ResearchPipelineStageOrderError);
assert.throws(() => assertNextResearchPipelineStage('STRATEGY_ENGINE', 'APPLICATION_UI'), ResearchPipelineStageOrderError);
assert.throws(() => assertNextResearchPipelineStage('APPLICATION_UI', 'RISK_EXECUTION'), ResearchPipelineStageOrderError);

const unevaluated = createUnevaluatedExecutionEligibility();
assert.equal(isResearchExecutionEligibility(unevaluated), true);
assert.throws(() => assertExecutionEligible(unevaluated), /Execution blocked/);

const blocked = createBlockedExecutionEligibility('Risk budget unavailable.');
assert.equal(isResearchExecutionEligibility(blocked), true);
assert.throws(() => assertExecutionEligible(blocked), /Execution blocked/);

const forgedApproval = Object.freeze({
  stage: 'RISK_EXECUTION' as const,
  status: 'APPROVED' as const,
  executable: true,
  reason: 'UI-shaped approval without canonical Risk/Execution provenance.',
});
assert.equal(isResearchExecutionEligibility(forgedApproval), true, 'Structural guard may parse an approval-shaped boundary value.');
assert.throws(() => assertExecutionEligible(forgedApproval), /Execution blocked/, 'Structural validity must not establish canonical approval provenance.');

const malformedEligibilityPayloads: unknown[] = [
  null,
  {},
  { stage: 'APPLICATION_UI', status: 'BLOCKED', executable: false, reason: 'wrong stage' },
  { stage: 'RISK_EXECUTION', status: 'APPROVED', executable: false, reason: 'inconsistent approval' },
  { stage: 'RISK_EXECUTION', status: 'BLOCKED', executable: true, reason: 'inconsistent block' },
  { stage: 'RISK_EXECUTION', status: 'PENDING', executable: false, reason: 'unknown status' },
  { stage: 'RISK_EXECUTION', status: 'BLOCKED', executable: false, reason: '   ' },
];
for (const malformed of malformedEligibilityPayloads) {
  assert.equal(isResearchExecutionEligibility(malformed), false, 'Malformed execution eligibility must fail closed.');
  assert.throws(
    () => assertExecutionEligible(malformed),
    /Execution blocked: malformed Risk\/Execution eligibility payload/,
    'Execution assertion must fail closed before reading malformed application/UI payload fields.',
  );
}

assert.throws(() => createApprovedExecutionEligibility('   '), /requires a canonical Risk\/Execution policy reason/);
const approved = createApprovedExecutionEligibility('Canonical risk and execution policy approved the candidate.');
assert.equal(isResearchExecutionEligibility(approved), true);
assert.doesNotThrow(() => assertExecutionEligible(approved));

console.log('research-pipeline-stage-policy-smoke: ok');
