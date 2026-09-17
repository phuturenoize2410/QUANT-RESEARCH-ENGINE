import assert from 'node:assert/strict';
import { evaluateResearchExecutionEligibility } from '../src/engine/researchExecutionPolicy';
import { assertExecutionEligible } from '../src/engine/researchPipelineStagePolicy';

const baseEvidence = Object.freeze({
  dataMode: 'REAL' as const,
  providerHealthy: true,
  backtestEdgeValidated: true,
  riskChecksPassed: true,
});

const mockResult = evaluateResearchExecutionEligibility({ ...baseEvidence, dataMode: 'MOCK' });
assert.equal(mockResult.status, 'BLOCKED');
assert.equal(mockResult.executable, false);
assert.match(mockResult.reason, /MOCK data/);
assert.throws(() => assertExecutionEligible(mockResult), /Execution blocked/);

const unhealthyProvider = evaluateResearchExecutionEligibility({ ...baseEvidence, providerHealthy: false });
assert.equal(unhealthyProvider.status, 'BLOCKED');
assert.match(unhealthyProvider.reason, /provider health/);

const noEdge = evaluateResearchExecutionEligibility({ ...baseEvidence, backtestEdgeValidated: false });
assert.equal(noEdge.status, 'BLOCKED');
assert.match(noEdge.reason, /backtest edge/);

const failedRisk = evaluateResearchExecutionEligibility({ ...baseEvidence, riskChecksPassed: false });
assert.equal(failedRisk.status, 'BLOCKED');
assert.match(failedRisk.reason, /risk checks/);

const approved = evaluateResearchExecutionEligibility(baseEvidence);
assert.equal(approved.status, 'APPROVED');
assert.equal(approved.executable, true);
assert.doesNotThrow(() => assertExecutionEligible(approved));

console.log('research-execution-policy-smoke: ok');
