// ============================================================================
// MODEL REGISTRY, CHAMPION VS CHALLENGER, DRIFT & CALIBRATION LAB
// ============================================================================
import {
  MLModelDefinition,
  ChampionChallengerComparison,
  WalkForwardMLEval,
  CalibrationBucket,
  ModelDriftMetrics,
  RetrainingRecord
} from './types';

// ============================================================================
// 1. CHAMPION & CHALLENGER MODEL DEFINITIONS
// ============================================================================

export const CHAMPION_OVERNIGHT_MODEL: MLModelDefinition = {
  modelId: 'overnight-xgb-v3',
  modelName: 'Overnight-XGB-v3 (Champion)',
  modelType: 'XGBoost',
  target: 'P(Next Open > Entry + 0.40% Costs)',
  features: [
    'relativeVolume', 'closePositionRange', 'isMaAligned', 'brokerAccumulationScore',
    'historicalGreenOpenRate', 'atrPct', 'rsi14', 'ihsgRegime', 'spreadProxyPct'
  ],
  trainingWindow: '2018-01-01 to 2022-12-31 (5 Years)',
  validationWindow: '2023-01-01 to 2023-12-31 (1 Year)',
  testWindow: '2024-01-01 to 2026-03-31 (Out-of-Sample)',
  version: '3.2.1',
  status: 'CHAMPION',
  createdAt: '2024-04-12',
  lastTrained: '2025-11-20',
  hyperparameters: {
    max_depth: 4,
    learning_rate: 0.03,
    n_estimators: 280,
    subsample: 0.8,
    colsample_bytree: 0.75,
    min_child_weight: 5,
    gamma: 0.15
  },
  metrics: {
    auc: 0.762,
    brierScore: 0.184,
    calibrationError: 0.032,
    precision: 0.718,
    recall: 0.745,
    f1Score: 0.731,
    logLoss: 0.528,
    testExpectancy: 0.84, // +0.84% net per trade
    sharpeRatio: 1.94,
    maxDrawdown: -4.8,
    cvar95: -2.15
  },
  calibrationBuckets: [
    { rangeLabel: '50% – 55%', predictedMin: 50, predictedMax: 55, predictedMid: 52.5, observedWinRate: 51.8, sampleCount: 340, error: -0.7 },
    { rangeLabel: '55% – 60%', predictedMin: 55, predictedMax: 60, predictedMid: 57.5, observedWinRate: 58.2, sampleCount: 412, error: +0.7 },
    { rangeLabel: '60% – 65%', predictedMin: 60, predictedMax: 65, predictedMid: 62.5, observedWinRate: 61.9, sampleCount: 520, error: -0.6 },
    { rangeLabel: '65% – 70%', predictedMin: 65, predictedMax: 70, predictedMid: 67.5, observedWinRate: 68.4, sampleCount: 480, error: +0.9 },
    { rangeLabel: '70% – 75%', predictedMin: 70, predictedMax: 75, predictedMid: 72.5, observedWinRate: 71.6, sampleCount: 390, error: -0.9 },
    { rangeLabel: '> 75%', predictedMin: 75, predictedMax: 100, predictedMid: 78.5, observedWinRate: 77.2, sampleCount: 260, error: -1.3 }
  ]
};

