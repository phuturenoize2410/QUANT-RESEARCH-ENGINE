/**
 * Market-state classification shared across provider, feature and strategy layers.
 *
 * This type intentionally lives in the market domain instead of Strategy Engine so
 * upstream data providers can report observed market state without depending on a
 * downstream strategy contract.
 */
export type MarketRegime =
  | 'BULLISH_TREND'
  | 'SIDEWAYS_RANGE'
  | 'HIGH_VOLATILITY'
  | 'BEARISH_CORRECTION';
