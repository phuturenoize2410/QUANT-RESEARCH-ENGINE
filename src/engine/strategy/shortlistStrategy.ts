import { StockData } from '../../types';
import { clampScore, OVERNIGHT_EDGE_SCORE_BOUNDS } from '../scorePolicy';

export const DEFAULT_SHORTLIST_EDGE_THRESHOLD = 50;
export const DEFAULT_SHORTLIST_LIMIT = 10;

/**
 * Strategy-owned shortlist input. The strategy layer should evaluate only the
 * fields it owns rather than depending on the provider-shaped StockData model.
 * `stock` is retained solely as the result payload during this compatibility
 * stage so downstream UI behavior remains unchanged.
 */
export interface ShortlistStrategyCandidate {
  ticker: string;
  stock: StockData;
  prefilterPassed: boolean;
  overnightEdgeScore: number;
}

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
 * Feature/strategy boundary contract. Runtime data must fail closed before
 * filtering/ranking rather than letting malformed booleans or scores silently
 * alter shortlist behavior.
 */
function assertShortlistStrategyInputs(
  candidates: readonly ShortlistStrategyCandidate[],
): void {
  const invalidTickers: string[] = [];

  candidates.forEach((candidate, index) => {
    const ticker = typeof candidate?.ticker === 'string' && candidate.ticker.length > 0
      ? candidate.ticker
      : `index:${index}`;
    const stockTickerMatches = candidate?.stock?.ticker === candidate?.ticker;
    const prefilterValid = typeof candidate?.prefilterPassed === 'boolean';
    const score = candidate?.overnightEdgeScore;
    const scoreValid =
      typeof score === 'number' &&
      Number.isFinite(score) &&
      score >= OVERNIGHT_EDGE_SCORE_BOUNDS.min &&
      score <= OVERNIGHT_EDGE_SCORE_BOUNDS.max;

    if (!stockTickerMatches || !prefilterValid || !scoreValid) {
      invalidTickers.push(ticker);
    }
  });

  if (invalidTickers.length > 0) {
    throw new ShortlistStrategyInputError(invalidTickers);
  }
}

/**
 * Canonical shortlist evaluator. Eligibility, ranking, score-policy bounds and
 * list-size rules now operate on a narrow strategy DTO instead of StockData.
 */
export function runShortlistStrategyCandidates(
  candidates: ShortlistStrategyCandidate[],
  shortlistEdgeThreshold: number = DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  shortlistLimit: number = DEFAULT_SHORTLIST_LIMIT,
): ShortlistStrategyResult {
  assertShortlistStrategyInputs(candidates);

  const normalizedThreshold = clampScore(
    shortlistEdgeThreshold,
    OVERNIGHT_EDGE_SCORE_BOUNDS,
  );
  const normalizedLimit = normalizeShortlistLimit(shortlistLimit);
  const eligible = candidates
    .filter(
      candidate =>
        candidate.prefilterPassed &&
        candidate.overnightEdgeScore >= normalizedThreshold,
    )
    .sort((a, b) => b.overnightEdgeScore - a.overnightEdgeScore);

  return {
    candidates: eligible.slice(0, normalizedLimit).map(candidate => candidate.stock),
    evaluatedUniverseCount: candidates.length,
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
 * Compatibility wrapper for callers that still hold legacy StockData. New
 * orchestration should construct a strategy DTO only after Feature Engine output
 * has been validated, then call runShortlistStrategyCandidates().
 */
export function runShortlistStrategy(
  universe: StockData[],
  shortlistEdgeThreshold: number = DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  shortlistLimit: number = DEFAULT_SHORTLIST_LIMIT,
): ShortlistStrategyResult {
  return runShortlistStrategyCandidates(
    universe.map(stock => ({
      ticker: stock.ticker,
      stock,
      prefilterPassed: stock.prefilterPassed,
      overnightEdgeScore: stock.overnightEdgeScore,
    })),
    shortlistEdgeThreshold,
    shortlistLimit,
  );
}

/**
 * Compatibility selector retained for existing callers. New orchestration
 * should prefer the feature-gated strategy boundary so policy metadata and
 * Feature Engine authority travel downstream together.
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