export const CHALLENGER_OVERNIGHT_MODEL: MLModelDefinition = {
  modelId: 'overnight-lgbm-v4',
  modelName: 'Overnight-LightGBM-v4 (Challenger Candidate)',
  modelType: 'LightGBM',
  target: 'P(Next Open > Entry + 0.40% Costs)',
  features: [
    'relativeVolume', 'closePositionRange', 'isMaAligned', 'brokerAccumulationScore',
    'historicalGreenOpenRate', 'atrPct', 'rsi14', 'ihsgRegime', 'spreadProxyPct',
    'volatilityCompressionRatio', 'foreignNetFlowRatio'
  ],
  trainingWindow: '2019-01-01 to 2023-12-31 (5 Years)',
  validationWindow: '2024-01-01 to 2024-12-31 (1 Year)',
  testWindow: '2025-01-01 to 2026-03-31 (Out-of-Sample)',
  version: '4.0.0-rc2',
  status: 'CHALLENGER',
  createdAt: '2026-01-15',
  lastTrained: '2026-02-28',
  hyperparameters: {
    num_leaves: 24,
    learning_rate: 0.025,
    n_estimators: 350,
    feature_fraction: 0.70,
    bagging_fraction: 0.85,
    min_data_in_leaf: 20
  },
  metrics: {
    auc: 0.781,
    brierScore: 0.176,
    calibrationError: 0.024,
    precision: 0.742,
    recall: 0.758,
    f1Score: 0.750,
    logLoss: 0.505,
    testExpectancy: 0.98, // +0.98% net per trade
    sharpeRatio: 2.18,
    maxDrawdown: -4.1,
    cvar95: -1.88
  },
  calibrationBuckets: [
    { rangeLabel: '50% – 55%', predictedMin: 50, predictedMax: 55, predictedMid: 52.5, observedWinRate: 52.9, sampleCount: 310, error: +0.4 },
    { rangeLabel: '55% – 60%', predictedMin: 55, predictedMax: 60, predictedMid: 57.5, observedWinRate: 57.8, sampleCount: 395, error: +0.3 },
    { rangeLabel: '60% – 65%', predictedMin: 60, predictedMax: 65, predictedMid: 62.5, observedWinRate: 63.1, sampleCount: 480, error: +0.6 },
    { rangeLabel: '65% – 70%', predictedMin: 65, predictedMax: 70, predictedMid: 67.5, observedWinRate: 68.0, sampleCount: 510, error: +0.5 },
    { rangeLabel: '70% – 75%', predictedMin: 70, predictedMax: 75, predictedMid: 72.5, observedWinRate: 73.1, sampleCount: 420, error: +0.6 },
    { rangeLabel: '> 75%', predictedMin: 75, predictedMax: 100, predictedMid: 79.0, observedWinRate: 78.8, sampleCount: 290, error: -0.2 }
  ]
};

// ============================================================================
// 2. CHAMPION VS CHALLENGER COMPARISON
// ============================================================================

export function getChampionChallengerComparison(): ChampionChallengerComparison {
  const champ = CHAMPION_OVERNIGHT_MODEL;
  const chal = CHALLENGER_OVERNIGHT_MODEL;

  return {
    strategyName: 'Overnight Edge (BSJP)',
    champion: champ,
    challenger: chal,
    recommendation: 'PROMOTE CHALLENGER',
    recommendationRationale: [
      'Challenger achieved higher Out-of-Sample AUC (0.781 vs 0.762) across recent 2025–2026 market cycles.',
      'Calibration Error improved to 2.4% (vs 3.2% Champion), showing tighter probability calibration.',
      '95% Value-at-Risk / CVaR improved from -2.15% to -1.88%, demonstrating superior downside tail management.',
      'Test Expectancy increased from +0.84% to +0.98% net return per trade after 0.40% execution friction.'
    ],
    metricComparisons: [
      {
        metric: 'ROC-AUC (Out-of-Sample)',
        championValue: champ.metrics.auc.toFixed(3),
        challengerValue: chal.metrics.auc.toFixed(3),
        delta: Math.round((chal.metrics.auc - champ.metrics.auc) * 1000) / 1000,
        winner: 'CHALLENGER'
      },
      {
        metric: 'Brier Score (Lower is Better)',
        championValue: champ.metrics.brierScore.toFixed(3),
        challengerValue: chal.metrics.brierScore.toFixed(3),
        delta: Math.round((chal.metrics.brierScore - champ.metrics.brierScore) * 1000) / 1000,
        winner: 'CHALLENGER'
      },
      {
        metric: 'Expected Calibration Error (ECE)',
        championValue: `${(champ.metrics.calibrationError * 100).toFixed(1)}%`,
        challengerValue: `${(chal.metrics.calibrationError * 100).toFixed(1)}%`,
        delta: -0.8,
        winner: 'CHALLENGER'
      },
      {
        metric: 'Net Test Expectancy / Trade',
        championValue: `+${champ.metrics.testExpectancy}%`,
        challengerValue: `+${chal.metrics.testExpectancy}%`,
        delta: +0.14,
        winner: 'CHALLENGER'
      },
      {
        metric: 'Sharpe Ratio (Annualized)',
        championValue: champ.metrics.sharpeRatio.toFixed(2),
        challengerValue: chal.metrics.sharpeRatio.toFixed(2),
        delta: +0.24,
        winner: 'CHALLENGER'
      },
      {
        metric: 'Max Out-of-Sample Drawdown',
        championValue: `${champ.metrics.maxDrawdown}%`,
        challengerValue: `${chal.metrics.maxDrawdown}%`,
        delta: +0.7,
        winner: 'CHALLENGER'
      },
      {
        metric: 'Expected Shortfall (CVaR 95%)',
        championValue: `${champ.metrics.cvar95}%`,
        challengerValue: `${chal.metrics.cvar95}%`,
        delta: +0.27,
        winner: 'CHALLENGER'
      }
    ]
  };
}

