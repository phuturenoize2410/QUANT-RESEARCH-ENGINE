import { MorningPosition, StockData, StrategySettings } from '../types';
import {
  buildManualMorningPosition,
  buildMorningPositionFromStock,
  ManualMorningPositionInput,
} from './execution';
import {
  createPrototypeResearchPipeline,
  ResearchPipeline,
  ResearchPipelineSnapshot,
} from './researchPipeline';

export type { ManualMorningPositionInput } from './execution';

/**
 * Application orchestration boundary between React/UI and the quant core.
 *
 * UI consumers submit user intent here; they do not choose market adapters or
 * call Risk/Execution primitives directly. The service always reuses the market
 * bound to the research pipeline, preventing a future non-IDX provider from
 * accidentally falling back to IDX execution microstructure.
 *
 * Canonical flow:
 * DataProvider -> Feature Engine -> Strategy Engine -> Risk/Execution -> UI.
 */
export class ResearchApplicationService {
  constructor(private readonly pipeline: ResearchPipeline) {}

  refresh(settings: StrategySettings): Promise<ResearchPipelineSnapshot> {
    return this.pipeline.refresh(settings);
  }

  buildStrategyJournalPosition(
    stock: StockData,
    settings: StrategySettings,
    lots: number = 100,
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
