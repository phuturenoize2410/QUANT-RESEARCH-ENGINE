// ============================================================================
// MACHINE LEARNING & ADAPTIVE QUANT ENGINE - TYPE DEFINITIONS
// ============================================================================

export type MLModelType = 
  | 'Logistic Regression'
  | 'Random Forest'
  | 'Gradient Boosting'
  | 'XGBoost'
  | 'LightGBM'
  | 'Neural Network (MLP)';

export type MLModelStatus = 'CHAMPION' | 'CHALLENGER' | 'CANDIDATE' | 'DEPRECATED';

export type ConfidenceLevel = 
  | 'VERY HIGH'
  | 'HIGH'
  | 'MODERATE'
  | 'LOW'
  | 'VERY LOW'
  | 'INSUFFICIENT DATA';

export type SystemDecision = 
  | 'QUALIFIED'
  | 'CAUTION'
  | 'CONFLICTING SIGNALS'
  | 'HIGH RISK'
  | 'NO TRADE';

export type IntradayClassification = 
  | 'GAP AND GO'
  | 'OPENING RANGE BREAKOUT'
  | 'TREND CONTINUATION'
  | 'GAP REVERSAL'
  | 'MORNING RECOVERY'
  | 'NO QUALIFIED SETUP';

export type EmergingLeaderClassification =
  | 'EARLY INFLECTION'
  | 'EMERGING LEADER'
  | 'QUALITY COMPOUNDER'
  | 'TURNAROUND'
  | 'SPECULATIVE'
  | 'INSUFFICIENT DATA';

export type HealthStatus = 'HEALTHY' | 'WATCH' | 'RETRAIN RECOMMENDED' | 'DEGRADED';

export interface SHAPContribution {
  featureName: string;
  featureCategory: 'PRICE' | 'TREND' | 'MOMENTUM' | 'VOLATILITY' | 'VOLUME' | 'LIQUIDITY' | 'OVERNIGHT' | 'INTRADAY' | 'MARKET' | 'SECTOR' | 'BROKER' | 'FUNDAMENTAL';
  value: number | string;
  contributionPct: number; // e.g. +8.4 or -4.1 percentage points
  description: string;
}

export interface MLPredictionExplanation {
  baseProbability: number;
  finalProbability: number;
  topPositiveFeatures: SHAPContribution[];
  topNegativeFeatures: SHAPContribution[];
  allFeatures: SHAPContribution[];
  modelType: MLModelType;
  modelVersion: string;
  isSimulated: boolean;
}

export interface CalibrationBucket {
  rangeLabel: string;
  predictedMin: number;
  predictedMax: number;
  predictedMid: number;
  observedWinRate: number;
  sampleCount: number;
  error: number; // observed - predicted
}

export interface ModelMetrics {
  auc: number;
  brierScore: number;
  calibrationError: number;
  precision: number;
  recall: number;
  f1Score: number;
  logLoss: number;
  testExpectancy: number; // Net % per trade
  sharpeRatio: number;
  maxDrawdown: number;
  cvar95: number;
}

export interface MLModelDefinition {
  modelId: string;
  modelName: string;
  modelType: MLModelType;
  target: string;
  features: string[];
  trainingWindow: string; // e.g. '2018-01-01 to 2022-12-31'
  validationWindow: string; // e.g. '2023-01-01 to 2023-12-31'
  testWindow: string; // e.g. '2024-01-01 to 2026-03-31'
  version: string;
  status: MLModelStatus;
  createdAt: string;
  lastTrained: string;
  hyperparameters: Record<string, string | number | boolean>;
  metrics: ModelMetrics;
  calibrationBuckets: CalibrationBucket[];
}

// 1. Overnight BSJP ML Prediction Output
export interface OvernightMLPrediction {
  ticker: string;
  modelId: string;
  modelVersion: string;
  // Primary target: P(Next Open > Entry + Costs + Slippage)
  probNetPositiveOpen: number; // % (e.g. 74)
  probGreenOpen: number; // % (gross open > close)
  probFlatOpen: number; // % (-0.5% to +0.5%)
  probNegativeOpen: number; // %
  probGapBelowHalfPct: number; // P(Gap < -0.5%)
  probGapBelowOnePct: number; // P(Gap < -1.0%)
  probGapBelowTwoPct: number; // P(Gap < -2.0%)
  expectedOvernightReturnNet: number; // e.g. +0.82%
  medianExpectedOutcome: number; // e.g. +0.65%
  tailRiskEstimateCVaR: number; // e.g. -2.35%
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-100
  explanation: MLPredictionExplanation;
}

