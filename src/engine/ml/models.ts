// ============================================================================
// SPECIALIZED MACHINE LEARNING MODELS (SIMULATED PROBABILISTIC INFERENCE)
// ============================================================================
import { StockData } from '../../types';
import { FeatureContext } from '../featureContext';
import { FeatureStore } from './featureStore';
import {
  OvernightMLPrediction,
  GapRiskMLPrediction,
  IntradayMLPrediction,
  SwingMLPrediction,
  TrendPersistenceMLPrediction,
  BreakoutFailureMLPrediction,
  EmergingLeaderMLPrediction,
  ConfidenceLevel,
  SHAPContribution,
  MLPredictionExplanation
} from './types';

export class OvernightMLModel {
  public static readonly modelId = 'overnight-xgb-v3';
  public static readonly modelVersion = '3.2.1';
  public static readonly modelType = 'XGBoost';

  /**
   * Evaluates P(Next Open > Entry + Costs + Slippage) and tail probabilities
   * Default IDX round-trip cost + slippage = 0.40%
   */
  public static predict(stock: StockData, context?: FeatureContext): OvernightMLPrediction {
    const feat = FeatureStore.get(stock, context);
    const roundTripCostPct = 0.40;

    let logit = 0.15;
    const shapPositive: SHAPContribution[] = [];
    const shapNegative: SHAPContribution[] = [];

    if (feat.relativeVolume >= 1.5) {
      logit += 0.42;
      shapPositive.push({ featureName: 'Relative Volume Surge', featureCategory: 'VOLUME', value: `${feat.relativeVolume.toFixed(2)}x`, contributionPct: 8.4, description: 'Strong late-session buyer interest confirms pre-close accumulation' });
    } else if (feat.relativeVolume < 0.8) {
      logit -= 0.28;
      shapNegative.push({ featureName: 'Sub-Par Relative Volume', featureCategory: 'VOLUME', value: `${feat.relativeVolume.toFixed(2)}x`, contributionPct: -5.6, description: 'Lack of liquidity turnover lowers probability of opening continuation' });
    }

    if (feat.ihsgRegime.includes('BULL') || feat.marketBreadthPctAboveMa20 > 60) {
      logit += 0.31;
      shapPositive.push({ featureName: 'Bull Market Regime & Breadth', featureCategory: 'MARKET', value: `${feat.ihsgRegime} (${feat.marketBreadthPctAboveMa20}% > MA20)`, contributionPct: 6.1, description: 'Macro tailwinds significantly elevate positive overnight gap follow-through' });
    } else if (feat.ihsgRegime.includes('BEAR')) {
      logit -= 0.45;
      shapNegative.push({ featureName: 'Bearish Market Regime', featureCategory: 'MARKET', value: feat.ihsgRegime, contributionPct: -8.9, description: 'Macro selling pressure drags down next-morning opening auctions' });
    }

    if (feat.isMaAligned) {
      logit += 0.29;
      shapPositive.push({ featureName: 'Bullish MA Stack Alignment', featureCategory: 'TREND', value: 'MA5 > MA10 > MA20 > MA50', contributionPct: 5.7, description: 'Consistent trend momentum creates persistent overnight bidding' });
    }

    if (feat.brokerAccumulationScore >= 75) {
      logit += 0.25;
      shapPositive.push({ featureName: 'Heavy Institutional Accumulation', featureCategory: 'BROKER', value: `Score: ${feat.brokerAccumulationScore}/100`, contributionPct: 4.8, description: 'Top brokers absorb late ask volume to position into tomorrow open' });
    } else if (feat.brokerAccumulationScore < 45) {
      logit -= 0.20;
      shapNegative.push({ featureName: 'Broker Net Distribution', featureCategory: 'BROKER', value: `Score: ${feat.brokerAccumulationScore}/100`, contributionPct: -3.9, description: 'Net selling from institutional brokers increases gap-down risk' });
    }

    if (feat.historicalGreenOpenRate >= 65) {
      logit += 0.24;
      shapPositive.push({ featureName: 'Historical Overnight Persistence', featureCategory: 'OVERNIGHT', value: `${feat.historicalGreenOpenRate}% Green Rate`, contributionPct: 4.6, description: 'Stock possesses a proven empirical edge of opening green' });
    }

    if (feat.atrPct > 4.5) {
      logit -= 0.22;
      shapNegative.push({ featureName: 'High Volatility / Wide ATR', featureCategory: 'VOLATILITY', value: `ATR ${feat.atrPct.toFixed(1)}%`, contributionPct: -4.1, description: 'Excessive volatility widens downside tail risk at the open' });
    }

    if (feat.rsi14 > 76) {
      logit -= 0.15;
      shapNegative.push({ featureName: 'RSI Short-Term Overextension', featureCategory: 'MOMENTUM', value: `RSI ${feat.rsi14.toFixed(1)}`, contributionPct: -2.6, description: 'Extended intraday price may induce opening profit taking' });
    }

    const rawProb = 1 / (1 + Math.exp(-logit));
    const probGreenOpen = Math.min(94, Math.max(18, Math.round(rawProb * 100)));
    const netProbDamping = Math.min(12, Math.max(4, Math.round(roundTripCostPct * 12)));
    const probNetPositiveOpen = Math.max(12, probGreenOpen - netProbDamping);
    const probFlatOpen = Math.round((100 - probGreenOpen) * 0.35);
    const probNegativeOpen = Math.max(5, 100 - probGreenOpen - probFlatOpen);
    const probGapBelowHalfPct = Math.round(probNegativeOpen * 0.70);
    const probGapBelowOnePct = Math.round(probNegativeOpen * 0.45);
    const probGapBelowTwoPct = Math.round(probNegativeOpen * 0.20);

    const grossReturnEst = (probGreenOpen / 100) * (feat.avgOvernightGapPct > 0 ? feat.avgOvernightGapPct : 1.4) - (probNegativeOpen / 100) * 1.8;
    const expectedOvernightReturnNet = Math.round((grossReturnEst - roundTripCostPct) * 100) / 100;
    const medianExpectedOutcome = Math.round((expectedOvernightReturnNet * 0.85) * 100) / 100;
    const tailRiskEstimateCVaR = Math.round((-1.2 - (probGapBelowTwoPct / 10)) * 100) / 100;

    let confidenceScore = 65;
    if (feat.relativeVolume > 1.2) confidenceScore += 10;
    if (stock.historicalBars.length > 50) confidenceScore += 10;
    if (feat.spreadProxyPct < 0.25) confidenceScore += 10;
    if (feat.atrPct > 5.0) confidenceScore -= 15;

    let confidence: ConfidenceLevel = 'MODERATE';
    if (confidenceScore >= 85) confidence = 'VERY HIGH';
    else if (confidenceScore >= 75) confidence = 'HIGH';
    else if (confidenceScore >= 55) confidence = 'MODERATE';
    else if (confidenceScore >= 40) confidence = 'LOW';
    else confidence = 'VERY LOW';

    const explanation: MLPredictionExplanation = {
      baseProbability: 52.0,
      finalProbability: probNetPositiveOpen,
      topPositiveFeatures: shapPositive.sort((a, b) => b.contributionPct - a.contributionPct).slice(0, 4),
      topNegativeFeatures: shapNegative.sort((a, b) => a.contributionPct - b.contributionPct).slice(0, 3),
      allFeatures: [...shapPositive, ...shapNegative],
      modelType: this.modelType as any,
      modelVersion: this.modelVersion,
      isSimulated: true
    };

    return { ticker: stock.ticker, modelId: this.modelId, modelVersion: this.modelVersion, probNetPositiveOpen, probGreenOpen, probFlatOpen, probNegativeOpen, probGapBelowHalfPct, probGapBelowOnePct, probGapBelowTwoPct, expectedOvernightReturnNet, medianExpectedOutcome, tailRiskEstimateCVaR, confidence, confidenceScore: Math.min(100, Math.max(10, confidenceScore)), explanation };
  }
}

