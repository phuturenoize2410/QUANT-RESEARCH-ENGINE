export type MarketId = 'IDX' | 'US' | (string & {});
export type CurrencyCode = 'IDR' | 'USD' | (string & {});

/**
 * Minimal market identity carried by market-specific adapters. The quant/ML core
 * should depend on this contract instead of embedding exchange conventions.
 */
export interface MarketIdentity {
  marketId: MarketId;
  currency: CurrencyCode;
  timezone: string;
}

/**
 * Market microstructure rules that affect whether an order/execution simulation
 * is valid. Keep the first contract intentionally small: add rules only when an
 * implemented IDX workflow needs them, while leaving room for a future US adapter.
 */
export interface MarketMicrostructureRules {
  /** Number of shares represented by one board lot for the instrument. */
  sharesPerLot(symbol?: string): number;
}

export interface MarketAdapter {
  readonly identity: MarketIdentity;
  readonly microstructure: MarketMicrostructureRules;
}

export function normalizeSharesPerLot(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.max(1, Math.floor(value));
}
