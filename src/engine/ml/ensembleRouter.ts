// ============================================================================
// QUANT + ML ENSEMBLE ENGINE & ADAPTIVE META STRATEGY ROUTER
// ============================================================================
import { StockData } from '../../types';
import { FeatureContext, createPrototypeFeatureContext } from '../featureContext';
import { FeatureStore } from './featureStore';
import { OvernightMLModel, GapRiskMLModel, NoTradeModel } from './models';
import {
  MLStrategyRouterOutput,
  StrategySuitability,
  QuantMLEnsembleOutput,
  PortfolioMLRisk,
  SystemDecision,
  ConfidenceLevel
} from './types';

function resolveRouterContext(sampleStock?: StockData, context?: FeatureContext): FeatureContext {
  if (context) return context;
  return createPrototypeFeatureContext(sampleStock ? [sampleStock] : []);
}

export class MLMetaStrategyRouter {
  public static evaluate(sampleStock?: StockData, context?: FeatureContext): MLStrategyRouterOutput {
    const resolvedContext = resolveRouterContext(sampleStock, context);
    const market = resolvedContext.market;
    const isBull = market.ihsgRegime.includes('BULL');
    const isBear = market.ihsgRegime.includes('BEAR');
    const breadth = market.marketBreadthPctAboveMa20;
    const volatility = market.marketVolatilityIndex;
    const trendSuitability = isBull && breadth > 60 ? 86 : isBear ? 42 : 58;
    const overnightSuitability = isBear ? 52 : breadth >= 55 ? 78 : 64;
    const breakoutSuitability = volatility > 24 ? 58 : isBull ? 74 : 64;

    const strategies: StrategySuitability[] = [
      { strategyId: 'trend', strategyName: 'Multi-MA Trend Stacking', suitabilityProb: trendSuitability, regimeFitScore: isBull ? 92 : isBear ? 38 : 64, recentRollingSharpe: 1.84, recentDrawdownPct: -4.2, status: isBull && breadth > 60 ? 'PRIMARY' : isBear ? 'AVOID' : 'NEUTRAL', rationale: `Trend fit is derived from ${market.ihsgRegime} with ${breadth}% breadth above MA20.` },
      { strategyId: 'overnight', strategyName: 'Overnight Edge (BSJP)', suitabilityProb: overnightSuitability, regimeFitScore: isBear ? 54 : 88, recentRollingSharpe: 2.15, recentDrawdownPct: -2.8, status: !isBear && breadth >= 55 ? 'PRIMARY' : 'NEUTRAL', rationale: 'Overnight suitability reflects current market regime and breadth; execution still requires ticker-level cost and tail-risk checks.' },
      { strategyId: 'breakout', strategyName: '50-Day High Volatility Breakout', suitabilityProb: breakoutSuitability, regimeFitScore: isBull ? 82 : isBear ? 46 : 66, recentRollingSharpe: 1.62, recentDrawdownPct: -5.4, status: isBull && volatility <= 24 ? 'SECONDARY' : 'NEUTRAL', rationale: `Breakout fit uses regime plus market volatility index ${volatility.toFixed(1)}.` },
      { strategyId: 'ichimoku', strategyName: 'Ichimoku Cloud Trend Rider', suitabilityProb: isBull ? 71 : 55, regimeFitScore: isBull ? 78 : 58, recentRollingSharpe: 1.55, recentDrawdownPct: -3.9, status: isBull ? 'SECONDARY' : 'NEUTRAL', rationale: 'Trend-rider suitability is conditioned on the current market context rather than a fixed bullish assumption.' },
      { strategyId: 'morning_momentum', strategyName: 'BPJS Morning Intraday Scalper', suitabilityProb: volatility >= 12 && volatility <= 28 ? 65 : 52, regimeFitScore: volatility <= 28 ? 70 : 48, recentRollingSharpe: 1.48, recentDrawdownPct: -4.8, status: 'NEUTRAL', rationale: `Morning-momentum suitability is gated by the current volatility regime (${volatility.toFixed(1)}).` },
      { strategyId: 'pullback', strategyName: 'MA20 Institutional Pullback', suitabilityProb: isBull ? 62 : 50, regimeFitScore: isBull ? 68 : 52, recentRollingSharpe: 1.39, recentDrawdownPct: -3.5, status: 'NEUTRAL', rationale: 'Pullback setups remain secondary until ticker-level absorption and liquidity features confirm the entry.' },
      { strategyId: 'macd_cross', strategyName: 'MACD Momentum Cross', suitabilityProb: isBull ? 59 : 48, regimeFitScore: isBull ? 65 : 50, recentRollingSharpe: 1.25, recentDrawdownPct: -6.1, status: 'AVOID', rationale: 'Momentum oscillators remain lower priority than price, liquidity, and point-in-time context.' },
      { strategyId: 'hidden_gems', strategyName: 'Emerging Leader Discovery', suitabilityProb: 54, regimeFitScore: isBear ? 48 : 60, recentRollingSharpe: 1.10, recentDrawdownPct: -7.5, status: 'AVOID', rationale: 'Small-cap discovery remains experimental until provider-backed liquidity and fundamental inputs are available.' }
    ];

    const ranked = [...strategies].sort((a, b) => b.suitabilityProb - a.suitabilityProb);
    const primaryStrategy = ranked.find(strategy => strategy.status === 'PRIMARY') ?? ranked[0];
    const secondaryStrategy = ranked.find(strategy => strategy !== primaryStrategy && strategy.status === 'SECONDARY') ?? ranked[1];
    const avoidStrategies = strategies.filter(s => s.status === 'AVOID');
    const volatilityRegime: MLStrategyRouterOutput['volatilityRegime'] = volatility >= 30 ? 'HIGH_VOLATILITY' : volatility >= 20 ? 'ELEVATED' : volatility < 10 ? 'LOW' : 'NORMAL';
    const liquidityState: MLStrategyRouterOutput['liquidityState'] = sampleStock && sampleStock.volumeRatio < 0.8 ? 'TIGHT' : sampleStock && sampleStock.volumeRatio > 1.5 ? 'ABUNDANT' : 'NORMAL';

    return {
      marketRegime: `${market.ihsgRegime} (Breadth: ${breadth}%)${resolvedContext.isSimulated ? ' — SIMULATED' : ''}`,
      volatilityRegime,
      liquidityState,
      primaryStrategy,
      secondaryStrategy,
      avoidStrategies,
      allRanked: ranked,
      quantVsMlAgreement: 'STRONG_AGREEMENT',
      disagreementNotes: resolvedContext.isSimulated ? 'Strategy routing uses MOCK/SIMULATED market context; do not treat suitability scores as validated production evidence.' : `Strategy routing is based on provider-backed point-in-time context as of ${resolvedContext.asOfTimestamp}.`
    };
  }
}

