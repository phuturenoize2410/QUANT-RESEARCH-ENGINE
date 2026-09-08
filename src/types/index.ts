export type DecisionCategory = 'STRONG BUY' | 'BUY' | 'WATCH' | 'SKIP' | 'AVOID';

export type BandarmologyStatus = 
  | 'STRONG ACCUMULATION'
  | 'ACCUMULATION'
  | 'NEUTRAL'
  | 'DISTRIBUTION'
  | 'STRONG DISTRIBUTION';

export type ExitDecisionStatus = 'TAKE PROFIT' | 'FLAT / EXIT' | 'CUT LOSS' | 'REVIEW';

export interface DailyBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // in shares
  turnover: number; // in IDR
  // Next day's open for overnight gap calculation
  nextOpen?: number;
  nextHigh?: number;
  nextLow?: number;
  nextClose?: number;
}

export interface TechnicalSignals {
  ma5: number;
  ma10: number;
  ma20: number;
  ma50: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  macdGoldenCross: boolean;
  momentum5d: number; // percentage
  momentum10d: number; // percentage
  relativeVolume: number; // compared to 20d avg
  volumeBreakout5d: boolean;
  volumeBreakout10d: boolean;
  volumeBreakout20d: boolean;
  closePositionInRange: number; // 0 to 1 (0 = low of day, 1 = high of day)
  isNearDailyHigh: boolean; // close >= low + 0.8 * (high - low)
  isExtended: boolean; // e.g. price > 1.15 * MA20 or RSI > 75
  isBullishCandle: boolean;
  isDoji: boolean;
  isHammer: boolean;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerMiddle: number;
  bollingerPosition: number; // % between bands
  breakout20d: boolean;
  atr14: number;
  distFrom52wHigh: number; // % from 52w high

  // Multi-Strategy Extended Indicators
  adx14?: number; // ADX trend strength (e.g. 15-45)
  maStackingBullish?: boolean; // MA5 > MA10 > MA20 > MA50
  high50d?: number;
  breakout50d?: boolean;
  pullbackToMa20?: boolean;
  tenkanSen?: number;
  kijunSen?: number;
  senkouSpanA?: number;
  senkouSpanB?: number;
  chikouSpan?: number;
  kumoCloudBreakout?: boolean;
  tenkanKijunCross?: boolean;
  intradayMorningSurge?: boolean;
  morningVolumeSurgeRatio?: number;
}

export interface BrokerConcentration {
  brokerCode: string;
  brokerName: string;
  type: 'BUYER' | 'SELLER';
  lot: number;
  avgPrice: number;
  value: number; // IDR
  percentage: number;
}

export interface BandarmologyData {
  status: BandarmologyStatus;
  score: number; // 0 - 100
  top3BuyerConcentration: number; // e.g. 64%
  top3SellerConcentration: number; // e.g. 38%
  brokerConcentrationDiff: number; // Buyer % - Seller %
  netForeignFlow: number; // IDR (positive = inflow)
  accumulationStreakDays: number;
  largeTxPercentage: number; // % volume from large lots (>500 lots)
  volumePriceDivergence: boolean;
  topBuyers: BrokerConcentration[];
  topSellers: BrokerConcentration[];
}

export interface HistoricalSetupStats {
  comparableSetupsCount: number;
  greenOpenCount: number;
  redOpenCount: number;
  flatOpenCount: number;
  greenOpenRate: number; // % 0 - 100
  avgOvernightGap: number; // % e.g. +0.65%
  medianOvernightGap: number; // %
  p25Gap: number;
  p75Gap: number;
  worstGap: number; // e.g. -3.4%
  bestGap: number; // e.g. +5.2%
  badGap1PctProb: number; // prob of gap < -1%
  severeGap2PctProb: number; // prob of gap < -2%
  extremeGap3PctProb: number; // prob of gap < -3%
  avgNegativeGap: number; // avg when gap is negative
  gapDownRecoveryRate: number; // % times stock recovers intraday after gap down (informational only)
  confidenceScore: number; // 0 - 100 (penalizes low sample size)
  matchedTrades: {
    date: string;
    entryClose: number;
    nextOpen: number;
    gapPct: number;
    dayReturnPct: number;
    relVolume: number;
    recoveredIntraday: boolean;
  }[];
}

