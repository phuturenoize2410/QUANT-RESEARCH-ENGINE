import assert from 'node:assert/strict';
import {
  buildMLLabApplicationReadModel,
  getMLLabRegistryReadModel,
  getMLLabSimulatedRetrainingResult,
  promoteMLLabChallenger,
  resolveMLLabSelection,
} from '../src/application/mlLabApplication';
import { buildUniverse } from '../src/data/mockStocks';

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

const mockUniverse = buildUniverse();
const exactSelection = resolveMLLabSelection('BBCA', mockUniverse);
assert.equal(exactSelection.status, 'READY');
assert.equal(exactSelection.selectedTicker, 'BBCA');
assert.equal(exactSelection.currentStock?.ticker, 'BBCA');

const fallbackSelection = resolveMLLabSelection('NOT-A-REAL-TICKER', mockUniverse);
assert.equal(fallbackSelection.status, 'FALLBACK_TICKER');
assert.equal(fallbackSelection.selectedTicker, mockUniverse[0]?.ticker);
assert.equal(fallbackSelection.currentStock, mockUniverse[0]);

const emptySelection = resolveMLLabSelection('BBCA', []);
assert.equal(emptySelection.status, 'EMPTY_UNIVERSE');
assert.equal(emptySelection.selectedTicker, null);
assert.equal(emptySelection.currentStock, null);

const applicationReadModel = buildMLLabApplicationReadModel('BBCA', mockUniverse);
assert.equal(applicationReadModel.selection.status, 'READY');
assert.equal(applicationReadModel.selection.currentStock?.ticker, 'BBCA');
assert.ok(applicationReadModel.evaluation);
assert.equal(applicationReadModel.evaluation?.leakageAudit.status, 'PASS');

const emptyApplicationReadModel = buildMLLabApplicationReadModel('BBCA', []);
assert.equal(emptyApplicationReadModel.selection.status, 'EMPTY_UNIVERSE');
assert.equal(emptyApplicationReadModel.evaluation, null);

const retrainingResult = getMLLabSimulatedRetrainingResult();
assert.deepEqual(retrainingResult, {
  mode: 'SIMULATED',
  dataSource: 'MOCK_IDX',
  outcome: 'CHALLENGER_PASSED_OOS',
  candidateModel: 'LightGBM-v4',
  message: 'Walk-forward evaluation complete! Challenger LightGBM-v4 passed out-of-sample criteria.',
});
assert.notEqual(retrainingResult.mode, 'LIVE');
assert.notEqual(retrainingResult.dataSource, 'REAL_IDX');

console.log('ML Lab application smoke passed: registry snapshots, simulated promotion/retraining provenance, selection fallback, and empty-universe handling stay isolated behind the application boundary.');