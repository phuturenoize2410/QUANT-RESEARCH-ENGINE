import {
  MarketAdapter,
  normalizeSharesPerLot,
} from './marketAdapter';

const IDX_BOARD_LOT_SHARES = 100;

/**
 * First concrete market implementation. IDX-specific conventions live here so
 * strategy, ML, risk and generic execution code do not need to know them.
 */
export const IDX_MARKET_ADAPTER: Readonly<MarketAdapter> = Object.freeze({
  identity: Object.freeze({
    marketId: 'IDX',
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
  }),
  microstructure: Object.freeze({
    sharesPerLot: () => normalizeSharesPerLot(IDX_BOARD_LOT_SHARES),
  }),
});