export interface StockData {
  ticker: string;
  name: string;
  sector: string;
  price: number; // Current close / 15:45 price
  change: number; // in IDR
  changePct: number; // in %
  volume: number; // today's volume (shares)
  avgVolume?: number; // 20-day average volume
  turnover: number; // today's turnover (IDR)
  relativeVolume: number;
  high52w: number;
  low52w: number;
  historicalBars: DailyBar[];
  technical: TechnicalSignals;
  bandarmology: BandarmologyData;
  historicalStats: HistoricalSetupStats;
  
  // Scoring
  prefilterScore: number; // 0 - 100
  prefilterPassed: boolean;
  prefilterFailReasons: string[];
  
  technicalScore: number; // 0 - 100
  bandarmologyScore: number; // 0 - 100
  tailRiskScore: number; // 0 - 100 (higher means SAFER / lower tail risk)
  
  expectedGrossGap: number; // %
  expectedNetGap: number; // % (after estimated fees & slippage)
  estimatedFee: number; // %
  
  overnightEdgeScore: number; // 0 - 100
  quality: 'ELITE' | 'HIGH' | 'MEDIUM' | 'SPECULATIVE';
  decision: DecisionCategory;
  
  // AI-Style summary factors
  positiveFactors: string[];
  riskFactors: string[];
  aiConclusion: string;
}

export interface StrategySettings {
  // Weights (sum = 100 or normalized)
  greenOpenProbWeight: number; // default 25
  expectedNetReturnWeight: number; // default 15
  historicalConsistencyWeight: number; // default 15
  technicalQualityWeight: number; // default 15
  liquidityWeight: number; // default 10
  bandarmologyWeight: number; // default 10
  
  // Risk Penalties (deductions)
  badGapPenaltyWeight: number; // default 25 (gap < -1%)
  severeGapPenaltyWeight: number; // default 35 (gap < -2%)
  extremeTailPenaltyWeight: number; // default 40 (worst historical gap)
  overextendedPenaltyWeight: number; // default 20
  
  // Trading Costs
  buyFeePct: number; // default 0.15%
  sellFeePct: number; // default 0.25%
  slippagePct: number; // default 0.10%
  
  // Strategy Preferences
  minConfidenceSampleSize: number; // default 20
  minDailyTurnoverIDR: number; // default 5,000,000,000 (5 Milyar IDR)
}

export interface BacktestTrade {
  ticker: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number; // Next Open
  grossReturnPct: number;
  netReturnPct: number;
  isWin: boolean;
  isBadGap: boolean; // < -1%
  isSevereGap: boolean; // < -2%
}

export interface BacktestSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  flats: number;
  winRate: number; // %
  avgGrossReturn: number; // %
  avgNetReturn: number; // %
  medianNetReturn: number; // %
  profitFactor: number;
  expectedValuePerTrade: number; // %
  maxDrawdownPct: number; // %
  worstTradePct: number; // %
  bestTradePct: number; // %
  badGap1PctCount: number;
  badGap1PctRate: number; // %
  severeGap2PctCount: number;
  severeGap2PctRate: number; // %
  maxConsecutiveLosses: number;
  sharpeRatio: number;
  gapReturnDistribution: {
    range: string;
    count: number;
    percentage: number;
    isLoss: boolean;
  }[];
  equityCurve: {
    tradeNumber: number;
    date: string;
    equity: number;
  }[];
}

export interface MorningPosition {
  id: string;
  ticker: string;
  name: string;
  purchaseDate: string;
  entryPrice: number;
  lots: number;
  totalCostIDR: number;
  currentOpenPrice: number;
  openGapPct: number;
  grossProfitIDR: number;
  netProfitIDR: number;
  netProfitPct: number;
  cutLossLevel: number;
  takeProfitLevel: number;
  exitStatus: ExitDecisionStatus;
  notes: string;
}
