export interface StrategyLabCombination {
  id: string;
  name: string;
  category: string;
  description: string;
  historicalSetups: number;
  greenOpenRate: number;
  avgNetGap: number;
  medianGap: number;
  badGapProb: number;
  severeGapProb: number;
  expectedValue: number;
  confidence: number;
  riskAdjustedEdgeScore: number;
  sampleTickers: string[];
}

export const STRATEGY_LAB_PROVENANCE = {
  mode: 'PROTOTYPE_SIMULATION' as const,
  isBacktestEvidence: false as const,
  label: 'Prototype / simulated research catalog — not backtest evidence',
  description:
    'These setup statistics are fixed demonstration assumptions retained from the prototype UI. Replace them only with point-in-time backtest outputs routed through the research application boundary.',
};

/**
 * Prototype-only setup catalog.
 *
 * Keeping these fixed demonstration assumptions outside React prevents UI code
 * from masquerading as a backtest engine and gives future real historical
 * research a single replacement seam. Values intentionally preserve the existing
 * Strategy Lab display until robust point-in-time backtests are available.
 */
export const PROTOTYPE_STRATEGY_LAB_CATALOG: ReadonlyArray<StrategyLabCombination> = Object.freeze([
  {
    id: 'close_high_vol',
    name: 'Close Near Daily High + Volume Breakout',
    category: 'Price & Volume',
    description: 'Close in top 20% of day candle with Relative Volume > 1.4x at 15:45 WIB.',
    historicalSetups: 214,
    greenOpenRate: 71.5,
    avgNetGap: 0.62,
    medianGap: 0.44,
    badGapProb: 4.8,
    severeGapProb: 1.4,
    expectedValue: 0.62,
    confidence: 88,
    riskAdjustedEdgeScore: 89,
    sampleTickers: ['BBCA', 'BMRI', 'TINS', 'ADRO'],
  },
  {
    id: 'tech_bandar',
    name: 'Technical MA Stacking + Bandarmology Accumulation',
    category: 'Institutional Flow',
    description: 'MA5 > MA10 > MA20 with Broker Concentration Diff > +18% and foreign inflow.',
    historicalSetups: 168,
    greenOpenRate: 69.8,
    avgNetGap: 0.58,
    medianGap: 0.38,
    badGapProb: 5.2,
    severeGapProb: 1.8,
    expectedValue: 0.58,
    confidence: 84,
    riskAdjustedEdgeScore: 86,
    sampleTickers: ['BBCA', 'BRIS', 'ANTM', 'ASII'],
  },
  {
    id: 'macd_vol_break',
    name: 'MACD Golden Cross + 10D Volume Breakout',
    category: 'Momentum Breakout',
    description: 'MACD histogram crossing into green with 10-day peak volume expansion into close.',
    historicalSetups: 142,
    greenOpenRate: 66.4,
    avgNetGap: 0.54,
    medianGap: 0.35,
    badGapProb: 6.8,
    severeGapProb: 2.1,
    expectedValue: 0.54,
    confidence: 81,
    riskAdjustedEdgeScore: 82,
    sampleTickers: ['ESSA', 'MDKA', 'PGAS'],
  },
  {
    id: 'ma_rel_vol',
    name: 'MA5 / MA10 Bullish Cross + Rel Vol > 1.3x',
    category: 'Trend & Liquidity',
    description: 'Short-term trend turn confirmed by institutional pre-closing volume surge.',
    historicalSetups: 285,
    greenOpenRate: 64.2,
    avgNetGap: 0.48,
    medianGap: 0.31,
    badGapProb: 7.4,
    severeGapProb: 2.4,
    expectedValue: 0.48,
    confidence: 90,
    riskAdjustedEdgeScore: 78,
    sampleTickers: ['BBRI', 'TLKM', 'INKP'],
  },
  {
    id: 'momentum_accum',
    name: 'Momentum 5D > 3% + Large Lot Accumulation',
    category: 'Institutional Flow',
    description: 'Active upward continuation backed by > 45% large transaction volume (>500 lots).',
    historicalSetups: 119,
    greenOpenRate: 65.0,
    avgNetGap: 0.51,
    medianGap: 0.33,
    badGapProb: 8.2,
    severeGapProb: 2.9,
    expectedValue: 0.51,
    confidence: 76,
    riskAdjustedEdgeScore: 75,
    sampleTickers: ['MEDC', 'TINS', 'ACES'],
  },
  {
    id: 'hammer_support',
    name: 'Bullish Hammer at 20MA Support',
    category: 'Mean Reversion',
    description: 'Intraday dip rejected with long lower shadow bouncing off 20-day moving average.',
    historicalSetups: 94,
    greenOpenRate: 61.2,
    avgNetGap: 0.39,
    medianGap: 0.25,
    badGapProb: 9.6,
    severeGapProb: 3.2,
    expectedValue: 0.39,
    confidence: 72,
    riskAdjustedEdgeScore: 68,
    sampleTickers: ['ICBP', 'CTRA', 'BSDE'],
  },
  {
    id: 'extended_breakout',
    name: 'Overextended 20D Breakout (RSI > 75)',
    category: 'High Volatility',
    description: 'Parabolic breakout closing near high, but already stretched > 12% from 20MA.',
    historicalSetups: 82,
    greenOpenRate: 53.5,
    avgNetGap: 0.42,
    medianGap: 0.15,
    badGapProb: 17.5,
    severeGapProb: 7.8,
    expectedValue: 0.22,
    confidence: 65,
    riskAdjustedEdgeScore: 42,
    sampleTickers: ['BREN', 'AMMN'],
  },
  {
    id: 'weak_vol_rally',
    name: 'Price Up + Weak Pre-Close Volume (Rel Vol < 0.8x)',
    category: 'Divergence Trap',
    description: 'Price ticks up near close but lacks institutional order volume support.',
    historicalSetups: 135,
    greenOpenRate: 46.2,
    avgNetGap: -0.12,
    medianGap: -0.08,
    badGapProb: 19.8,
    severeGapProb: 8.5,
    expectedValue: -0.15,
    confidence: 75,
    riskAdjustedEdgeScore: 28,
    sampleTickers: ['UNVR', 'BUFF', 'BSJP'],
  },
]);
