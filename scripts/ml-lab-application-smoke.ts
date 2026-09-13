import assert from 'node:assert/strict';
import { getMLLabRegistryReadModel } from '../src/application/mlLabApplication';

const first = getMLLabRegistryReadModel();
const second = getMLLabRegistryReadModel();

assert.notStrictEqual(first.championOvernightModel, second.championOvernightModel);
assert.notStrictEqual(first.championOvernightModel.metrics, second.championOvernightModel.metrics);
assert.notStrictEqual(first.championOvernightModel.features, second.championOvernightModel.features);
assert.notStrictEqual(first.championOvernightModel.calibrationBuckets, second.championOvernightModel.calibrationBuckets);
assert.notStrictEqual(first.championComparison, second.championComparison);
assert.notStrictEqual(first.championComparison.champion, second.championComparison.champion);
assert.notStrictEqual(first.championComparison.metricComparisons, second.championComparison.metricComparisons);
assert.notStrictEqual(first.walkForwardRecords, second.walkForwardRecords);
assert.notStrictEqual(first.activeDriftMetrics, second.activeDriftMetrics);
assert.notStrictEqual(first.retrainingHistory, second.retrainingHistory);
assert.notStrictEqual(first.initialActualTradeResiduals, second.initialActualTradeResiduals);

const originalAuc = second.championOvernightModel.metrics.auc;
const originalWalkForwardAuc = second.walkForwardRecords[0]?.trainAuc;
const originalResidual = second.initialActualTradeResiduals[0]?.residualError;

first.championOvernightModel.metrics.auc = -1;
if (first.walkForwardRecords[0]) first.walkForwardRecords[0].trainAuc = -1;
if (first.initialActualTradeResiduals[0]) first.initialActualTradeResiduals[0].residualError = -999;

const afterMutation = getMLLabRegistryReadModel();
assert.equal(afterMutation.championOvernightModel.metrics.auc, originalAuc);
assert.equal(afterMutation.walkForwardRecords[0]?.trainAuc, originalWalkForwardAuc);
assert.equal(afterMutation.initialActualTradeResiduals[0]?.residualError, originalResidual);

console.log('ML Lab application smoke passed: registry read models are defensive presentation snapshots and cannot mutate engine-owned registry state.');
