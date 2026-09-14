import { StockData } from '../../types';
import {
  DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  DEFAULT_SHORTLIST_LIMIT,
  runShortlistCore,
  ShortlistStrategyInputError,
  ShortlistStrategyPolicy,
} from './shortlistCore';

export {
  DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  DEFAULT_SHORTLIST_LIMIT,
  ShortlistStrategyInputError,
} from './shortlistCore';

/**
 * Compatibility DTO for callers that still hold StockData. Strategy-owned
 * fields remain explicit while StockData is carried only as an opaque result
 * payload into the provider-agnostic shortlist core.
 */
export interface ShortlistStrategyCandidate {
  ticker: string;
  stock: StockData;
  prefilterPassed: boolean;
  overnightEdgeScore: number;
}

export type { ShortlistStrategyPolicy } from './shortlistCore';

export interface ShortlistStrategyResult {
  candidates: StockData[];
  evaluatedUniverseCount: number;
  eligibleCountBeforeLimit: number;
  policy: ShortlistStrategyPolicy;
}

function assertLegacyPayloadIdentity(
  candidates: readonly ShortlistStrategyCandidate[],
): void {
  const invalidTickers = candidates
    .filter(candidate => candidate?.stock?.ticker !== candidate?.ticker)
    .map((candidate, index) =>
      typeof candidate?.ticker === 'string' && candidate.ticker.length > 0
        ? candidate.ticker
        : `index:${index}`,
    );

  if (invalidTickers.length > 0) {
    throw new ShortlistStrategyInputError(invalidTickers);
  }
}

/**
 * Compatibility adapter around the provider-agnostic Strategy Engine core.
 * StockData identity is checked here, then the core sees only an opaque payload
 * plus strategy-owned fields.
 */
export function runShortlistStrategyCandidates(
  candidates: ShortlistStrategyCandidate[],
  shortlistEdgeThreshold: number = DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  shortlistLimit: number = DEFAULT_SHORTLIST_LIMIT,
): ShortlistStrategyResult {
  assertLegacyPayloadIdentity(candidates);

  return runShortlistCore(
    candidates.map(candidate => ({
      ticker: candidate.ticker,
      payload: candidate.stock,
      prefilterPassed: candidate.prefilterPassed,
      overnightEdgeScore: candidate.overnightEdgeScore,
    })),
    shortlistEdgeThreshold,
    shortlistLimit,
  );
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
