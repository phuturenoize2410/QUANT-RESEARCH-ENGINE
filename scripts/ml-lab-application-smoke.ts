import assert from 'node:assert/strict';
import {
  getMLLabRegistryReadModel,
  promoteMLLabChallenger,
} from '../src/application/mlLabApplication';

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

const beforePromotion = getMLLabRegistryReadModel();
const promoted = promoteMLLabChallenger(beforePromotion.championComparison);

assert.equal(promoted.recommendation, 'KEEP CHAMPION');
assert.equal(promoted.champion.modelId, beforePromotion.championComparison.challenger.modelId);
assert.equal(promoted.champion.status, 'CHAMPION');
assert.deepEqual(promoted.recommendationRationale, [
  'Promoted Challenger (LightGBM-v4) to Champion status.',
  'Production models updated with tighter calibration and superior expected value.',
]);
assert.notStrictEqual(promoted.champion, beforePromotion.championComparison.challenger);
assert.notStrictEqual(promoted.champion.metrics, beforePromotion.championComparison.challenger.metrics);
assert.notStrictEqual(promoted.champion.calibrationBuckets, beforePromotion.championComparison.challenger.calibrationBuckets);
assert.notStrictEqual(promoted.metricComparisons, beforePromotion.championComparison.metricComparisons);

promoted.champion.metrics.auc = -5;
const afterPromotionMutation = getMLLabRegistryReadModel();
assert.equal(
  afterPromotionMutation.championComparison.challenger.metrics.auc,
  beforePromotion.championComparison.challenger.metrics.auc,
);
assert.equal(afterPromotionMutation.championComparison.challenger.status, 'CHALLENGER');

console.log('ML Lab application smoke passed: registry snapshots and simulated promotion transitions stay isolated from engine-owned registry state.');