// 2. Gap Risk ML Output
export interface GapRiskMLPrediction {
  ticker: string;
  gapRiskScore: number; // 0-100 (lower is safer)
  riskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  probGapNegative: number; // P(Gap < 0)
  probGapBelowHalfPct: number; // P(Gap < -0.5%)
  probGapBelowOnePct: number; // P(Gap < -1.0%)
  probGapBelowTwoPct: number; // P(Gap < -2.0%)
  probGapBelowThreePct: number; // P(Gap < -3.0%)
  expectedShortfallCVaR: number; // % worst 5% average
  tailProbability: number;
  historicalWorstAnalog: {
    date: string;
    gapPct: number;
    subsequentLowPct: number;
    catalyst: string;
  };
  confidence: ConfidenceLevel;
}

// 3. Intraday BPJS ML Output
export interface IntradayMLPrediction {
  ticker: string;
  probPositiveIntraday: number; // P(Close > Morning Entry + Costs)
  expectedIntradayReturn: number; // %
  downsideProbability: number; // %
  classification: IntradayClassification;
  recommendedSetup: string;
  confidence: ConfidenceLevel;
  explanation: MLPredictionExplanation;
}

// 4. Swing ML Output (Multi-Horizon)
export interface SwingHorizonPrediction {
  horizonDays: 3 | 5 | 10 | 20;
  probPositiveReturn: number;
  probTargetReturn: number; // e.g. > +3% or > +5%
  expectedReturn: number;
  expectedDrawdown: number;
  trendPersistenceProb: number;
  breakoutFailureProb: number;
}

export interface SwingMLPrediction {
  ticker: string;
  horizons: Record<string, SwingHorizonPrediction>;
  primaryHorizon: 5;
  confidence: ConfidenceLevel;
  recommendation: 'ACCUMULATE' | 'MOMENTUM_ENTRY' | 'WAIT_FOR_PULLBACK' | 'NEUTRAL' | 'AVOID';
}

// 5. Trend Persistence ML Output
export interface TrendPersistenceMLPrediction {
  ticker: string;
  trendPersistenceProb: number; // % chance trend continues next 10 bars
  trendFailureProb: number;
  expectedTrendDurationDays: number;
  overextensionRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  overextensionScore: number; // 0-100
  trendQuality: number; // 0-100
  supportDefenseProbability: number;
}

// 6. Breakout Failure ML Output
export interface BreakoutFailureMLPrediction {
  ticker: string;
  breakoutSuccessProb: number;
  falseBreakoutProb: number; // Trap risk
  expectedFollowThroughPct: number;
  expectedDrawdownPct: number;
  isVolumeConfirmed: boolean;
  volatilityCompressionPreBreakout: boolean;
  confidence: ConfidenceLevel;
}

// 7. Hidden Gem / Emerging Leader ML Output
export interface EmergingLeaderMLPrediction {
  ticker: string;
  emergingLeaderProb: number;
  fundamentalInflectionScore: number; // 0-100
  qualityScore: number; // 0-100
  growthScore: number; // 0-100
  valuationScore: number; // 0-100
  marketConfirmationScore: number; // 0-100
  riskScore: number; // 0-100
  classification: EmergingLeaderClassification;
  researchConfidence: ConfidenceLevel;
  inflectionDrivers: string[];
}

// ML Strategy Router Output
export interface StrategySuitability {
  strategyId: string;
  strategyName: string;
  suitabilityProb: number; // 0-100%
  regimeFitScore: number;
  recentRollingSharpe: number;
  recentDrawdownPct: number;
  status: 'PRIMARY' | 'SECONDARY' | 'NEUTRAL' | 'AVOID';
  rationale: string;
}

export interface MLStrategyRouterOutput {
  marketRegime: string;
  volatilityRegime: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH_VOLATILITY';
  liquidityState: 'ABUNDANT' | 'NORMAL' | 'TIGHT';
  primaryStrategy: StrategySuitability;
  secondaryStrategy: StrategySuitability;
  avoidStrategies: StrategySuitability[];
  allRanked: StrategySuitability[];
  quantVsMlAgreement: 'STRONG_AGREEMENT' | 'MODERATE_AGREEMENT' | 'DISAGREEMENT' | 'DIVERGENCE';
  disagreementNotes?: string;
}

// Quant + ML Ensemble Output for a Stock
export interface QuantMLEnsembleOutput {
  ticker: string;
  quantRuleScore: number; // 0-100
  statisticalEdgeScore: number; // 0-100
  mlProbability: number; // % (e.g. 74)
  historicalAnalogScore: number; // 0-100
  regimeFitScore: number; // 0-100
  tailRiskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'SEVERE';
  tailRiskScore: number; // 0-100
  finalQuantMLEdge: number; // 0-100
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-100
  agreementStatus: 'AGREEMENT' | 'MODEL DISAGREEMENT';
  agreementDetails: string;
  systemDecision: SystemDecision;
  decisionRationale: string[];
  keyRisks: string[];
  recommendedPositionSizePct: number;
  entryTrigger: string;
  exitRule: string;
}

