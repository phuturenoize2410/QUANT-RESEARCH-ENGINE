import { StockData } from '../../types';

export const DEFAULT_SHORTLIST_EDGE_THRESHOLD = 50;
export const DEFAULT_SHORTLIST_LIMIT = 10;

/**
 * Canonical strategy-selection boundary for the 15:45 shortlist.
 *
 * This module deliberately owns eligibility, ranking and list-size rules so
 * orchestration and UI layers consume a strategy result instead of rebuilding
 * strategy logic themselves.
 *
 * The numeric arguments intentionally preserve the selector API that existed
 * when this logic lived inside researchPipeline.ts.
 */
export function selectShortlistCandidates(
  universe: StockData[],
  shortlistEdgeThreshold: number = DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  shortlistLimit: number = DEFAULT_SHORTLIST_LIMIT,
): StockData[] {
  return [...universe]
    .filter(
      stock => stock.prefilterPassed && stock.overnightEdgeScore >= shortlistEdgeThreshold,
    )
    .sort((a, b) => b.overnightEdgeScore - a.overnightEdgeScore)
    .slice(0, Math.max(0, shortlistLimit));
}
