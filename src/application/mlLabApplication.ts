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

export type MLLabReadModel = ReturnType<typeof evaluateMLLabReadModel>;
