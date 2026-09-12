import { MorningPosition, StockData, StrategySettings } from '../types';
import {
  PROTOTYPE_MORNING_JOURNAL_PROVENANCE,
  PROTOTYPE_MORNING_POSITIONS,
} from '../data/prototypeMorningJournal';
import {
  PROTOTYPE_STRATEGY_LAB_CATALOG,
  STRATEGY_LAB_PROVENANCE,
  StrategyLabCombination,
} from '../data/strategyLabPrototypeCatalog';
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
  STANDARD_CONDITIONS,
  evaluateConditionalProbability,
  findHistoricalAnalogs,
  runSetupDiscovery,
} from './quantLabEngine';
import {
  createPrototypeResearchPipeline,
  ResearchPipeline,
  ResearchPipelineSnapshot,
} from './researchPipeline';
import {
  ConditionCriterion,
  ConditionalProbabilityResult,
  HistoricalAnalog,
} from './strategyTypes';

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

/** Presentation-safe condition metadata. The executable predicate remains in the quant core. */
export type QuantLabConditionDefinition = Pick<
  ConditionCriterion,
  'id' | 'name' | 'category' | 'description'
>;

/**
 * Conditional-probability output plus the exact stocks selected by the same
 * engine predicates. This prevents React from re-implementing filter logic.
 */
export interface QuantLabConditionalEvaluation {
  result: ConditionalProbabilityResult;
  matchingStocks: StockData[];
}

export type StrategyLabSortMetric = 'edge' | 'winRate' | 'lowestBadGap' | 'netExpectancy';

/**
 * Presentation-safe Strategy Lab snapshot. The application boundary owns how
 * prototype research rows are filtered and ranked, so React cannot accidentally
 * become the research engine when real point-in-time evidence replaces the mock catalog.
 */
export interface StrategyLabCatalogSnapshot {
  provenance: typeof STRATEGY_LAB_PROVENANCE;
  combinations: StrategyLabCombination[];
}

/**
 * Presentation-safe seed for the Morning Exit journal. Explicit provenance keeps
 * demonstration fills separate from future broker/live/backtest evidence.
 */
export interface MorningJournalSeedSnapshot {
  provenance: typeof PROTOTYPE_MORNING_JOURNAL_PROVENANCE;
  positions: MorningPosition[];
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

  getMorningJournalSeed(): MorningJournalSeedSnapshot {
    return {
      provenance: PROTOTYPE_MORNING_JOURNAL_PROVENANCE,
      positions: PROTOTYPE_MORNING_POSITIONS.map(position => ({ ...position })),
    };
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

  getQuantLabConditions(): QuantLabConditionDefinition[] {
    return STANDARD_CONDITIONS.map(({ id, name, category, description }) => ({
      id,
      name,
      category,
      description,
    }));
  }

  evaluateQuantLabConditions(
    universe: StockData[],
    selectedConditionIds: string[],
  ): QuantLabConditionalEvaluation {
    const selected = new Set(selectedConditionIds);
    const criteria = STANDARD_CONDITIONS.filter(condition => selected.has(condition.id));
    const matchingStocks = criteria.length === 0
      ? [...universe]
      : universe.filter(stock => criteria.every(condition => condition.evaluate(stock)));

    return {
      result: evaluateConditionalProbability(universe, selectedConditionIds),
      matchingStocks,
    };
  }

  discoverQuantLabSetups(universe: StockData[]): ConditionalProbabilityResult[] {
    return runSetupDiscovery(universe);
  }

  findQuantLabAnalogs(
    targetStock: StockData,
    universe: StockData[],
    limit: number = 6,
  ): HistoricalAnalog[] {
    return findHistoricalAnalogs(targetStock, universe, limit);
  }

  getStrategyLabCatalog(
    sortBy: StrategyLabSortMetric = 'edge',
    category: string = 'ALL',
  ): StrategyLabCatalogSnapshot {
    const combinations = PROTOTYPE_STRATEGY_LAB_CATALOG
      .filter(combo => category === 'ALL' || combo.category === category)
      .slice()
      .sort((a, b) => {
        if (sortBy === 'winRate') return b.greenOpenRate - a.greenOpenRate;
        if (sortBy === 'lowestBadGap') return a.badGapProb - b.badGapProb;
        if (sortBy === 'netExpectancy') return b.expectedValue - a.expectedValue;
        return b.riskAdjustedEdgeScore - a.riskAdjustedEdgeScore;
      });

    return {
      provenance: STRATEGY_LAB_PROVENANCE,
      combinations,
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
