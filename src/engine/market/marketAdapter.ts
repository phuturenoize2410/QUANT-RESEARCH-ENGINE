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
  /** Human-readable timezone label for market-local UI text, e.g. WIB or ET. */
  timezoneLabel: string;
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

/**
 * Formats prototype market-local clock labels without embedding exchange-specific
 * abbreviations in strategy/execution code. Calendar/session semantics can later
 * replace the simple clock string without changing downstream consumers.
 */
export function formatMarketTimeLabel(
  market: MarketAdapter,
  localTime: string,
  dayLabel: string = 'Today',
): string {
  const safeTime = localTime.trim();
  const safeDayLabel = dayLabel.trim();
  const parts = [safeDayLabel, safeTime, market.identity.timezoneLabel.trim()].filter(Boolean);
  return parts.join(' ');
}
