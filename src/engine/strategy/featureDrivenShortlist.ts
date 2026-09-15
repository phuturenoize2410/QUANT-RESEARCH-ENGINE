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
  readonly inconsistentTimestampTickers: readonly string[];
  readonly duplicateUniverseTickers: readonly string[];
  readonly invalidUniverseTickers: readonly string[];

  constructor(
    missingTickers: readonly string[],
    mismatchedTickers: readonly string[],
    unexpectedTickers: readonly string[] = [],
    invalidTimestampTickers: readonly string[] = [],
    inconsistentTimestampTickers: readonly string[] = [],
    duplicateUniverseTickers: readonly string[] = [],
    invalidUniverseTickers: readonly string[] = [],
  ) {
    const details = [
      missingTickers.length > 0 ? `missing features: ${missingTickers.join(', ')}` : '',
      mismatchedTickers.length > 0 ? `ticker mismatches: ${mismatchedTickers.join(', ')}` : '',
      unexpectedTickers.length > 0 ? `unexpected features: ${unexpectedTickers.join(', ')}` : '',
      invalidTimestampTickers.length > 0
        ? `invalid feature timestamps: ${invalidTimestampTickers.join(', ')}`
        : '',
      inconsistentTimestampTickers.length > 0
        ? `cross-snapshot feature timestamps: ${inconsistentTimestampTickers.join(', ')}`
        : '',
      duplicateUniverseTickers.length > 0
        ? `duplicate universe tickers: ${duplicateUniverseTickers.join(', ')}`
        : '',
      invalidUniverseTickers.length > 0
        ? `invalid universe ticker identities: ${invalidUniverseTickers.join(', ')}`
        : '',
    ].filter(Boolean).join('; ');

    super(
      'Shortlist strategy requires an exact, validly and uniquely identified, timestamped, single-snapshot Feature Engine output set before evaluation' +
      (details ? ` (${details}).` : '.'),
    );
    this.name = 'ShortlistFeatureBoundaryError';
    this.missingTickers = Object.freeze([...missingTickers]);
    this.mismatchedTickers = Object.freeze([...mismatchedTickers]);
    this.unexpectedTickers = Object.freeze([...unexpectedTickers]);
    this.invalidTimestampTickers = Object.freeze([...invalidTimestampTickers]);
    this.inconsistentTimestampTickers = Object.freeze([...inconsistentTimestampTickers]);
    this.duplicateUniverseTickers = Object.freeze([...duplicateUniverseTickers]);
    this.invalidUniverseTickers = Object.freeze([...invalidUniverseTickers]);
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

function parseFeatureTimestamp(vector: TickerFeatureVector): number | null {
  if (typeof vector.timestamp !== 'string' || vector.timestamp.trim().length === 0) {
    return null;
  }

  const parsed = Date.parse(vector.timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

function findDuplicateUniverseTickers(universe: readonly StockData[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const stock of universe) {
    if (seen.has(stock.ticker)) {
      duplicates.add(stock.ticker);
    } else {
      seen.add(stock.ticker);
    }
  }

  return [...duplicates].sort();
}

function findInvalidUniverseTickers(universe: readonly StockData[]): string[] {
  return universe.flatMap((stock, index) =>
    typeof stock?.ticker === 'string' && stock.ticker.trim().length > 0
      ? []
      : [`index:${index}`],
  );
}

/**
 * Transitional Feature Engine -> Strategy Engine boundary.
 *
 * Feature output must have exact one-to-one universe coverage, the universe must
 * contain valid and unique ticker identities, and all vectors must belong to one
 * parseable point-in-time snapshot before strategy evaluation. After that gate,
 * legacy derived shortlist fields are copied into a narrow strategy-owned DTO so
 * the strategy layer no longer evaluates the full provider-shaped StockData object
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
  const inconsistentTimestampTickers: string[] = [];
  const invalidUniverseTickers = findInvalidUniverseTickers(universe);
  const duplicateUniverseTickers = findDuplicateUniverseTickers(universe);
  const universeTickers = new Set(universe.map(stock => stock.ticker));
  const unexpectedTickers = Object.keys(featuresByTicker)
    .filter(ticker => !universeTickers.has(ticker))
    .sort();
  let snapshotTimestamp: number | null = null;

  for (const stock of universe) {
    const vector = featuresByTicker[stock.ticker];
    if (!vector) {
      missingTickers.push(stock.ticker);
      continue;
    }

    if (vector.ticker !== stock.ticker) {
      mismatchedTickers.push(`${stock.ticker}->${vector.ticker}`);
    }

    const parsedTimestamp = parseFeatureTimestamp(vector);
    if (parsedTimestamp === null) {
      invalidTimestampTickers.push(stock.ticker);
      continue;
    }

    if (snapshotTimestamp === null) {
      snapshotTimestamp = parsedTimestamp;
    } else if (parsedTimestamp !== snapshotTimestamp) {
      inconsistentTimestampTickers.push(stock.ticker);
    }
  }

  if (
    missingTickers.length > 0 ||
    mismatchedTickers.length > 0 ||
    unexpectedTickers.length > 0 ||
    invalidTimestampTickers.length > 0 ||
    inconsistentTimestampTickers.length > 0 ||
    duplicateUniverseTickers.length > 0 ||
    invalidUniverseTickers.length > 0
  ) {
    throw new ShortlistFeatureBoundaryError(
      missingTickers,
      mismatchedTickers,
      unexpectedTickers,
      invalidTimestampTickers,
      inconsistentTimestampTickers,
      duplicateUniverseTickers,
      invalidUniverseTickers,
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
