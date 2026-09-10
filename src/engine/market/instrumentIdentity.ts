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

export function buildInstrumentId(marketId: MarketId, symbol: string): string {
  return `${String(marketId).trim().toUpperCase()}:${normalizeSymbol(symbol)}`;
}

export function createInstrumentRef(
  marketId: MarketId,
  symbol: string,
): InstrumentRef {
  const normalizedSymbol = normalizeSymbol(symbol);
  return {
    instrumentId: buildInstrumentId(marketId, normalizedSymbol),
    symbol: normalizedSymbol,
    marketId,
  };
}