export class GapRiskMLModel {
  public static readonly modelId = 'gap-risk-lightgbm-v2';
  public static readonly modelVersion = '2.4.0';

  public static predict(stock: StockData, context?: FeatureContext): GapRiskMLPrediction {
    const feat = FeatureStore.get(stock, context);
    const histStats = stock.historicalStats;
    const probGapNegative = Math.min(85, Math.max(8, 100 - histStats.greenOpenRate));
    const probGapBelowHalfPct = Math.round(probGapNegative * 0.72);
    const probGapBelowOnePct = Math.round(probGapNegative * 0.44);
    const probGapBelowTwoPct = Math.round(probGapNegative * 0.22);
    const probGapBelowThreePct = Math.round(probGapNegative * 0.10);
    let score = Math.round((probGapNegative * 0.35) + (probGapBelowOnePct * 0.35) + (probGapBelowTwoPct * 0.30));
    if (feat.atrPct > 4.0) score += 8;
    if (stock.bandarmology.score < 45) score += 10;
    if (stock.price < 500) score += 6;
    if (feat.ihsgRegime.includes('BEAR')) score += 12;
    const gapRiskScore = Math.min(99, Math.max(5, score));
    let riskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (gapRiskScore <= 25) riskLevel = 'LOW'; else if (gapRiskScore <= 45) riskLevel = 'MODERATE'; else if (gapRiskScore <= 65) riskLevel = 'ELEVATED'; else if (gapRiskScore <= 80) riskLevel = 'HIGH'; else riskLevel = 'CRITICAL';
    const expectedShortfallCVaR = Math.round((-1.0 - (gapRiskScore / 25)) * 10) / 10;
    const tailProbability = Math.round(probGapBelowTwoPct * 0.6);
    const confidence: ConfidenceLevel = stock.historicalBars.length > 50 ? 'HIGH' : 'MODERATE';
    return { ticker: stock.ticker, gapRiskScore, riskLevel, probGapNegative, probGapBelowHalfPct, probGapBelowOnePct, probGapBelowTwoPct, probGapBelowThreePct, expectedShortfallCVaR, tailProbability, historicalWorstAnalog: { date: '2024-08-05 (Global Tech Sell-Off)', gapPct: -3.85, subsequentLowPct: -5.20, catalyst: 'Nikkei flash unwind & regional broad market gap-down' }, confidence };
  }
}

