import { StockData, DailyBar } from '../types';
import { MarketRegime } from './market/marketRegime';

export type { MarketRegime } from './market/marketRegime';

export type StrategyType = 
  | 'OVERNIGHT' 
  | 'INTRADAY' 
  | 'TREND' 
  | 'MACD' 
  | 'ICHIMOKU' 
  | 'BREAKOUT' 
  | 'PULLBACK';

export type StrategySignal = 'STRONG BUY' | 'BUY' | 'WATCH' | 'NEUTRAL' | 'AVOID';

export interface StrategyParameter {
  id: string;
  name: string;
  type: 'number' | 'boolean' | 'select';
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: any }[];
  description: string;
}

export interface StrategyScoreResult {
  strategyId: string;
  strategyName: string;
  ticker: string;
  score: number; // 0 - 100
  signal: StrategySignal;
  confidenceScore: number; // 0 - 100 (penalizes low sample size)
  winRate: number; // % historical win rate for setup
  expectedReturnPct: number; // % expected return
  profitFactor: number;
  tailRiskScore: number; // 0 - 100 (higher = safer)
  badGapProbability: number; // % probability of severe negative open/loss
  holdingPeriod: string;
  positiveFactors: string[];
  riskFactors: string[];
  regimeSuitability: number; // % match for current market regime
  matchedSetupsCount: number;
}

export interface StrategyBacktestTrade {
  id: string;
  ticker: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  holdingDays: number;
  grossReturnPct: number;
  netReturnPct: number;
  isWin: boolean;
  maxAdverseExcursionPct: number; // Worst drawdown intra-trade
  reason: string;
  regime: MarketRegime;
}

export interface WalkForwardResult {
  trainWinRate: number;
  trainProfitFactor: number;
  trainTradesCount: number;
  validateWinRate: number;
  validateProfitFactor: number;
  validateTradesCount: number;
  testWinRate: number; // Out-of-sample test
  testProfitFactor: number;
  testTradesCount: number;
  robustnessScore: number; // 0 - 100 (degree of out-of-sample stability)
  isOverfitWarning: boolean;
}

export interface MonteCarloResult {
  iterations: number;
  medianFinalEquity: number;
  p5WorstCaseEquity: number; // 5th percentile worst-case path
  p95BestCaseEquity: number;
  probOfDrawdownOver10Pct: number; // %
  probOfDrawdownOver20Pct: number; // %
  probOfPositiveReturn: number; // %
  simulatedPaths: { pathId: number; points: number[] }[];
}

export interface StrategyBacktestResult {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  winRate: number;
  avgReturnPct: number;
  medianReturnPct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  var95: number; // Value at Risk 95%
  expectedShortfallCVaR: number; // Conditional VaR 95%
  worstTradePct: number;
  bestTradePct: number;
  avgWinPct: number;
  avgLossPct: number;
  calmarRatio: number;
  equityCurve: { date: string; equity: number; tradeNumber: number }[];
  trades: StrategyBacktestTrade[];
  regimeBreakdown: Record<MarketRegime, { winRate: number; tradeCount: number; avgReturnPct: number }>;
  walkForward?: WalkForwardResult;
  monteCarlo?: MonteCarloResult;
}

export interface StrategyEngine {
  id: string;
  name: string;
  type: StrategyType;
  description: string;
  holdingPeriod: string;
  operationalSession: 'AM_SESSION' | 'PM_SESSION' | 'ALL_DAY';
  targetRegimes: MarketRegime[];
  parameters: StrategyParameter[];
  score(stock: StockData, params?: Record<string, any>): StrategyScoreResult;
  backtest(
    stocks: StockData[], 
    params?: Record<string, any>, 
    options?: { trainSplit?: number; testSplit?: number; runMonteCarlo?: boolean }
  ): StrategyBacktestResult;
}

export interface EnsembleConsensus {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  consensusScore: number; // 0 - 100
  consensusSignal: 'STRONG BUY' | 'BUY' | 'WATCH' | 'AVOID';
  activeStrategiesCount: number;
  bestMatchingStrategyId: string;
  bestMatchingStrategyName: string;
  strategyScores: {
    strategyId: string;
    strategyName: string;
    score: number;
    signal: StrategySignal;
    weight: number;
    correlationDiscount: number;
  }[];
  keyStrengths: string[];
  keyRisks: string[];
  recommendedSession: 'AM_SESSION' | 'PM_SESSION';
}

export interface StockQuantProfile {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  trendScore: number; // 0 - 100
  momentumScore: number; // 0 - 100
  volatilityScore: number; // 0 - 100 (higher = calmer / lower risk)
  volumeBandarScore: number; // 0 - 100
  tailRiskScore: number; // 0 - 100 (higher = safer)
  overnightEdgeScore: number; // 0 - 100
  bestMatchingStrategyId: string;
  bestMatchingStrategyName: string;
  strategyFitScores: { strategyId: string; strategyName: string; fitScore: number; signal: StrategySignal }[];
  currentRegime: MarketRegime;
  var95: number;
  cvar95: number;
  analogCount: number;
}

export interface HistoricalAnalog {
  id: string;
  sourceTicker: string;
  matchedTicker: string;
  matchedDate: string;
  similarityPct: number; // 0 - 100%
  correlation: number;
  setupFactors: string[];
  nextDayReturnPct: number;
  next3DayReturnPct: number;
  next5DayReturnPct: number;
  next10DayReturnPct: number;
  maxDrawdownPct: number;
  wasProfitable: boolean;
  notes: string;
}

export interface ConditionCriterion {
  id: string;
  name: string;
  category: 'TREND' | 'MOMENTUM' | 'VOLUME' | 'BANDARMOLOGY' | 'VOLATILITY' | 'PRICE_ACTION';
  evaluate: (stock: StockData) => boolean;
  description: string;
}

export interface ConditionalProbabilityResult {
  conditionIds: string[];
  conditionNames: string[];
  totalPopulation: number;
  matchedSamples: number;
  matchRatePct: number;
  conditionalWinRate: number; // P(Positive Return | Conditions)
  baselineWinRate: number;
  winRateEdgePct: number; // Difference from baseline
  avgReturnPct: number;
  baselineAvgReturnPct: number;
  expectedEdgePct: number;
  severeLossProbability: number; // P(Loss < -2% | Conditions)
  baselineSevereLossProbability: number;
  confidenceScore: number; // Statistical sample size damped score
  sampleWarning?: string;
}
