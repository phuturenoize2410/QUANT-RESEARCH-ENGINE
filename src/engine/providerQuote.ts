import type { MarketDataSource, MarketQuote } from './dataProviders';
import { normalizeSymbol } from './market/instrumentIdentity';

export class ProviderQuoteError extends Error {
  readonly providerId: string;

  constructor(providerId: string, message: string) {
    super(message);
    this.name = 'ProviderQuoteError';
    this.providerId = providerId;
  }
}

export type ProviderQuoteInput = Omit<MarketQuote, 'ticker' | 'source'> & {
  ticker: string;
  source?: MarketDataSource;
};

/**
 * Canonical validation boundary for quote adapters. Future Google Finance,
 * free IDX, broker and paid-feed adapters should normalize vendor payloads here
 * before Feature Engine consumers see them.
 */
export function normalizeProviderQuote(
  providerId: string,
  providerSource: MarketDataSource,
  input: ProviderQuoteInput,
): Readonly<MarketQuote> {
  const ticker = normalizeSymbol(input.ticker);
  if (!ticker) throw new ProviderQuoteError(providerId, 'Quote ticker must be non-empty.');

  const numericFields = [
    input.price,
    input.open,
    input.high,
    input.low,
    input.close,
    input.change,
    input.changePct,
    input.volume,
    input.turnover,
  ];
  if (!numericFields.every(Number.isFinite)) {
    throw new ProviderQuoteError(providerId, 'Quote numeric fields must be finite.');
  }
  if (input.price < 0 || input.open < 0 || input.high < 0 || input.low < 0 || input.close < 0 || input.volume < 0 || input.turnover < 0) {
    throw new ProviderQuoteError(providerId, 'Quote price, OHLC, volume and turnover fields must be non-negative.');
  }
  if (input.high < input.low || input.high < input.open || input.high < input.close || input.low > input.open || input.low > input.close) {
    throw new ProviderQuoteError(providerId, 'Quote OHLC fields are internally inconsistent.');
  }

  // Quote timestamps are provider evidence, not display strings. Runtime adapters
  // may cross JSON/vendor boundaries despite the TypeScript contract, so reject
  // non-string or unparsable values and canonicalize accepted timestamps before
  // Feature Engine consumers see them. This prevents equivalent vendor timestamp
  // formats from leaking different identities into caching/provenance logic.
  const runtimeTimestamp = input.timestamp as unknown;
  if (typeof runtimeTimestamp !== 'string' || !runtimeTimestamp.trim()) {
    throw new ProviderQuoteError(providerId, 'Quote timestamp must be a valid ISO-compatible timestamp.');
  }
  const timestampMs = Date.parse(runtimeTimestamp);
  if (!Number.isFinite(timestampMs)) {
    throw new ProviderQuoteError(providerId, 'Quote timestamp must be a valid ISO-compatible timestamp.');
  }
  const timestamp = new Date(timestampMs).toISOString();

  if (input.source !== undefined && input.source !== providerSource) {
    throw new ProviderQuoteError(providerId, `Quote source ${input.source} does not match provider source ${providerSource}.`);
  }

  return Object.freeze({
    ...input,
    ticker,
    timestamp,
    source: providerSource,
  });
}