// ============================================================================
// 3. WALK-FORWARD ML VALIDATION RECORDS
// ============================================================================

export const WALK_FORWARD_RECORDS: WalkForwardMLEval[] = [
  {
    cycleId: 'WF-CYCLE-1 (2018–2021)',
    trainRange: '2018–2020 (Train)',
    valRange: '2021-H1 (Val)',
    testRange: '2021-H2 (Out-of-Sample)',
    trainAuc: 0.792,
    valAuc: 0.768,
    testAuc: 0.755,
    trainExpectancy: 1.05,
    testExpectancy: 0.82,
    calibrationError: 0.034,
    performanceDecayPct: 4.6,
    stabilityScore: 88,
    overfitRisk: 'LOW'
  },
  {
    cycleId: 'WF-CYCLE-2 (2019–2022)',
    trainRange: '2019–2021 (Train)',
    valRange: '2022-H1 (Val)',
    testRange: '2022-H2 (Out-of-Sample)',
    trainAuc: 0.785,
    valAuc: 0.759,
    testAuc: 0.748,
    trainExpectancy: 0.98,
    testExpectancy: 0.79,
    calibrationError: 0.038,
    performanceDecayPct: 4.7,
    stabilityScore: 86,
    overfitRisk: 'LOW'
  },
  {
    cycleId: 'WF-CYCLE-3 (2020–2023)',
    trainRange: '2020–2022 (Train)',
    valRange: '2023-H1 (Val)',
    testRange: '2023-H2 (Out-of-Sample)',
    trainAuc: 0.794,
    valAuc: 0.765,
    testAuc: 0.761,
    trainExpectancy: 1.12,
    testExpectancy: 0.88,
    calibrationError: 0.031,
    performanceDecayPct: 4.1,
    stabilityScore: 91,
    overfitRisk: 'LOW'
  },
  {
    cycleId: 'WF-CYCLE-4 (2021–2024)',
    trainRange: '2021–2023 (Train)',
    valRange: '2024-H1 (Val)',
    testRange: '2024-H2 (Out-of-Sample)',
    trainAuc: 0.802,
    valAuc: 0.772,
    testAuc: 0.768,
    trainExpectancy: 1.15,
    testExpectancy: 0.91,
    calibrationError: 0.029,
    performanceDecayPct: 4.2,
    stabilityScore: 92,
    overfitRisk: 'LOW'
  },
  {
    cycleId: 'WF-CYCLE-5 (2022–2025 Current)',
    trainRange: '2022–2024 (Train)',
    valRange: '2025-H1 (Val)',
    testRange: '2025-H2–Present (Out-of-Sample)',
    trainAuc: 0.814,
    valAuc: 0.784,
    testAuc: 0.781,
    trainExpectancy: 1.20,
    testExpectancy: 0.98,
    calibrationError: 0.024,
    performanceDecayPct: 4.0,
    stabilityScore: 94,
    overfitRisk: 'LOW'
  }
];

// ============================================================================
// 4. MODEL DRIFT MONITORING
// ============================================================================