// Portfolio ML Risk
export interface PortfolioMLRisk {
  portfolioHeatScore: number; // 0-100
  portfolioHeatStatus: 'COOL' | 'MODERATE' | 'ELEVATED' | 'OVERHEATED';
  correlationRiskScore: number; // 0-100
  sectorConcentrations: { sector: string; weightPct: number; maxAllowedPct: number }[];
  strategyConcentrations: { strategy: string; weightPct: number }[];
  tailRiskAggregateCVaR: number;
  recommendation: string;
}

// Walk Forward ML Evaluation
export interface WalkForwardMLEval {
  cycleId: string;
  trainRange: string;
  valRange: string;
  testRange: string;
  trainAuc: number;
  valAuc: number;
  testAuc: number;
  trainExpectancy: number;
  testExpectancy: number;
  calibrationError: number;
  performanceDecayPct: number;
  stabilityScore: number; // 0-100
  overfitRisk: 'LOW' | 'MODERATE' | 'POSSIBLE OVERFIT';
}

// Data Leakage Validation Check
export interface DataLeakageCheckResult {
  status: 'NO LEAKAGE DETECTED' | 'POTENTIAL LEAKAGE' | 'RESEARCH INVALID';
  checkedAt: string;
  verifiedFeaturesCount: number;
  leakageTests: {
    testName: string;
    description: string;
    passed: boolean;
    details: string;
  }[];
}

// Champion vs Challenger Comparison
export interface ChampionChallengerComparison {
  strategyName: string;
  champion: MLModelDefinition;
  challenger: MLModelDefinition;
  recommendation: 'KEEP CHAMPION' | 'PROMOTE CHALLENGER';
  recommendationRationale: string[];
  metricComparisons: {
    metric: string;
    championValue: number | string;
    challengerValue: number | string;
    delta: number;
    winner: 'CHAMPION' | 'CHALLENGER' | 'TIE';
  }[];
}

// Model Drift Metrics
export interface ModelDriftMetrics {
  modelId: string;
  modelName: string;
  overallHealth: HealthStatus;
  predictionDriftKSScore: number; // Kolmogorov-Smirnov test proxy
  featureDriftPSIScore: number; // Population Stability Index
  performanceDriftWinRateDiff: number; // recent win rate vs training
  calibrationDriftError: number;
  regimeFamiliarityPct: number;
  recentActualWinRate: number;
  recentExpectedWinRate: number;
  recentSampleSize: number;
  lastAuditDate: string;
  recommendation: string;
}

// Retraining History Record
export interface RetrainingRecord {
  id: string;
  timestamp: string;
  modelName: string;
  previousVersion: string;
  newCandidateVersion: string;
  triggerReason: string;
  dataPointsAdded: number;
  validationOutcome: 'PROMOTED' | 'REJECTED' | 'PENDING_AUDIT';
  details: string;
}

// Unified Feature Vector
export interface TickerFeatureVector {
  ticker: string;
  timestamp: string;
  // Category: PRICE
  price: number;
  return1d: number;
  return3d: number;
  return5d: number;
  return10d: number;
  return20d: number;
  closePositionWithinRange: number; // 0 to 1
  distanceFrom52wHighPct: number;
  // Category: TREND
  ma5: number;
  ma10: number;
  ma20: number;
  ma50: number;
  ma200: number;
  isMaAligned: boolean;
  adx14: number;
  ichimokuSpanA: number;
  ichimokuSpanB: number;
  isAboveCloud: boolean;
  // Category: MOMENTUM
  rsi14: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  macdHistExpansion: boolean;
  // Category: VOLATILITY
  atr14: number;
  atrPct: number;
  bollingerBandwidth: number;
  volatilityCompressionRatio: number;
  // Category: VOLUME
  volume: number;
  avgVolume20: number;
  relativeVolume: number;
  volumeAcceleration: number;
  turnoverIDR: number;
  // Category: LIQUIDITY
  spreadProxyPct: number;
  marketDepthRatio: number;
  liquidityScore: number;
  // Category: OVERNIGHT
  overnightPersistenceScore: number;
  historicalGreenOpenRate: number;
  avgOvernightGapPct: number;
  negativeGapRatePct: number;
  cvar95Overnight: number;
  // Category: INTRADAY
  openToHighPct: number;
  openToClosePct: number;
  morningRangePct: number;
  vwapRelation: 'ABOVE_VWAP' | 'AT_VWAP' | 'BELOW_VWAP';
  // Category: MARKET
  ihsgRegime: string;
  marketBreadthPctAboveMa20: number;
  marketVolatilityIndex: number;
  // Category: SECTOR
  sector: string;
  sectorRelativeStrength: number;
  sectorMomentumRank: number;
  // Category: BROKER
  brokerAccumulationScore: number;
  foreignNetFlowRatio: number;
  // Category: FUNDAMENTAL
  revenueGrowthYoy: number;
  netMarginPct: number;
  roePct: number;
  pbvRatio: number;
  peRatio: number;
  fundamentalInflectionScore: number;
}
