import { StockData } from '../../types';

export const DEFAULT_SHORTLIST_EDGE_THRESHOLD = 50;
export const DEFAULT_SHORTLIST_LIMIT = 10;

export interface ShortlistStrategyConfig {
  edgeThreshold: number;
  limit: number;
}

export const DEFAULT_SHORTLIST_STRATEGY_CONFIG: ShortlistStrategyConfig = {
  edgeThreshold: DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  limit: DEFAULT_SHORTLIST_LIMIT,
};

/**
 * Canonical strategy-selection boundary for the 15:45 shortlist.
 *
 * This module deliberately owns eligibility, ranking and list-size rules so
 * orchestration and UI layers consume a strategy result instead of rebuilding
 * strategy logic themselves.
 */
export function selectShortlistCandidates(
  universe: StockData[],
  config: ShortlistStrategyConfig = DEFAULT_SHORTLIST_STRATEGY_CONFIG,
): StockData[] {
  const shortlistLimit = Math.max(0, config.limit);

  return [...universe]
    .filter(
      stock => stock.prefilterPassed && stock.overnightEdgeScore >= config.edgeThreshold,
    )
    .sort((a, b) => b.overnightEdgeScore - a.overnightEdgeScore)
    .slice(0, shortlistLimit);
}