export const ACTIVE_DRIFT_METRICS: ModelDriftMetrics[] = [
  {
    modelId: 'overnight-xgb-v3',
    modelName: 'Overnight Edge (BSJP) XGBoost',
    overallHealth: 'HEALTHY',
    predictionDriftKSScore: 0.042, // KS < 0.10 is stable
    featureDriftPSIScore: 0.068, // PSI < 0.10 is stable
    performanceDriftWinRateDiff: -1.2, // Actual win rate 70.8% vs expected 72.0%
    calibrationDriftError: 0.032,
    regimeFamiliarityPct: 92,
    recentActualWinRate: 70.8,
    recentExpectedWinRate: 72.0,
    recentSampleSize: 142,
    lastAuditDate: '2026-03-01',
    recommendation: 'Model performing within normal statistical variance. No retraining urgency.'
  },
  {
    modelId: 'gap-risk-lightgbm-v2',
    modelName: 'Gap-Down Tail Risk LightGBM',
    overallHealth: 'HEALTHY',
    predictionDriftKSScore: 0.038,
    featureDriftPSIScore: 0.054,
    performanceDriftWinRateDiff: +0.6,
    calibrationDriftError: 0.028,
    regimeFamiliarityPct: 95,
    recentActualWinRate: 88.5,
    recentExpectedWinRate: 88.0,
    recentSampleSize: 142,
    lastAuditDate: '2026-03-01',
    recommendation: 'Tail risk estimates accurately bounding severe drawdowns.'
  },
  {
    modelId: 'intraday-rf-v2',
    modelName: 'Morning Intraday Momentum Random Forest',
    overallHealth: 'WATCH',
    predictionDriftKSScore: 0.115, // mild drift
    featureDriftPSIScore: 0.128, // elevated PSI in opening volume features
    performanceDriftWinRateDiff: -4.8, // 61.2% actual vs 66.0% expected
    calibrationDriftError: 0.062,
    regimeFamiliarityPct: 78,
    recentActualWinRate: 61.2,
    recentExpectedWinRate: 66.0,
    recentSampleSize: 85,
    lastAuditDate: '2026-03-01',
    recommendation: 'Opening auction turnover patterns showing mild drift. Flagged for scheduled monthly retraining.'
  },
  {
    modelId: 'emerging-leader-lgbm-v1',
    modelName: 'Emerging Leader Fundamental Inflection',
    overallHealth: 'HEALTHY',
    predictionDriftKSScore: 0.025,
    featureDriftPSIScore: 0.040,
    performanceDriftWinRateDiff: +1.5,
    calibrationDriftError: 0.035,
    regimeFamiliarityPct: 88,
    recentActualWinRate: 68.0,
    recentExpectedWinRate: 66.5,
    recentSampleSize: 40,
    lastAuditDate: '2026-02-15',
    recommendation: 'Long-horizon fundamental momentum features holding robust calibration.'
  }
];

// ============================================================================
// 5. RETRAINING HISTORY & PIPELINE
// ============================================================================

export const RETRAINING_HISTORY: RetrainingRecord[] = [
  {
    id: 'retrain-004',
    timestamp: '2026-02-28 23:45 WIB',
    modelName: 'Overnight Edge (BSJP)',
    previousVersion: '3.2.1 (XGBoost)',
    newCandidateVersion: '4.0.0-rc2 (LightGBM)',
    triggerReason: 'Quarterly scheduled challenger evaluation & hyperparameter search',
    dataPointsAdded: 3250,
    validationOutcome: 'PENDING_AUDIT',
    details: 'Challenger showed +0.14% higher net expectancy and tighter calibration error (2.4%). Ready for promotion review.'
  },
  {
    id: 'retrain-003',
    timestamp: '2025-11-20 22:10 WIB',
    modelName: 'Overnight Edge (BSJP)',
    previousVersion: '3.1.0',
    newCandidateVersion: '3.2.1',
    triggerReason: 'Added foreign institutional net broker flow interaction features',
    dataPointsAdded: 2800,
    validationOutcome: 'PROMOTED',
    details: 'Promoted to Champion. Out-of-sample AUC improved from 0.748 to 0.762.'
  },
  {
    id: 'retrain-002',
    timestamp: '2025-08-14 20:00 WIB',
    modelName: 'Gap-Down Tail Risk',
    previousVersion: '2.3.0',
    newCandidateVersion: '2.4.0',
    triggerReason: 'Post-August 2024 global flash sell-off stress scenario calibration',
    dataPointsAdded: 1950,
    validationOutcome: 'PROMOTED',
    details: 'Calibrated CVaR tail risk to incorporate rapid foreign outflow stress events.'
  },
  {
    id: 'retrain-001',
    timestamp: '2025-05-10 18:30 WIB',
    modelName: 'Intraday Morning Momentum',
    previousVersion: '2.0.0',
    newCandidateVersion: '2.1.0',
    triggerReason: 'Refined 09:05–09:15 WIB opening range volume threshold filters',
    dataPointsAdded: 2100,
    validationOutcome: 'PROMOTED',
    details: 'Reduced false breakout entries on low relative volume stocks.'
  }
];

