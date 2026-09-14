import { StockData } from '../../types';
import { TickerFeatureVector } from '../ml/types';
import {
  DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  DEFAULT_SHORTLIST_LIMIT,
  runShortlistStrategy,
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
 * Shortlist eligibility/ranking still uses the legacy derived fields carried by
 * StockData so prototype behavior remains unchanged. However, orchestration may
 * no longer execute shortlist strategy unless Feature Engine output has exact
 * one-to-one universe coverage and preserves canonical ticker identity.
 *
 * Rejecting unexpected feature keys prevents stale/cross-snapshot feature maps
 * from being silently accepted when provider universe composition changes.
 *
 * This is intentionally a compatibility bridge, not the final strategy input
 * model. Future increments can migrate prefilter/edge inputs into a dedicated
 * feature-derived strategy DTO without allowing the pipeline to bypass Feature
 * Engine in the meantime.
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

  return runShortlistStrategy(
    universe,
    shortlistEdgeThreshold,
    shortlistLimit,
  );
}