export class IntradayMLModel {
  public static readonly modelId = 'intraday-rf-v2';
  public static readonly modelVersion = '2.1.0';

  public static predict(stock: StockData, context?: FeatureContext): IntradayMLPrediction {
    const feat = FeatureStore.get(stock, context);
    let prob = 50;
    let classification: IntradayPredictionClassification = 'NO QUALIFIED SETUP';
    let recommendedSetup = 'Wait for liquidity and price discovery';
    if (feat.relativeVolume >= 1.8 && feat.return1d > 1.5) { prob = 74; classification = 'GAP AND GO'; recommendedSetup = '09:05 WIB volume surge breakout above opening 5-min high'; }
    else if (feat.relativeVolume >= 1.3 && feat.vwapRelation === 'ABOVE_VWAP') { prob = 68; classification = 'OPENING RANGE BREAKOUT'; recommendedSetup = 'Break of 15-min opening range high with expanding volume'; }
    else if (feat.isMaAligned && feat.rsi14 >= 55 && feat.rsi14 <= 68) { prob = 65; classification = 'TREND CONTINUATION'; recommendedSetup = 'Pullback towards VWAP / MA5 support bounce in session 1'; }
    else if (stock.changePct < -2.0 && stock.bandarmology.netForeignFlow > 0) { prob = 58; classification = 'MORNING RECOVERY'; recommendedSetup = 'Mean reversion scalp from session low with tight 1.2% stop'; }
    else { prob = 44; classification = 'NO QUALIFIED SETUP'; recommendedSetup = 'No clear intraday edge; skip day-trade session'; }
    const expectedIntradayReturn = Math.round(((prob / 100) * 2.8 - ((100 - prob) / 100) * 1.5 - 0.40) * 100) / 100;
    const downsideProbability = 100 - prob;
    const explanation: MLPredictionExplanation = {
      baseProbability: 50.0, finalProbability: prob,
      topPositiveFeatures: [
        { featureName: 'Volume Velocity at Open', featureCategory: 'VOLUME', value: `${feat.relativeVolume.toFixed(2)}x`, contributionPct: 11.2, description: 'High opening participation provides exit liquidity' },
        { featureName: 'VWAP Posture', featureCategory: 'INTRADAY', value: feat.vwapRelation, contributionPct: 7.5, description: 'Trading above VWAP confirms institutional buyer control' }
      ],
      topNegativeFeatures: [{ featureName: 'Round-Trip Day Trading Friction', featureCategory: 'LIQUIDITY', value: '0.40% fee + slippage', contributionPct: -4.0, description: 'Tight friction hurdle requires strong intraday expansion' }],
      allFeatures: [], modelType: 'Random Forest', modelVersion: this.modelVersion, isSimulated: true
    };
    return { ticker: stock.ticker, probPositiveIntraday: prob, expectedIntradayReturn, downsideProbability, classification: classification as any, recommendedSetup, confidence: prob >= 65 ? 'HIGH' : 'MODERATE', explanation };
  }
}

