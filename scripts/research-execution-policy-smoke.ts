import assert from 'node:assert/strict';
import { evaluateResearchExecutionEligibility } from '../src/engine/researchExecutionPolicy';
import { assertExecutionEligible } from '../src/engine/researchPipelineStagePolicy';

const baseEvidence = Object.freeze({
  dataMode: 'REAL' as const,
  providerHealth: Object.freeze({
    status: 'HEALTHY' as const,
    checkedAt: '2026-09-18T00:00:00.000Z',
    lastSuccessfulSyncAt: '2026-09-18T00:00:00.000Z',
    staleAfterSeconds: 300,
  }),
  backtestEdgeValidated: true,
  riskChecksPassed: true,
});

const mockResult = evaluateResearchExecutionEligibility({ ...baseEvidence, dataMode: 'MOCK' });
assert.equal(mockResult.status, 'BLOCKED');
assert.equal(mockResult.executable, false);
assert.match(mockResult.reason, /MOCK data/);
assert.throws(() => assertExecutionEligible(mockResult), /Execution blocked/);

for (const providerHealthStatus of ['DEGRADED', 'STALE', 'UNAVAILABLE'] as const) {
  const unhealthyProvider = evaluateResearchExecutionEligibility({
    ...baseEvidence,
    providerHealth: { ...baseEvidence.providerHealth, status: providerHealthStatus },
  });
  assert.equal(unhealthyProvider.status, 'BLOCKED');
  assert.equal(unhealthyProvider.executable, false);
  assert.match(unhealthyProvider.reason, new RegExp(providerHealthStatus));
  assert.match(unhealthyProvider.reason, /HEALTHY is required/);
}

const invalidHealthObservation = evaluateResearchExecutionEligibility({
  ...baseEvidence,
  providerHealth: { ...baseEvidence.providerHealth, checkedAt: 'not-a-timestamp' },
});
assert.equal(invalidHealthObservation.status, 'BLOCKED');
assert.equal(invalidHealthObservation.executable, false);
assert.match(invalidHealthObservation.reason, /checkedAt timestamp/);

const missingLastSync = evaluateResearchExecutionEligibility({
  ...baseEvidence,
  providerHealth: { status: 'HEALTHY', checkedAt: baseEvidence.providerHealth.checkedAt },
});
assert.equal(missingLastSync.status, 'BLOCKED');
assert.match(missingLastSync.reason, /lastSuccessfulSyncAt evidence/);

const futureLastSync = evaluateResearchExecutionEligibility({
  ...baseEvidence,
  providerHealth: { ...baseEvidence.providerHealth, lastSuccessfulSyncAt: '2026-09-18T00:01:00.000Z' },
});
assert.equal(futureLastSync.status, 'BLOCKED');
assert.match(futureLastSync.reason, /later than checkedAt/);

const staleHealth = evaluateResearchExecutionEligibility({
  ...baseEvidence,
  providerHealth: {
    ...baseEvidence.providerHealth,
    checkedAt: '2026-09-18T00:10:00.000Z',
    lastSuccessfulSyncAt: '2026-09-18T00:00:00.000Z',
    staleAfterSeconds: 300,
  },
});
assert.equal(staleHealth.status, 'BLOCKED');
assert.match(staleHealth.reason, /stale relative to staleAfterSeconds/);

const invalidFreshnessWindow = evaluateResearchExecutionEligibility({
  ...baseEvidence,
  providerHealth: { ...baseEvidence.providerHealth, staleAfterSeconds: 0 },
});
assert.equal(invalidFreshnessWindow.status, 'BLOCKED');
assert.match(invalidFreshnessWindow.reason, /positive finite number/);

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
