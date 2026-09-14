import { StockData } from '../../types';
import { TickerFeatureVector } from '../ml/types';
import {
  DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  DEFAULT_SHORTLIST_LIMIT,
  runShortlistStrategyCandidates,
  ShortlistStrategyCandidate,
  ShortlistStrategyResult,
} from './shortlistStrategy';

export class ShortlistFeatureBoundaryError extends Error {
  readonly missingTickers: readonly string[];
  readonly mismatchedTickers: readonly string[];
  readonly unexpectedTickers: readonly string[];

  constructor(
    missingTickers: readonly string[],
    mismatchedTickers: readonly string[],
    unexpectedTickers: readonly string[] = [],
  ) {
    const details = [
      missingTickers.length > 0 ? `missing features: ${missingTickers.join(', ')}` : '',
      mismatchedTickers.length > 0 ? `ticker mismatches: ${mismatchedTickers.join(', ')}` : '',
      unexpectedTickers.length > 0 ? `unexpected features: ${unexpectedTickers.join(', ')}` : '',
    ].filter(Boolean).join('; ');

    super(
      'Shortlist strategy requires an exact Feature Engine output set before evaluation' +
      (details ? ` (${details}).` : '.'),
    );
    this.name = 'ShortlistFeatureBoundaryError';
    this.missingTickers = Object.freeze([...missingTickers]);
    this.mismatchedTickers = Object.freeze([...mismatchedTickers]);
    this.unexpectedTickers = Object.freeze([...unexpectedTickers]);
  }
}

/**
 * Transitional Feature Engine -> Strategy Engine boundary.
 *
 * Feature output must have exact one-to-one universe coverage before strategy
 * evaluation. After that gate, legacy derived shortlist fields are copied into a
 * narrow strategy-owned DTO so the strategy layer no longer evaluates the full
 * provider-shaped StockData object directly.
 *
 * The source of prefilterPassed/overnightEdgeScore is intentionally unchanged in
 * this increment to preserve prototype behavior. A later slice can migrate those
 * values to authoritative feature-derived calculations without re-coupling the
 * Strategy Engine to provider data.
 */
export function runFeatureGatedShortlistStrategy(
  universe: StockData[],
  featuresByTicker: Readonly<Record<string, TickerFeatureVector>>,
  shortlistEdgeThreshold: number = DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  shortlistLimit: number = DEFAULT_SHORTLIST_LIMIT,
): ShortlistStrategyResult {
  const missingTickers: string[] = [];
  const mismatchedTickers: string[] = [];
  const universeTickers = new Set(universe.map(stock => stock.ticker));
  const unexpectedTickers = Object.keys(featuresByTicker)
    .filter(ticker => !universeTickers.has(ticker))
    .sort();

  for (const stock of universe) {
    const vector = featuresByTicker[stock.ticker];
    if (!vector) {
      missingTickers.push(stock.ticker);
      continue;
    }

    if (vector.ticker !== stock.ticker) {
      mismatchedTickers.push(`${stock.ticker}->${vector.ticker}`);
    }
  }

  if (
    missingTickers.length > 0 ||
    mismatchedTickers.length > 0 ||
    unexpectedTickers.length > 0
  ) {
    throw new ShortlistFeatureBoundaryError(
      missingTickers,
      mismatchedTickers,
      unexpectedTickers,
    );
  }

  const strategyCandidates: ShortlistStrategyCandidate[] = universe.map(stock => ({
    ticker: stock.ticker,
    stock,
    prefilterPassed: stock.prefilterPassed,
    overnightEdgeScore: stock.overnightEdgeScore,
  }));

  return runShortlistStrategyCandidates(
    strategyCandidates,
    shortlistEdgeThreshold,
    shortlistLimit,
  );
}
