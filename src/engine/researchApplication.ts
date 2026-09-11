import { MorningPosition, StockData, StrategySettings } from '../types';
import {
  buildManualMorningPosition,
  buildMorningPositionFromStock,
  ManualMorningPositionInput,
} from './execution';
import { DEFAULT_RESEARCH_POSITION_LOTS } from './executionPolicy';
import { FeatureContext } from './featureContext';
import { QuantMLEnsembleEngine } from './ml/ensembleRouter';
import { GapRiskMLModel, OvernightMLModel } from './ml/models';
import {
  GapRiskMLPrediction,
  OvernightMLPrediction,
  QuantMLEnsembleOutput,
} from './ml/types';
import {
  createPrototypeResearchPipeline,
  ResearchPipeline,
  ResearchPipelineSnapshot,
} from './researchPipeline';

export type { ManualMorningPositionInput } from './execution';

/**
 * Complete model output required by the final-decision presentation.
 *
 * Keeping this DTO at the application boundary prevents React components from
 * independently invoking ensemble / ML models with mismatched point-in-time
 * feature contexts as provider-backed data is introduced later.
 */
export interface DecisionCandidateEvaluation {
  ensemble: QuantMLEnsembleOutput;
  overnightML: OvernightMLPrediction;
  gapRisk: GapRiskMLPrediction;
}

/**
 * Application orchestration boundary between React/UI and the quant core.
 *
 * UI consumers submit user intent here; they do not choose market adapters or
 * call Strategy/ML/Risk/Execution primitives directly. The service always reuses
 * the market and point-in-time context owned by the research pipeline, preventing
 * future provider-backed data from silently falling back to prototype assumptions.
 *
 * Canonical flow:
 * DataProvider -> Feature Engine -> Strategy Engine -> Risk/Execution -> UI.
 */
export class ResearchApplicationService {
  constructor(private readonly pipeline: ResearchPipeline) {}

  refresh(settings: StrategySettings): Promise<ResearchPipelineSnapshot> {
    return this.pipeline.refresh(settings);
  }

  evaluateShortlistCandidate(
    stock: StockData,
    featureContext: FeatureContext,
  ): QuantMLEnsembleOutput {
    return QuantMLEnsembleEngine.evaluate(stock, featureContext);
  }

  evaluateDecisionCandidate(
    stock: StockData,
    featureContext: FeatureContext,
  ): DecisionCandidateEvaluation {
    return {
      ensemble: QuantMLEnsembleEngine.evaluate(stock, featureContext),
      overnightML: OvernightMLModel.predict(stock, featureContext),
      gapRisk: GapRiskMLModel.predict(stock, featureContext),
    };
  }

  buildStrategyJournalPosition(
    stock: StockData,
    settings: StrategySettings,
    lots: number = DEFAULT_RESEARCH_POSITION_LOTS,
  ): MorningPosition {
    return buildMorningPositionFromStock(
      stock,
      settings,
      lots,
      this.pipeline.getMarket(),
    );
  }

  buildManualJournalPosition(
    input: ManualMorningPositionInput,
    stock: StockData | undefined,
    settings: StrategySettings,
  ): MorningPosition {
    return {
      ...buildManualMorningPosition(
        input,
        stock,
        settings,
        this.pipeline.getMarket(),
      ),
      id: `pos-${Date.now()}`,
    };
  }
}

export function createPrototypeResearchApplicationService(): ResearchApplicationService {
  return new ResearchApplicationService(createPrototypeResearchPipeline());
}
