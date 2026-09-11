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
  simulations: number;
  medianEndingEquity: number;
  percentile5EndingEquity: number;
  percentile95EndingEquity: number;
  probabilityOfLoss: number;
  medianMaxDrawdown: number;
  worst5PctDrawdown: number;
}

export interface StrategyBacktestResult {
  strategyId: string;
  strategyName: string;
  period: string;
  sampleSize: number;
  trades: StrategyBacktestTrade[];
  totalReturnPct: number;
  annualizedReturnPct: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  var95: number;
  cvar95: number;
  avgWinPct: number;
  avgLossPct: number;
  expectancyPct: number;
  walkForward: WalkForwardResult;
  monteCarlo: MonteCarloResult;
}

export interface StrategyEngine {
  id: string;
  name: string;
  type: StrategyType;
  description: string;
  holdingPeriod: string;
  operationalSession: 'AM_SESSION' | 'PM_SESSION' | 'ANY';
  targetRegimes: MarketRegime[];
  parameters: StrategyParameter[];
  score(stock: StockData, params?: Record<string, any>): StrategyScoreResult;
  backtest(stock: StockData, bars: DailyBar[], params?: Record<string, any>): StrategyBacktestResult;
}
