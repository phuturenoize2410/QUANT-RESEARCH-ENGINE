import {
  MarketAdapter,
  normalizeSharesPerLot,
} from './marketAdapter';

const IDX_BOARD_LOT_SHARES = 100;

/**
 * Returns the official IDX price tick (fraksi harga) for a given price level.
 * - Price < 200: Rp 1
 * - Price 200 - 500: Rp 2
 * - Price 500 - 2000: Rp 5
 * - Price 2000 - 5000: Rp 10
 * - Price >= 5000: Rp 25
 */
export function getIdxTickSize(price: number): number {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

/**
 * Rounds a target price to the nearest valid IDX tick fraction.
 */
export function roundToIdxTick(price: number, direction: 'NEAREST' | 'UP' | 'DOWN' = 'NEAREST'): number {
  const tick = getIdxTickSize(price);
  if (direction === 'UP') return Math.ceil(price / tick) * tick;
  if (direction === 'DOWN') return Math.floor(price / tick) * tick;
  return Math.round(price / tick) * tick;
}

export interface IdxAutoRejectionLimits {
  readonly previousClose: number;
  readonly araPrice: number;
  readonly arbPrice: number;
  readonly maxGainPct: number;
  readonly maxLossPct: number;
}

/**
 * Calculates official IDX Auto Rejection Atas (ARA) and Auto Rejection Bawah (ARB) limits.
 * Symmetrical limits (Papan Reguler):
 * - Rp 50 - Rp 200: ±35%
 * - Rp 200 - Rp 5,000: ±25%
 * - > Rp 5,000: ±20%
 */
export function calculateIdxAutoRejectionLimits(previousClose: number): IdxAutoRejectionLimits {
  let limitPct = 0.25;
  if (previousClose < 200) limitPct = 0.35;
  else if (previousClose > 5000) limitPct = 0.20;

  const rawAra = previousClose * (1 + limitPct);
  const rawArb = previousClose * (1 - limitPct);

  const araPrice = roundToIdxTick(rawAra, 'DOWN');
  const arbPrice = Math.max(50, roundToIdxTick(rawArb, 'UP'));

  return {
    previousClose,
    araPrice,
    arbPrice,
    maxGainPct: Math.round(((araPrice - previousClose) / previousClose) * 1000) / 10,
    maxLossPct: Math.round(((arbPrice - previousClose) / previousClose) * 1000) / 10,
  };
}

/**
 * First concrete market implementation. IDX-specific conventions live here so
 * strategy, ML, risk and generic execution code do not need to know them.
 */
export const IDX_MARKET_ADAPTER: Readonly<MarketAdapter> = Object.freeze({
  identity: Object.freeze({
    marketId: 'IDX',
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
    timezoneLabel: 'WIB',
  }),
  microstructure: Object.freeze({
    sharesPerLot: () => normalizeSharesPerLot(IDX_BOARD_LOT_SHARES),
  }),
});
