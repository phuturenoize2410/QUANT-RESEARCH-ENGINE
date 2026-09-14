import { StockData } from '../../types';
import { clampScore, OVERNIGHT_EDGE_SCORE_BOUNDS } from '../scorePolicy';

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

export class ShortlistStrategyInputError extends Error {
  readonly invalidTickers: readonly string[];

  constructor(invalidTickers: readonly string[]) {
    super(
      'Shortlist strategy rejected malformed derived inputs for ticker(s): ' +
      `${invalidTickers.join(', ')}. Expected boolean prefilterPassed and finite ` +
      'overnightEdgeScore within canonical score bounds.',
    );
    this.name = 'ShortlistStrategyInputError';
    this.invalidTickers = Object.freeze([...invalidTickers]);
  }
}

function normalizeShortlistLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_SHORTLIST_LIMIT;
  }

  return Math.max(0, Math.floor(limit));
}

/**
 * Feature/strategy boundary contract. Provider and feature-stage payloads are
 * runtime data, so TypeScript alone cannot guarantee that strategy-owned fields
 * remain usable. Fail closed before filtering/ranking rather than letting NaN,
 * strings, or out-of-range scores silently change shortlist ordering.
 */
function assertShortlistStrategyInputs(universe: readonly StockData[]): void {
  const invalidTickers: string[] = [];

  universe.forEach((stock, index) => {
    const ticker = typeof stock?.ticker === 'string' && stock.ticker.length > 0
      ? stock.ticker
      : `index:${index}`;
    const prefilterValid = typeof stock?.prefilterPassed === 'boolean';
    const score = stock?.overnightEdgeScore;
    const scoreValid =
      typeof score === 'number' &&
      Number.isFinite(score) &&
      score >= OVERNIGHT_EDGE_SCORE_BOUNDS.min &&
      score <= OVERNIGHT_EDGE_SCORE_BOUNDS.max;

    if (!prefilterValid || !scoreValid) {
      invalidTickers.push(ticker);
    }
  });

  if (invalidTickers.length > 0) {
    throw new ShortlistStrategyInputError(invalidTickers);
  }
}

/**
 * Canonical strategy-selection boundary for the 15:45 shortlist.
 *
 * The strategy engine owns eligibility, ranking and list-size rules. Returning
 * the applied policy alongside candidates prevents orchestration/UI consumers
 * from reconstructing strategy assumptions from magic numbers.
 *
 * Policy inputs are normalized here as well: score thresholds obey the same
 * overnight-score bounds as the feature/analytics layer, while malformed list
 * sizes fall back to the canonical default instead of leaking NaN semantics to
 * Array.slice().
 */
export function runShortlistStrategy(
  universe: StockData[],
  shortlistEdgeThreshold: number = DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  shortlistLimit: number = DEFAULT_SHORTLIST_LIMIT,
): ShortlistStrategyResult {
  assertShortlistStrategyInputs(universe);

  const normalizedThreshold = clampScore(
    shortlistEdgeThreshold,
    OVERNIGHT_EDGE_SCORE_BOUNDS,
  );
  const normalizedLimit = normalizeShortlistLimit(shortlistLimit);
  const eligible = universe
    .filter(
      stock => stock.prefilterPassed && stock.overnightEdgeScore >= normalizedThreshold,
    )
    .sort((a, b) => b.overnightEdgeScore - a.overnightEdgeScore);

  return {
    candidates: eligible.slice(0, normalizedLimit),
    evaluatedUniverseCount: universe.length,
    eligibleCountBeforeLimit: eligible.length,
    policy: {
      edgeThreshold: normalizedThreshold,
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