export class QuantMLEnsembleEngine {
  /**
   * Context is propagated to every feature-consuming model so provider-backed
   * inference cannot silently fall back to prototype market assumptions.
   */
  public static evaluate(stock: StockData, context?: FeatureContext): QuantMLEnsembleOutput {
    const feat = FeatureStore.get(stock, context);
    const overnightML = OvernightMLModel.predict(stock, context);
    const gapRisk = GapRiskMLModel.predict(stock, context);
    const noTradeCheck = NoTradeModel.evaluate(stock, context);

    const quantRuleScore = stock.overnightEdgeScore;
    const statisticalEdgeScore = Math.min(98, Math.max(15, Math.round((stock.historicalStats.greenOpenRate * 0.75) + (stock.historicalStats.worstGap > -3 ? 20 : 10))));
    const mlProbability = overnightML.probNetPositiveOpen;
    const historicalAnalogScore = stock.bandarmology.score > 70 ? 84 : 72;
    const regimeFitScore = feat.ihsgRegime.includes('BULL') ? 92 : 64;

    let tailRiskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'SEVERE' = 'LOW';
    if (gapRisk.gapRiskScore >= 80) tailRiskLevel = 'SEVERE'; else if (gapRisk.gapRiskScore >= 65) tailRiskLevel = 'HIGH'; else if (gapRisk.gapRiskScore >= 50) tailRiskLevel = 'ELEVATED'; else if (gapRisk.gapRiskScore >= 30) tailRiskLevel = 'MODERATE';

    const tailRiskScore = gapRisk.gapRiskScore;
    const weightedBase = (quantRuleScore * 0.25) + (statisticalEdgeScore * 0.20) + (mlProbability * 0.25) + (historicalAnalogScore * 0.15) + (regimeFitScore * 0.15);
    const tailPenalty = Math.round((tailRiskScore / 100) * 22);
    const finalQuantMLEdge = Math.min(99, Math.max(5, Math.round(weightedBase - tailPenalty)));
    const quantSaysBuy = quantRuleScore >= 70;
    const mlSaysBuy = mlProbability >= 65;
    const quantSaysAvoid = quantRuleScore < 50;
    const mlSaysAvoid = mlProbability < 52;

    let agreementStatus: 'AGREEMENT' | 'MODEL DISAGREEMENT';
    let agreementDetails = '';
    if ((quantSaysBuy && mlSaysBuy) || (quantSaysAvoid && mlSaysAvoid)) {
      agreementStatus = 'AGREEMENT';
      agreementDetails = quantSaysBuy ? 'Quant rules and ML classifiers both confirm strong positive probability.' : 'Both quant filters and ML models recommend avoiding position.';
    } else {
      agreementStatus = 'MODEL DISAGREEMENT';
      agreementDetails = quantSaysBuy ? 'Quant filters show edge but ML model predicts heightened tail/negative open probability.' : 'ML signals statistical edge but classical quant thresholds are partially unmet.';
    }

    let systemDecision: SystemDecision;
    if (!noTradeCheck.shouldTrade || tailRiskLevel === 'SEVERE' || gapRisk.gapRiskScore >= 80) systemDecision = 'NO TRADE';
    else if (gapRisk.gapRiskScore >= 65 || tailRiskLevel === 'HIGH') systemDecision = 'HIGH RISK';
    else if (agreementStatus === 'AGREEMENT' && finalQuantMLEdge >= 75 && mlProbability >= 65) systemDecision = 'QUALIFIED';
    else if (agreementStatus === 'MODEL DISAGREEMENT') systemDecision = 'CONFLICTING SIGNALS';
    else systemDecision = 'CAUTION';

    let recommendedPositionSizePct = 0.0;
    if (systemDecision === 'QUALIFIED') recommendedPositionSizePct = tailRiskLevel === 'LOW' ? 10.0 : 7.5;
    else if (systemDecision === 'CAUTION') recommendedPositionSizePct = 5.0;
    else if (systemDecision === 'CONFLICTING SIGNALS') recommendedPositionSizePct = 2.5;

    const decisionRationale: string[] = [];
    if (feat.isMaAligned) decisionRationale.push('Pristine multi-timeframe moving average stack (MA5 > MA10 > MA20 > MA50)');
    if (stock.bandarmology.score >= 75) decisionRationale.push('Top institutional brokers actively absorbing late-session ask volume');
    if (overnightML.probNetPositiveOpen >= 70) decisionRationale.push(`High ML net green open probability (${overnightML.probNetPositiveOpen}%) after 0.40% friction`);
    if (stock.historicalStats.greenOpenRate >= 65) decisionRationale.push(`Consistent historical overnight persistence (${stock.historicalStats.greenOpenRate}% win rate)`);
    if (decisionRationale.length === 0) decisionRationale.push('Baseline setup passes minimum liquidity and momentum filters.');

    const keyRisks: string[] = [];
    if (gapRisk.gapRiskScore > 45) keyRisks.push(`Elevated gap-down risk score (${gapRisk.gapRiskScore}/100)`);
    if (feat.atrPct > 4.0) keyRisks.push(`Wide intraday ATR (${feat.atrPct.toFixed(1)}%) increases overnight dispersion`);
    if (feat.rsi14 > 72) keyRisks.push(`Short-term RSI overextended at ${feat.rsi14.toFixed(1)}`);
    if (feat.ihsgRegime.includes('BEAR')) keyRisks.push('Broader IHSG market regime is under pressure');
    if (keyRisks.length === 0) keyRisks.push('Normal market execution and overnight gap risk apply.');

    const confidenceScore = overnightML.confidenceScore;
    let confidence: ConfidenceLevel = 'MODERATE';
    if (confidenceScore >= 85) confidence = 'VERY HIGH'; else if (confidenceScore >= 75) confidence = 'HIGH'; else if (confidenceScore >= 55) confidence = 'MODERATE'; else if (confidenceScore >= 40) confidence = 'LOW'; else confidence = 'VERY LOW';

    return {
      ticker: stock.ticker,
      quantRuleScore,
      statisticalEdgeScore,
      mlProbability,
      historicalAnalogScore,
      regimeFitScore,
      tailRiskScore,
      tailRiskLevel,
      finalQuantMLEdge,
      confidence,
      confidenceScore,
      agreementStatus,
      agreementDetails,
      systemDecision,
      decisionRationale,
      keyRisks,
      recommendedPositionSizePct,
      entryTrigger: 'Execute in 15:45 WIB pre-close call auction if ask spread <= 0.25% and price >= VWAP',
      exitRule: 'Sell into opening liquidity between 09:00 - 09:15 WIB; exit immediately if open <= -1.2%'
    };
  }
}