export class SwingMLModel {
  public static readonly modelId = 'swing-gbm-v4';
  public static readonly modelVersion = '4.0.2';

  public static predict(stock: StockData, context?: FeatureContext): SwingMLPrediction {
    const feat = FeatureStore.get(stock, context);
    const base3d = feat.isMaAligned ? 68 : 52;
    const base5d = feat.isMaAligned ? 72 : 55;
    const base10d = feat.isMaAligned ? 75 : 56;
    const base20d = feat.isMaAligned ? 78 : 58;
    const horizons = {
      '3D': { horizonDays: 3 as const, probPositiveReturn: base3d, probTargetReturn: Math.round(base3d * 0.72), expectedReturn: Math.round((base3d * 0.05 - 1.2) * 10) / 10, expectedDrawdown: -2.1, trendPersistenceProb: 74, breakoutFailureProb: 24 },
      '5D': { horizonDays: 5 as const, probPositiveReturn: base5d, probTargetReturn: Math.round(base5d * 0.75), expectedReturn: Math.round((base5d * 0.07 - 1.5) * 10) / 10, expectedDrawdown: -2.8, trendPersistenceProb: 76, breakoutFailureProb: 22 },
      '10D': { horizonDays: 10 as const, probPositiveReturn: base10d, probTargetReturn: Math.round(base10d * 0.78), expectedReturn: Math.round((base10d * 0.10 - 2.0) * 10) / 10, expectedDrawdown: -3.8, trendPersistenceProb: 78, breakoutFailureProb: 20 },
      '20D': { horizonDays: 20 as const, probPositiveReturn: base20d, probTargetReturn: Math.round(base20d * 0.80), expectedReturn: Math.round((base20d * 0.14 - 2.5) * 10) / 10, expectedDrawdown: -5.2, trendPersistenceProb: 80, breakoutFailureProb: 18 }
    };
    let recommendation: 'ACCUMULATE' | 'MOMENTUM_ENTRY' | 'WAIT_FOR_PULLBACK' | 'NEUTRAL' | 'AVOID' = 'NEUTRAL';
    if (feat.rsi14 > 72) recommendation = 'WAIT_FOR_PULLBACK'; else if (feat.isMaAligned && feat.relativeVolume > 1.2) recommendation = 'MOMENTUM_ENTRY'; else if (feat.brokerAccumulationScore >= 75) recommendation = 'ACCUMULATE'; else if (feat.return1d < -3) recommendation = 'AVOID';
    return { ticker: stock.ticker, horizons, primaryHorizon: 5, confidence: feat.isMaAligned ? 'HIGH' : 'MODERATE', recommendation };
  }
}

