import { MarketId } from './marketAdapter';

/**
 * Globally unique canonical instrument identity. Provider symbols are metadata;
 * the quant/research core should key stored series by instrument identity so a
 * single canonical history can be sourced from different providers over time.
 */
export interface InstrumentRef {
  instrumentId: string;
  symbol: string;
  marketId: MarketId;
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Canonicalize market identity at the same boundary as provider symbols. Future
 * providers may report exchange ids with vendor-specific casing/whitespace; the
 * quant core must never create multiple instrument keys for formatting variants
 * of the same market.
 */
export function normalizeMarketId(marketId: MarketId): MarketId {
  return String(marketId).trim().toUpperCase() as MarketId;
}

export function buildInstrumentId(marketId: MarketId, symbol: string): string {
  return `${normalizeMarketId(marketId)}:${normalizeSymbol(symbol)}`;
}

export function createInstrumentRef(
  marketId: MarketId,
  symbol: string,
): InstrumentRef {
  const normalizedMarketId = normalizeMarketId(marketId);
  const normalizedSymbol = normalizeSymbol(symbol);
  return {
    instrumentId: buildInstrumentId(normalizedMarketId, normalizedSymbol),
    symbol: normalizedSymbol,
    marketId: normalizedMarketId,
  };
}
