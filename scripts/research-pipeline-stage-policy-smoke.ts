import assert from 'node:assert/strict';
import {
  RESEARCH_PIPELINE_STAGE_ORDER,
  ResearchPipelineStageOrderError,
  assertNextResearchPipelineStage,
  createUnevaluatedExecutionEligibility,
  assertExecutionEligible,
} from '../src/engine/researchPipelineStagePolicy';

assert.deepEqual(RESEARCH_PIPELINE_STAGE_ORDER, [
  'DATA_PROVIDER',
  'FEATURE_ENGINE',
  'STRATEGY_ENGINE',
  'RISK_EXECUTION',
  'APPLICATION_UI',
]);

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

assert.doesNotThrow(() => assertExecutionEligible({
  stage: 'RISK_EXECUTION',
  status: 'APPROVED',
  executable: true,
  reason: 'Canonical risk and execution policy approved the candidate.',
}));

console.log('research-pipeline-stage-policy-smoke: ok');