export class TrendPersistenceMLModel {
  public static readonly modelId = 'trend-persistence-xgb-v1';
  public static readonly modelVersion = '1.3.0';

  public static predict(stock: StockData, context?: FeatureContext): TrendPersistenceMLPrediction {
    const feat = FeatureStore.get(stock, context);
    let persistence = 50;
    if (feat.isMaAligned) persistence += 22;
    if (feat.adx14 > 25) persistence += 12;
    if (feat.isAboveCloud) persistence += 8;
    if (feat.rsi14 > 75) persistence -= 14;
    const trendPersistenceProb = Math.min(92, Math.max(15, persistence));
    const trendFailureProb = 100 - trendPersistenceProb;
    const expectedTrendDurationDays = Math.round(12 * (trendPersistenceProb / 60));
    let overextensionScore = Math.round((feat.rsi14 - 30) * 1.5);
    overextensionScore = Math.min(95, Math.max(5, overextensionScore));
    let overextensionRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' = 'LOW';
    if (overextensionScore > 75) overextensionRisk = 'EXTREME'; else if (overextensionScore > 60) overextensionRisk = 'HIGH'; else if (overextensionScore > 40) overextensionRisk = 'MODERATE';
    return { ticker: stock.ticker, trendPersistenceProb, trendFailureProb, expectedTrendDurationDays, overextensionRisk, overextensionScore, trendQuality: Math.round((feat.adx14 * 1.5 + (feat.isMaAligned ? 40 : 15))), supportDefenseProbability: Math.min(90, Math.max(30, trendPersistenceProb + 5)) };
  }
}

export class BreakoutFailureMLModel {
  public static readonly modelId = 'breakout-failure-catboost-v2';
  public static readonly modelVersion = '2.0.1';

  public static predict(stock: StockData, context?: FeatureContext): BreakoutFailureMLPrediction {
    const feat = FeatureStore.get(stock, context);
    let falseBreakoutProb = 35;
    if (feat.relativeVolume < 1.2) falseBreakoutProb += 24;
    if (feat.closePositionWithinRange < 0.6) falseBreakoutProb += 18;
    if (feat.atrPct > 4.5) falseBreakoutProb += 8;
    if (feat.isMaAligned) falseBreakoutProb -= 15;
    if (feat.brokerAccumulationScore >= 75) falseBreakoutProb -= 12;
    falseBreakoutProb = Math.min(88, Math.max(12, falseBreakoutProb));
    const breakoutSuccessProb = 100 - falseBreakoutProb;
    return { ticker: stock.ticker, breakoutSuccessProb, falseBreakoutProb, expectedFollowThroughPct: Math.round((breakoutSuccessProb * 0.08) * 10) / 10, expectedDrawdownPct: Math.round((-1.5 - (falseBreakoutProb / 20)) * 10) / 10, isVolumeConfirmed: feat.relativeVolume >= 1.5, volatilityCompressionPreBreakout: feat.volatilityCompressionRatio < 1.2, confidence: feat.relativeVolume >= 1.2 ? 'HIGH' : 'LOW' };
  }
}

export class EmergingLeaderMLModel {
  public static readonly modelId = 'emerging-leader-lgbm-v1';
  public static readonly modelVersion = '1.1.0';

