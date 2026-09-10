import { StockData } from '../../types';

export const DEFAULT_SHORTLIST_EDGE_THRESHOLD = 50;
export const DEFAULT_SHORTLIST_LIMIT = 10;

export interface ShortlistStrategyPolicy {
  edgeThreshold: number;
  limit: number;
  requiresPrefilter: true;
  ranking: 'OVERNIGHT_EDGE_DESC';
}

export interface ShortlistStrategyResult {
  candidates: StockData[];
  evaluatedUniverseCount: number;
  eligibleCountBeforeLimit: number;
  policy: ShortlistStrategyPolicy;
}

/**
 * Canonical strategy-selection boundary for the 15:45 shortlist.
 *
 * The strategy engine owns eligibility, ranking and list-size rules. Returning
 * the applied policy alongside candidates prevents orchestration/UI consumers
 * from reconstructing strategy assumptions from magic numbers.
 */
export function runShortlistStrategy(
  universe: StockData[],
  shortlistEdgeThreshold: number = DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  shortlistLimit: number = DEFAULT_SHORTLIST_LIMIT,
): ShortlistStrategyResult {
  const normalizedLimit = Math.max(0, shortlistLimit);
  const eligible = universe
    .filter(
      stock => stock.prefilterPassed && stock.overnightEdgeScore >= shortlistEdgeThreshold,
    )
    .sort((a, b) => b.overnightEdgeScore - a.overnightEdgeScore);

  return {
    candidates: eligible.slice(0, normalizedLimit),
    evaluatedUniverseCount: universe.length,
    eligibleCountBeforeLimit: eligible.length,
    policy: {
      edgeThreshold: shortlistEdgeThreshold,
      limit: normalizedLimit,
      requiresPrefilter: true,
      ranking: 'OVERNIGHT_EDGE_DESC',
    },
  };
}

/**
 * Compatibility selector retained for existing callers. New orchestration
 * should prefer runShortlistStrategy() so policy metadata travels downstream.
 */
export function selectShortlistCandidates(
  universe: StockData[],
  shortlistEdgeThreshold: number = DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  shortlistLimit: number = DEFAULT_SHORTLIST_LIMIT,
): StockData[] {
  return runShortlistStrategy(
    universe,
    shortlistEdgeThreshold,
    shortlistLimit,
  ).candidates;
}