// ============================================================================
// 6. LEARNING FROM ACTUAL TRADES (EXPECTED VS ACTUAL RESIDUALS)
// ============================================================================

export interface ActualTradeResidual {
  id: string;
  ticker: string;
  strategy: string;
  entryDate: string;
  predictedProbability: number; // e.g. 74%
  expectedNetReturnPct: number; // e.g. +0.48%
  expectedGapPct: number; // e.g. +0.88%
  actualGapPct: number; // e.g. +1.46%
  actualNetReturnPct: number; // e.g. +1.06%
  slippagePct: number; // e.g. 0.05%
  marketRegime: string;
  modelVersion: string;
  outcome: 'WIN' | 'LOSS' | 'FLAT';
  residualError: number; // actual - expected
  researchNotes: string;
}

export const INITIAL_ACTUAL_TRADE_RESIDUALS: ActualTradeResidual[] = [
  {
    id: 'res-1',
    ticker: 'BBCA',
    strategy: 'Overnight Edge (BSJP)',
    entryDate: 'Yesterday 15:42 WIB',
    predictedProbability: 76,
    expectedNetReturnPct: 0.85,
    expectedGapPct: 1.25,
    actualGapPct: 1.46,
    actualNetReturnPct: 1.06,
    slippagePct: 0.04,
    marketRegime: 'BULLISH ACCUMULATION',
    modelVersion: '3.2.1',
    outcome: 'WIN',
    residualError: +0.21,
    researchNotes: 'Clean follow-through. Institutional broker accumulation held overnight.'
  },
  {
    id: 'res-2',
    ticker: 'BRIS',
    strategy: 'Overnight Edge (BSJP)',
    entryDate: 'Yesterday 15:44 WIB',
    predictedProbability: 72,
    expectedNetReturnPct: 1.10,
    expectedGapPct: 1.50,
    actualGapPct: 2.30,
    actualNetReturnPct: 1.90,
    slippagePct: 0.08,
    marketRegime: 'BULLISH ACCUMULATION',
    modelVersion: '3.2.1',
    outcome: 'WIN',
    residualError: +0.80,
    researchNotes: 'Exceeded expectation. Heavy opening volume absorbed by domestic retail buyers.'
  },
  {
    id: 'res-3',
    ticker: 'ASII',
    strategy: 'Overnight Edge (BSJP)',
    entryDate: 'Yesterday 15:38 WIB',
    predictedProbability: 64,
    expectedNetReturnPct: 0.45,
    expectedGapPct: 0.85,
    actualGapPct: 0.98,
    actualNetReturnPct: 0.57,
    slippagePct: 0.05,
    marketRegime: 'BULLISH ACCUMULATION',
    modelVersion: '3.2.1',
    outcome: 'WIN',
    residualError: +0.12,
    researchNotes: 'Normal distribution outcome; early exit taken at 09:03 WIB.'
  },
  {
    id: 'res-4',
    ticker: 'MBMA',
    strategy: 'Overnight Edge (BSJP)',
    entryDate: 'Yesterday 15:43 WIB',
    predictedProbability: 58,
    expectedNetReturnPct: 0.35,
    expectedGapPct: 0.75,
    actualGapPct: -1.74,
    actualNetReturnPct: -2.14,
    slippagePct: 0.12,
    marketRegime: 'BULLISH ACCUMULATION',
    modelVersion: '3.2.1',
    outcome: 'LOSS',
    residualError: -2.49,
    researchNotes: 'NEGATIVE GAP OUTLIER: Nickel commodity price dropped -2.4% overnight. Gap-Down stop triggered at 09:00:30 WIB.'
  },
  {
    id: 'res-5',
    ticker: 'ADRO',
    strategy: 'Overnight Edge (BSJP)',
    entryDate: 'Yesterday 15:45 WIB',
    predictedProbability: 70,
    expectedNetReturnPct: 0.95,
    expectedGapPct: 1.35,
    actualGapPct: 2.14,
    actualNetReturnPct: 1.73,
    slippagePct: 0.06,
    marketRegime: 'BULLISH ACCUMULATION',
    modelVersion: '3.2.1',
    outcome: 'WIN',
    residualError: +0.78,
    researchNotes: 'Coal sector momentum supported opening auction liquidity.'
  }
];