  public static predict(stock: StockData, context?: FeatureContext): EmergingLeaderMLPrediction {
    const feat = FeatureStore.get(stock, context);
    const fundamentalInflectionScore = feat.fundamentalInflectionScore;
    const qualityScore = Math.min(100, Math.round(feat.roePct * 2.5 + feat.netMarginPct * 1.2));
    const growthScore = Math.min(100, Math.round(feat.revenueGrowthYoy * 3.5 + 20));
    const valuationScore = Math.min(100, Math.round(100 - (feat.pbvRatio * 12)));
    const marketConfirmationScore = Math.round(feat.relativeVolume * 30 + (feat.isMaAligned ? 40 : 15));
    const riskScore = Math.round(feat.atrPct * 10 + (feat.brokerAccumulationScore < 50 ? 25 : 5));
    let emergingLeaderProb = Math.round((fundamentalInflectionScore * 0.3) + (qualityScore * 0.25) + (marketConfirmationScore * 0.3) + ((100 - riskScore) * 0.15));
    emergingLeaderProb = Math.min(95, Math.max(10, emergingLeaderProb));
    let classification: any = 'QUALITY COMPOUNDER';
    const drivers: string[] = [];
    if (stock.ticker === 'BBCA') { classification = 'QUALITY COMPOUNDER'; drivers.push('Sustained >20% ROE and pristine asset quality'); drivers.push('Dominant retail CASA deposit franchise on IDX'); }
    else if (stock.ticker === 'BRIS') { classification = 'EMERGING LEADER'; drivers.push('Syariah banking market consolidation and >20% loan expansion'); drivers.push('Accelerating digital user adoption with margin expansion'); }
    else if (stock.ticker === 'ADRO' || stock.ticker === 'BUMI') { classification = 'TURNAROUND'; drivers.push('Cyclical commodity cash flow inflection and green transformation spin-offs'); }
    else if (riskScore > 65) { classification = 'SPECULATIVE'; drivers.push('High volatility beta with volatile quarterly cash flows'); }
    else { classification = 'EARLY INFLECTION'; drivers.push('Positive multi-quarter revenue acceleration with broker positioning'); }
    return { ticker: stock.ticker, emergingLeaderProb, fundamentalInflectionScore, qualityScore, growthScore, valuationScore: Math.max(15, valuationScore), marketConfirmationScore: Math.min(100, marketConfirmationScore), riskScore: Math.min(100, riskScore), classification, researchConfidence: stock.ticker === 'BBCA' || stock.ticker === 'BRIS' ? 'HIGH' : 'MODERATE', inflectionDrivers: drivers };
  }
}

export class NoTradeModel {
  public static evaluate(stock: StockData, context?: FeatureContext): {
    shouldTrade: boolean;
    decision: 'TRADE_QUALIFIED' | 'NO_TRADE_RECOMMENDED';
    primaryReason: string;
    riskFactors: string[];
  } {
    const feat = FeatureStore.get(stock, context);
    const gapRisk = GapRiskMLModel.predict(stock, context);
    const overnightML = OvernightMLModel.predict(stock, context);
    const riskFactors: string[] = [];
    if (gapRisk.gapRiskScore > 75) riskFactors.push(`Severe Gap-Down Risk Score: ${gapRisk.gapRiskScore}/100 exceeds risk tolerance`);
    if (overnightML.probNetPositiveOpen < 50) riskFactors.push(`Net Green Open Probability (${overnightML.probNetPositiveOpen}%) below break-even threshold`);
    if (feat.relativeVolume < 0.8) riskFactors.push(`Anemic Relative Volume (${feat.relativeVolume.toFixed(2)}x) indicates illiquid closing liquidity`);
    if (feat.spreadProxyPct > 0.40) riskFactors.push(`Wide bid-ask spread (${feat.spreadProxyPct}%) creates excessive execution friction`);
    if (feat.ihsgRegime.includes('BEAR') && !stock.prefilterPassed) riskFactors.push('Adverse macro bear regime with failure of pre-filter quality screen');
    if (riskFactors.length >= 2 || gapRisk.gapRiskScore >= 80) return { shouldTrade: false, decision: 'NO_TRADE_RECOMMENDED', primaryReason: riskFactors[0] || 'Elevated risk-to-reward asymmetry; capital preservation mandated.', riskFactors };
    return { shouldTrade: true, decision: 'TRADE_QUALIFIED', primaryReason: 'Probabilistic quantitative edge exceeds cost hurdle with acceptable downside tail risk.', riskFactors };
  }
}

type IntradayPredictionClassification =
  | 'GAP AND GO'
  | 'OPENING RANGE BREAKOUT'
  | 'TREND CONTINUATION'
  | 'GAP REVERSAL'
  | 'MORNING RECOVERY'
  | 'NO QUALIFIED SETUP';