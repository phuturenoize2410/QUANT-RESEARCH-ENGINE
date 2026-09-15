import { StockData } from '../../types';
import { ProviderMode } from '../dataProviders';
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
  readonly invalidTimestampTickers: readonly string[];

  constructor(
    missingTickers: readonly string[],
    mismatchedTickers: readonly string[],
    unexpectedTickers: readonly string[] = [],
    invalidTimestampTickers: readonly string[] = [],
  ) {
    const details = [
      missingTickers.length > 0 ? `missing features: ${missingTickers.join(', ')}` : '',
      mismatchedTickers.length > 0 ? `ticker mismatches: ${mismatchedTickers.join(', ')}` : '',
      unexpectedTickers.length > 0 ? `unexpected features: ${unexpectedTickers.join(', ')}` : '',
      invalidTimestampTickers.length > 0
        ? `invalid feature timestamps: ${invalidTimestampTickers.join(', ')}`
        : '',
    ].filter(Boolean).join('; ');

    super(
      'Shortlist strategy requires an exact, timestamped Feature Engine output set before evaluation' +
      (details ? ` (${details}).` : '.'),
    );
    this.name = 'ShortlistFeatureBoundaryError';
    this.missingTickers = Object.freeze([...missingTickers]);
    this.mismatchedTickers = Object.freeze([...mismatchedTickers]);
    this.unexpectedTickers = Object.freeze([...unexpectedTickers]);
    this.invalidTimestampTickers = Object.freeze([...invalidTimestampTickers]);
  }
}

export class ShortlistInputAuthorityError extends Error {
  readonly providerMode: ProviderMode;

  constructor(providerMode: ProviderMode) {
    super(
      `Shortlist strategy cannot use legacy StockData-derived inputs in ${providerMode} mode. ` +
      'Migrate prefilterPassed and overnightEdgeScore to an authoritative Feature Engine projection before enabling non-mock strategy execution.',
    );
    this.name = 'ShortlistInputAuthorityError';
    this.providerMode = providerMode;
  }
}

function hasValidFeatureTimestamp(vector: TickerFeatureVector): boolean {
  return typeof vector.timestamp === 'string' &&
    vector.timestamp.trim().length > 0 &&
    Number.isFinite(Date.parse(vector.timestamp));
}

/**
 * Transitional Feature Engine -> Strategy Engine boundary.
 *
 * Feature output must have exact one-to-one universe coverage and a parseable
 * observation timestamp before strategy evaluation. After that gate, legacy
 * derived shortlist fields are copied into a narrow strategy-owned DTO so the
 * strategy layer no longer evaluates the full provider-shaped StockData object
 * directly.
 *
 * The legacy projection is deliberately MOCK-only. Real/delayed/EOD provider
 * integration must source shortlist inputs from authoritative Feature Engine
 * output rather than silently trusting provider-shaped compatibility fields.
 */
export function runFeatureGatedShortlistStrategy(
  universe: StockData[],
  featuresByTicker: Readonly<Record<string, TickerFeatureVector>>,
  shortlistEdgeThreshold: number = DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  shortlistLimit: number = DEFAULT_SHORTLIST_LIMIT,
  providerMode: ProviderMode = 'MOCK',
): ShortlistStrategyResult {
  const missingTickers: string[] = [];
  const mismatchedTickers: string[] = [];
  const invalidTimestampTickers: string[] = [];
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

    if (!hasValidFeatureTimestamp(vector)) {
      invalidTimestampTickers.push(stock.ticker);
    }
  }

  if (
    missingTickers.length > 0 ||
    mismatchedTickers.length > 0 ||
    unexpectedTickers.length > 0 ||
    invalidTimestampTickers.length > 0
  ) {
    throw new ShortlistFeatureBoundaryError(
      missingTickers,
      mismatchedTickers,
      unexpectedTickers,
      invalidTimestampTickers,
    );
  }

  if (providerMode !== 'MOCK') {
    throw new ShortlistInputAuthorityError(providerMode);
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
