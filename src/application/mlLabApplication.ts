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
 * Canonical presentation provenance for the current ML Lab implementation.
 *
 * Keep simulation/mock-data semantics outside React so future provider-backed
 * integration cannot silently inherit UI labels that imply live or real-time
 * execution. The eventual Google Finance/free/paid provider path should replace
 * this contract explicitly only after a real provider and research pipeline are
 * connected and validated.
 */
export function getMLLabProvenance() {
  return {
    mode: 'SIMULATED' as const,
    dataSource: 'MOCK_IDX' as const,
    market: 'IDX' as const,
    provider: 'MOCK' as const,
    isRealTime: false as const,
  };
}

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

/**
 * Resolve the presentation selection before any ML model executes.
 *
 * Existing UI behavior falls back to the first stock when a requested ticker is
 * missing. Keep that behavior, but make it explicit at the application seam so
 * React no longer needs to own ticker-selection business rules. An empty
 * universe fails closed instead of passing `undefined` into ML engines.
 */
export function resolveMLLabSelection(selectedTicker: string, universe: StockData[]) {
  if (universe.length === 0) {
    return {
      status: 'EMPTY_UNIVERSE' as const,
      requestedTicker: selectedTicker,
      selectedTicker: null,
      currentStock: null,
    };
  }

  const requestedStock = universe.find(stock => stock.ticker === selectedTicker);
  const currentStock = requestedStock ?? universe[0];

  return {
    status: requestedStock ? ('READY' as const) : ('FALLBACK_TICKER' as const),
    requestedTicker: selectedTicker,
    selectedTicker: currentStock.ticker,
    currentStock,
  };
}

/**
 * Canonical ML Lab application read path.
 *
 * Selection and model orchestration are intentionally composed here rather than
 * in React. This keeps the eventual UI migration on a single application
 * contract while preserving today's first-ticker fallback semantics.
 */
export function buildMLLabApplicationReadModel(selectedTicker: string, universe: StockData[]) {
  const selection = resolveMLLabSelection(selectedTicker, universe);

  if (!selection.currentStock) {
    return {
      provenance: getMLLabProvenance(),
      selection,
      evaluation: null,
    };
  }

  return {
    provenance: getMLLabProvenance(),
    selection,
    evaluation: evaluateMLLabReadModel(selection.currentStock, universe),
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
export type MLLabApplicationReadModel = ReturnType<typeof buildMLLabApplicationReadModel>;
export type MLLabRegistryReadModel = ReturnType<typeof getMLLabRegistryReadModel>;
export type MLLabChampionComparison = MLLabRegistryReadModel['championComparison'];
export type MLLabProvenance = ReturnType<typeof getMLLabProvenance>;

/**
 * Apply the simulated challenger-promotion transition outside React.
 *
 * This is deliberately a pure presentation/application transition: it does not
 * mutate the engine-owned model registry and it does not claim that a real
 * production model was deployed. Keeping the transition here prevents UI code
 * from becoming the owner of model-governance business rules while the ML Lab
 * is still explicitly operating on simulated/mock research data.
 */
export function promoteMLLabChallenger(
  comparison: MLLabChampionComparison,
): MLLabChampionComparison {
  return {
    ...comparison,
    recommendation: 'KEEP CHAMPION',
    champion: cloneRegistryModel({
      ...comparison.challenger,
      status: 'CHAMPION',
    }),
    challenger: cloneRegistryModel(comparison.challenger),
    recommendationRationale: [
      'Promoted Challenger (LightGBM-v4) to Champion status.',
      'Production models updated with tighter calibration and superior expected value.',
    ],
    metricComparisons: comparison.metricComparisons.map(metric => ({ ...metric })),
  };
}

/**
 * Canonical result for the current simulated retraining audit.
 *
 * The ML Lab does not perform real training yet, so keep that fact explicit in
 * the application contract rather than letting React manufacture a success
 * message that could later be mistaken for a production retraining event. A
 * future real training service can replace this boundary without changing the UI
 * semantics or weakening the MOCK/SIMULATED provenance labels.
 */
export function getMLLabSimulatedRetrainingResult() {
  const provenance = getMLLabProvenance();

  return {
    mode: provenance.mode,
    dataSource: provenance.dataSource,
    market: provenance.market,
    provider: provenance.provider,
    isRealTime: provenance.isRealTime,
    outcome: 'CHALLENGER_PASSED_OOS' as const,
    candidateModel: 'LightGBM-v4',
    message: 'Walk-forward evaluation complete! Challenger LightGBM-v4 passed out-of-sample criteria.',
  };
}

export type MLLabSimulatedRetrainingResult = ReturnType<typeof getMLLabSimulatedRetrainingResult>;
export type { ActualTradeResidual };