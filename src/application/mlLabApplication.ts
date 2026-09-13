import { StockData } from '../types';
import { FeatureStore } from '../engine/ml/featureStore';
import {
  OvernightMLModel,
  GapRiskMLModel,
  IntradayMLModel,
  SwingMLModel,
  TrendPersistenceMLModel,
  BreakoutFailureMLModel,
  EmergingLeaderMLModel,
} from '../engine/ml/models';
import {
  MLMetaStrategyRouter,
  QuantMLEnsembleEngine,
  PortfolioMLRiskEngine,
} from '../engine/ml/ensembleRouter';
import {
  CHAMPION_OVERNIGHT_MODEL,
  CHALLENGER_OVERNIGHT_MODEL,
  getChampionChallengerComparison,
  WALK_FORWARD_RECORDS,
  ACTIVE_DRIFT_METRICS,
  RETRAINING_HISTORY,
  INITIAL_ACTUAL_TRADE_RESIDUALS,
  ActualTradeResidual,
} from '../engine/ml/modelRegistry';
import { MLModelDefinition } from '../engine/ml/types';

/**
 * Presentation-facing read model for the ML Lab.
 *
 * Keep model execution and feature/leakage inspection behind this application
 * seam so React does not become responsible for orchestrating ML engines. The
 * underlying models remain unchanged; this facade only centralizes evaluation.
 */
export function evaluateMLLabReadModel(currentStock: StockData, universe: StockData[]) {
  return {
    overnightML: OvernightMLModel.predict(currentStock),
    gapRiskML: GapRiskMLModel.predict(currentStock),
    intradayML: IntradayMLModel.predict(currentStock),
    swingML: SwingMLModel.predict(currentStock),
    trendML: TrendPersistenceMLModel.predict(currentStock),
    breakoutML: BreakoutFailureMLModel.predict(currentStock),
    leaderML: EmergingLeaderMLModel.predict(currentStock),
    ensemble: QuantMLEnsembleEngine.evaluate(currentStock),
    strategyRouter: MLMetaStrategyRouter.evaluate(currentStock),
    leakageAudit: FeatureStore.verifyNoDataLeakage(),
    portfolioRisk: PortfolioMLRiskEngine.evaluate(universe.slice(0, 10)),
  };
}

function cloneRegistryModel(model: MLModelDefinition): MLModelDefinition {
  return {
    ...model,
    features: [...model.features],
    hyperparameters: { ...model.hyperparameters },
    metrics: { ...model.metrics },
    calibrationBuckets: model.calibrationBuckets.map(bucket => ({ ...bucket })),
  };
}

/**
 * Registry-facing presentation snapshot for the ML Lab.
 *
 * Registry constants are engine-owned source-of-truth. Return defensive copies
 * here so a future React consumer cannot mutate the model registry simply by
 * sorting, editing or storing a presentation snapshot in local component state.
 * The values remain identical; only object identity is isolated at the
 * application boundary.
 */
export function getMLLabRegistryReadModel() {
  const comparison = getChampionChallengerComparison();

  return {
    championOvernightModel: cloneRegistryModel(CHAMPION_OVERNIGHT_MODEL),
    challengerOvernightModel: cloneRegistryModel(CHALLENGER_OVERNIGHT_MODEL),
    championComparison: {
      ...comparison,
      champion: cloneRegistryModel(comparison.champion),
      challenger: cloneRegistryModel(comparison.challenger),
      recommendationRationale: [...comparison.recommendationRationale],
      metricComparisons: comparison.metricComparisons.map(metric => ({ ...metric })),
    },
    walkForwardRecords: WALK_FORWARD_RECORDS.map(record => ({ ...record })),
    activeDriftMetrics: ACTIVE_DRIFT_METRICS.map(metric => ({ ...metric })),
    retrainingHistory: RETRAINING_HISTORY.map(entry => ({ ...entry })),
    initialActualTradeResiduals: INITIAL_ACTUAL_TRADE_RESIDUALS.map(residual => ({ ...residual })),
  };
}

export type MLLabReadModel = ReturnType<typeof evaluateMLLabReadModel>;
export type MLLabRegistryReadModel = ReturnType<typeof getMLLabRegistryReadModel>;
export type { ActualTradeResidual };