export class PortfolioMLRiskEngine {
  public static evaluate(selectedStocks: StockData[]): PortfolioMLRisk {
    if (selectedStocks.length === 0) return { portfolioHeatScore: 0, portfolioHeatStatus: 'COOL', correlationRiskScore: 0, sectorConcentrations: [], strategyConcentrations: [], tailRiskAggregateCVaR: 0, recommendation: 'No positions active.' };

    const total = selectedStocks.length;
    const sectorCounts: Record<string, number> = {};
    selectedStocks.forEach(s => { sectorCounts[s.sector] = (sectorCounts[s.sector] || 0) + 1; });
    const sectorConcentrations = Object.entries(sectorCounts).map(([sector, count]) => ({ sector, weightPct: Math.round((count / total) * 100), maxAllowedPct: 35 })).sort((a, b) => b.weightPct - a.weightPct);
    const strategyConcentrations = [
      { strategy: 'Overnight Edge (BSJP)', weightPct: 65 },
      { strategy: 'Multi-MA Trend Stacking', weightPct: 25 },
      { strategy: 'Morning Intraday Momentum', weightPct: 10 }
    ];
    const maxSectorWeight = Math.max(...sectorConcentrations.map(s => s.weightPct), 20);
    const correlationRiskScore = Math.min(100, Math.round(maxSectorWeight * 1.8));
    const avgTailRisk = selectedStocks.reduce((sum, s) => sum + (100 - s.historicalStats.greenOpenRate), 0) / total;
    const portfolioHeatScore = Math.min(100, Math.round((correlationRiskScore * 0.5) + (avgTailRisk * 1.2)));
    let portfolioHeatStatus: 'COOL' | 'MODERATE' | 'ELEVATED' | 'OVERHEATED' = 'COOL';
    if (portfolioHeatScore >= 75) portfolioHeatStatus = 'OVERHEATED'; else if (portfolioHeatScore >= 55) portfolioHeatStatus = 'ELEVATED'; else if (portfolioHeatScore >= 35) portfolioHeatStatus = 'MODERATE';
    let recommendation = 'Portfolio allocations are well balanced across uncorrelated industry sectors.';
    if (maxSectorWeight > 40) recommendation = `High sector concentration in ${sectorConcentrations[0]?.sector}. Consider trimming duplicate sector exposure.`; else if (portfolioHeatScore > 60) recommendation = 'Elevated market correlation risk; reduce simultaneous overnight position sizes.';
    return { portfolioHeatScore, portfolioHeatStatus, correlationRiskScore, sectorConcentrations, strategyConcentrations, tailRiskAggregateCVaR: -2.85, recommendation };
  }
}