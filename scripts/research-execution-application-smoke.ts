import assert from 'node:assert/strict';
import {
  enterResearchRiskExecutionBoundary,
  exposeResearchToPresentation,
} from '../src/application/researchExecutionBoundary';
import { assertExecutionEligible } from '../src/engine/researchPipelineStagePolicy';

const strategyOutput = Object.freeze({ ticker: 'BBCA', score: 0.73 });
const riskEnvelope = enterResearchRiskExecutionBoundary(strategyOutput);

assert.equal(riskEnvelope.strategyOutput, strategyOutput);
assert.equal(riskEnvelope.executionEligibility.stage, 'RISK_EXECUTION');
assert.equal(riskEnvelope.executionEligibility.status, 'NOT_EVALUATED');
assert.equal(riskEnvelope.executionEligibility.executable, false);
assert.throws(
  () => assertExecutionEligible(riskEnvelope.executionEligibility),
  /Execution blocked/,
  'crossing into Risk/Execution must never imply approval',
);

const presentationEnvelope = exposeResearchToPresentation(riskEnvelope);
assert.equal(presentationEnvelope, riskEnvelope);
assert.equal(presentationEnvelope.executionEligibility.status, 'NOT_EVALUATED');
assert.equal(presentationEnvelope.executionEligibility.executable, false);

console.log('research-execution-application-smoke: ok');
