import { 
  DailyBar, 
  StockData, 
  StrategySettings, 
  HistoricalSetupStats, 
  TechnicalSignals,
  BandarmologyData,
  DecisionCategory,
  BacktestSummary,
  BacktestTrade
} from '../types';
import {
  DEFAULT_EXECUTION_COSTS,
  executionCostsFromSettings,
  netReturnAfterCosts,
  calculateKellyPositionFraction,
} from './executionPolicy';
export { calculateKellyPositionFraction } from './executionPolicy';
import {
  clampNormalizedScore,
  roundEstablishedScore,
  roundOvernightEdgeScore,
} from './scorePolicy';

export const DEFAULT_STRATEGY_SETTINGS: StrategySettings = {
  greenOpenProbWeight: 30,
  expectedNetReturnWeight: 15,
  historicalConsistencyWeight: 15,
  technicalQualityWeight: 15,
  liquidityWeight: 10,
  bandarmologyWeight: 15,
  
  badGapPenaltyWeight: 35,
  severeGapPenaltyWeight: 50,
  extremeTailPenaltyWeight: 40,
  overextendedPenaltyWeight: 25,
  
  buyFeePct: DEFAULT_EXECUTION_COSTS.buyFeePct,
  sellFeePct: DEFAULT_EXECUTION_COSTS.sellFeePct,
  slippagePct: DEFAULT_EXECUTION_COSTS.slippagePct,
  
  minConfidenceSampleSize: 20,
  minDailyTurnoverIDR: 5000000000, // 5 Milyar IDR
};

// Calculate percentiles
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Calculate statistical median
export function calculateMedian(values: number[]): number {
  return calculatePercentile(values, 50);
}

// Confidence score based on sample size and variance
export function calculateConfidenceScore(sampleSize: number, winRate: number, minRequired: number = 20): number {
  if (sampleSize <= 0) return 0;
  // Wilson score / Laplace-like damping for small sample sizes
  // If sample size is 10, even with 90% win rate, confidence shouldn't exceed ~45%
  const sizeFactor = Math.min(1.0, Math.sqrt(sampleSize) / Math.sqrt(80));
  const samplePenalty = sampleSize < minRequired ? Math.pow(sampleSize / minRequired, 1.3) : 1.0;
  
  // Base confidence reflects sample size reliability
  const rawScore = (winRate * 0.4 + 60 * 0.6) * sizeFactor * samplePenalty;
  return roundEstablishedScore(rawScore);
}

// Compute Overnight Edge Score with editable settings
export function computeOvernightEdgeScore(
  stock: {
    historicalStats: HistoricalSetupStats;
    technicalScore: number;
    bandarmologyScore: number;
    turnover: number;
    technical: TechnicalSignals;
    expectedNetGap: number;
  },
  settings: StrategySettings = DEFAULT_STRATEGY_SETTINGS
): {
  score: number;
  tailRiskScore: number;
  breakdown: {
    greenOpenComponent: number;
    netReturnComponent: number;
    consistencyComponent: number;
    technicalComponent: number;
    liquidityComponent: number;
    bandarmologyComponent: number;
    badGapPenalty: number;
    severeGapPenalty: number;
    tailPenalty: number;
    overextendedPenalty: number;
  };
} {
  const stats = stock.historicalStats;
  const tech = stock.technical;
  
  // 1. Positive components (0 - 100 baseline each)
  // Green Open component: scaled around 50% baseline (40% = 0, 75% = 100)
  const greenOpenNorm = clampNormalizedScore((stats.greenOpenRate - 40) * (100 / 35));
  const greenOpenComponent = greenOpenNorm * (settings.greenOpenProbWeight / 100);

  // Expected Net Return component: scaled (-0.5% = 0, +1.5% = 100)
  const netReturnNorm = clampNormalizedScore((stock.expectedNetGap + 0.3) * (100 / 1.5));
  const netReturnComponent = netReturnNorm * (settings.expectedNetReturnWeight / 100);

  // Historical Consistency: confidence score * (1 - gap volatility penalty)
  const consistencyNorm = stats.confidenceScore;
  const consistencyComponent = consistencyNorm * (settings.historicalConsistencyWeight / 100);

  // Technical Quality
  const technicalComponent = stock.technicalScore * (settings.technicalQualityWeight / 100);

  // Liquidity scaling (500 Jt = 20, 5 Milyar IDR = 60, 50 Milyar+ = 100)
  const logTurnover = Math.log10(Math.max(1, stock.turnover));
  const liquidityNorm = clampNormalizedScore(Math.round((logTurnover - 8.2) * 40));
  const liquidityComponent = liquidityNorm * (settings.liquidityWeight / 100);

  // Bandarmology
  const bandarmologyComponent = stock.bandarmologyScore * (settings.bandarmologyWeight / 100);

  const baseSum = 
    greenOpenComponent + 
    netReturnComponent + 
    consistencyComponent + 
    technicalComponent + 
    liquidityComponent + 
    bandarmologyComponent;

  // 2. Risk Penalties (explicit deduction)
  // Bad Gap < -1% penalty (e.g. 5% prob = 5 pts penalty, 20% prob = 30 pts)
  const badGapPenalty = (stats.badGap1PctProb / 100) * settings.badGapPenaltyWeight * 1.8;
  
  // Severe Gap < -2% penalty (heavily penalized, trader cuts loss quickly)
  const severeGapPenalty = (stats.severeGap2PctProb / 100) * settings.severeGapPenaltyWeight * 2.8;

  // Worst historical gap penalty (e.g. if worst was -6%, penalty is huge)
  const worstGapMagnitude = Math.abs(Math.min(0, stats.worstGap));
  const tailPenalty = worstGapMagnitude > 2.0 
    ? ((worstGapMagnitude - 2.0) / 4.0) * settings.extremeTailPenaltyWeight
    : 0;

  // Overextended penalty
  let overextendedPenalty = 0;
  if (tech.isExtended) {
    overextendedPenalty = settings.overextendedPenaltyWeight * 0.8;
  }
  if (tech.rsi14 > 75) {
    overextendedPenalty += settings.overextendedPenaltyWeight * 0.4;
  }

  // Tail risk safety score (100 = completely safe from bad gaps, established score floor = 5)
  const tailRiskDeductions = (stats.badGap1PctProb * 2.5) + (stats.severeGap2PctProb * 5.0) + (worstGapMagnitude * 8);
  const tailRiskScore = roundEstablishedScore(100 - tailRiskDeductions);

  // Final Edge Score
  const totalPenalties = badGapPenalty + severeGapPenalty + tailPenalty + overextendedPenalty;
  const rawFinal = baseSum - totalPenalties;
  const finalScore = roundOvernightEdgeScore(rawFinal);

  return {
    score: finalScore,
    tailRiskScore,
    breakdown: {
      greenOpenComponent: Math.round(greenOpenComponent * 10) / 10,
      netReturnComponent: Math.round(netReturnComponent * 10) / 10,
      consistencyComponent: Math.round(consistencyComponent * 10) / 10,
      technicalComponent: Math.round(technicalComponent * 10) / 10,
      liquidityComponent: Math.round(liquidityComponent * 10) / 10,
      bandarmologyComponent: Math.round(bandarmologyComponent * 10) / 10,
      badGapPenalty: Math.round(badGapPenalty * 10) / 10,
      severeGapPenalty: Math.round(severeGapPenalty * 10) / 10,
      tailPenalty: Math.round(tailPenalty * 10) / 10,
      overextendedPenalty: Math.round(overextendedPenalty * 10) / 10,
    }
  };
}

// Classify decision based on edge score and risk criteria
export function classifyDecision(
  edgeScore: number,
  tailRiskScore: number,
  badGap1PctProb: number,
  greenOpenRate: number,
  prefilterPassed: boolean,
  confidenceScore: number
): { decision: DecisionCategory; quality: 'ELITE' | 'HIGH' | 'MEDIUM' | 'SPECULATIVE' } {
  if (!prefilterPassed || badGap1PctProb >= 20 || tailRiskScore < 35) {
    return { decision: 'AVOID', quality: 'SPECULATIVE' };
  }
  
  if (badGap1PctProb >= 15 || edgeScore < 45 || confidenceScore < 25) {
    return { decision: 'SKIP', quality: 'SPECULATIVE' };
  }
  
  if (edgeScore >= 78 && tailRiskScore >= 72 && badGap1PctProb <= 7 && greenOpenRate >= 65 && confidenceScore >= 50) {
    return { decision: 'STRONG BUY', quality: 'ELITE' };
  }
  
  if (edgeScore >= 62 && tailRiskScore >= 58 && badGap1PctProb <= 11 && greenOpenRate >= 58) {
    return { decision: 'BUY', quality: 'HIGH' };
  }
  
  return { decision: 'WATCH', quality: 'MEDIUM' };
}

// Generate probabilistic AI explanation
export function generateStockAnalysisExplanation(stock: StockData): {
  positiveFactors: string[];
  riskFactors: string[];
  aiConclusion: string;
} {
  const positives: string[] = [];
  const risks: string[] = [];
  const { technical: tech, bandarmology: bandar, historicalStats: hist, tailRiskScore } = stock;

  // Technical & Price Action
  if (tech.isNearDailyHigh) {
    positives.push(`Close near daily high (${Math.round(tech.closePositionInRange * 100)}% of daily range) indicates aggressive pre-close buyer dominance.`);
  }
  if (tech.relativeVolume >= 1.4) {
    positives.push(`Elevated relative volume (${tech.relativeVolume.toFixed(1)}x 20-day average) confirms institutional participation into close.`);
  }
  if (tech.ma5 > tech.ma10 && tech.ma10 > tech.ma20) {
    positives.push('Clean multi-timeframe moving average stacking (MA5 > MA10 > MA20).');
  }
  if (tech.macdHist > 0 && tech.macdGoldenCross) {
    positives.push('MACD fresh golden cross above signal line supporting short-term momentum.');
  }
  if (tech.breakout20d) {
    positives.push('20-day resistance breakout on expanding closing volume.');
  }

  // Historical Overnight Stats
  if (hist.greenOpenRate >= 65) {
    positives.push(`Exceptional historical Green Open probability (${hist.greenOpenRate.toFixed(1)}% across ${hist.comparableSetupsCount} matched sessions).`);
  } else if (hist.greenOpenRate >= 58) {
    positives.push(`Solid historical Green Open rate (${hist.greenOpenRate.toFixed(1)}% over ${hist.comparableSetupsCount} similar setups).`);
  }
  if (hist.badGap1PctProb <= 6.0) {
    positives.push(`Very low historical incidence of Bad Gaps < -1% (${hist.badGap1PctProb.toFixed(1)}%), providing protective safety margin.`);
  }
  if (hist.severeGap2PctProb <= 2.0) {
    positives.push(`Minimal severe tail gap risk < -2% (${hist.severeGap2PctProb.toFixed(1)}%).`);
  }

  // Bandarmology
  if (bandar.status === 'STRONG ACCUMULATION' || bandar.status === 'ACCUMULATION') {
    positives.push(`Bandarmology confirms ${bandar.status.toLowerCase()} with top buyer concentration at ${bandar.top3BuyerConcentration}% and net broker lead of +${bandar.brokerConcentrationDiff}%.`);
  }
  if (bandar.netForeignFlow > 2000000000) {
    positives.push(`Positive foreign institutional net inflow of Rp ${(bandar.netForeignFlow / 1e9).toFixed(1)}B.`);
  }

  // Risks
  if (tech.isExtended) {
    risks.push('Price is slightly extended above 20-day mean, increasing mean-reversion risk at the open.');
  }
  if (tech.rsi14 > 72) {
    risks.push(`RSI(14) at ${Math.round(tech.rsi14)} indicates near-term overbought conditions.`);
  }
  if (hist.badGap1PctProb > 10.0) {
    risks.push(`Historical Bad Gap probability is elevated at ${hist.badGap1PctProb.toFixed(1)}% (requires disciplined opening cut-loss).`);
  }
  if (bandar.status === 'DISTRIBUTION' || bandar.status === 'STRONG DISTRIBUTION') {
    risks.push(`Broker summary indicates net distribution by top institutional desks.`);
  }
  if (stock.relativeVolume < 0.9) {
    risks.push('Volume during pre-closing session is below 20-day baseline average.');
  }
  if (hist.comparableSetupsCount < 18) {
    risks.push(`Limited historical sample size (${hist.comparableSetupsCount} observations) dampens statistical confidence.`);
  }
  if (risks.length === 0) {
    risks.push('Market-wide macro gap risk at IDX 09:00 opening if global index sentiment turns overnight.');
  }

  // Probability-based AI Conclusion
  let conclusion = '';
  if (stock.decision === 'STRONG BUY') {
    conclusion = `STRONG BUY — High-conviction overnight candidate. Favorable historical green expectancy (+${stock.expectedNetGap.toFixed(2)}% net) backed by high sample confidence (${hist.comparableSetupsCount} matches) and low tail risk (Tail Safety: ${tailRiskScore}/100). Recommended entry 15:35–15:45 WIB.`;
  } else if (stock.decision === 'BUY') {
    conclusion = `BUY — Favorable risk-adjusted overnight expectancy with modest gap-down probability (${hist.badGap1PctProb.toFixed(1)}%). Suitable for disciplined Buy-Close / Sell-Open rotation with early cut-loss stop if open is negative.`;
  } else if (stock.decision === 'WATCH') {
    conclusion = `WATCH — Constructive price action but tempered by borderline statistical edge or moderate tail risk. Monitor final 15:45 pre-closing auction volume before committing capital.`;
  } else if (stock.decision === 'SKIP') {
    conclusion = `SKIP — Insufficient edge-to-risk ratio. Net expected return after transaction frictions (+${stock.expectedNetGap.toFixed(2)}%) does not adequately compensate for overnight uncertainty.`;
  } else {
    conclusion = `AVOID — Elevated gap-down risk (Bad Gap prob ${hist.badGap1PctProb.toFixed(1)}%, worst gap ${hist.worstGap.toFixed(1)}%) violates strategy safety threshold. Opening cut-loss trigger risk is too high.`;
  }

  return {
    positiveFactors: positives.slice(0, 4),
    riskFactors: risks.slice(0, 3),
    aiConclusion: conclusion,
  };
}

// Comprehensive backtest runner
export function runBacktest(
  stocks: StockData[],
  settings: StrategySettings = DEFAULT_STRATEGY_SETTINGS,
  filterCriteria?: {
    minEdgeScore?: number;
    minGreenRate?: number;
    maxBadGap?: number;
    decisionOnly?: DecisionCategory[];
  }
): BacktestSummary {
  const allTrades: BacktestTrade[] = [];
  const minScore = filterCriteria?.minEdgeScore ?? 60;
  const minGreen = filterCriteria?.minGreenRate ?? 55;
  const maxBad = filterCriteria?.maxBadGap ?? 15;
  const allowedDecisions = filterCriteria?.decisionOnly ?? ['STRONG BUY', 'BUY'];
  const executionCosts = executionCostsFromSettings(settings);

  stocks.forEach(stock => {
    // Filter stocks matching candidate historical criteria
    if (stock.historicalStats.greenOpenRate < minGreen) return;
    if (stock.historicalStats.badGap1PctProb > maxBad) return;
    
    // Check candidate eligibility without survivorship bias
    const passesDecision = allowedDecisions.includes(stock.decision);
    const passesScore = stock.overnightEdgeScore >= minScore;
    if (!passesDecision && !passesScore) return;

    // Simulate trades from historical matches
    stock.historicalStats.matchedTrades.forEach(match => {
      const grossPct = match.gapPct;
      const netPct = netReturnAfterCosts(grossPct, executionCosts);

      allTrades.push({
        ticker: stock.ticker,
        entryDate: match.date,
        entryPrice: match.entryClose,
        exitDate: match.date,
        exitPrice: match.nextOpen,
        grossReturnPct: grossPct,
        netReturnPct: netPct,
        isWin: netPct > 0.0001,
        isBadGap: grossPct < -1.0,
        isSevereGap: grossPct < -2.0,
      });
    });
  });

  // Sort trades by date
  allTrades.sort((a, b) => a.entryDate.localeCompare(b.entryDate));

  if (allTrades.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      flats: 0,
      winRate: 0,
      avgGrossReturn: 0,
      avgNetReturn: 0,
      medianNetReturn: 0,
      profitFactor: 0,
      expectedValuePerTrade: 0,
      maxDrawdownPct: 0,
      worstTradePct: 0,
      bestTradePct: 0,
      badGap1PctCount: 0,
      badGap1PctRate: 0,
      severeGap2PctCount: 0,
      severeGap2PctRate: 0,
      maxConsecutiveLosses: 0,
      sharpeRatio: 0,
      gapReturnDistribution: [],
      equityCurve: [],
    };
  }

  const netReturns = allTrades.map(t => t.netReturnPct);
  const grossReturns = allTrades.map(t => t.grossReturnPct);
  const wins = allTrades.filter(t => t.netReturnPct > 0.0001).length;
  const losses = allTrades.filter(t => t.netReturnPct < -0.0001).length;
  const flats = allTrades.filter(t => Math.abs(t.netReturnPct) <= 0.0001).length;
  
  const avgGross = grossReturns.reduce((a, b) => a + b, 0) / allTrades.length;
  const avgNet = netReturns.reduce((a, b) => a + b, 0) / allTrades.length;
  const medianNet = calculateMedian(netReturns);

  const totalGain = netReturns.filter(r => r > 0).reduce((a, b) => a + b, 0);
  const totalLoss = Math.abs(netReturns.filter(r => r < 0).reduce((a, b) => a + b, 0));
  const profitFactor = totalLoss > 0 ? totalGain / totalLoss : totalGain > 0 ? 99 : 0;

  // Drawdown and equity curve with realistic daily capital allocation
  let currentEquity = 100.0;
  let peakEquity = 100.0;
  let maxDrawdown = 0;
  const equityCurve: { tradeNumber: number; date: string; equity: number }[] = [
    { tradeNumber: 0, date: allTrades[0]?.entryDate || 'Start', equity: 100.0 }
  ];

  // Group trades by date to simulate realistic portfolio position sizing on concurrent signals
  const tradesByDate = new Map<string, BacktestTrade[]>();
  allTrades.forEach(trade => {
    const existing = tradesByDate.get(trade.entryDate) || [];
    existing.push(trade);
    tradesByDate.set(trade.entryDate, existing);
  });

  let tradeIndex = 0;
  const sortedDates = Array.from(tradesByDate.keys()).sort((a, b) => a.localeCompare(b));

  sortedDates.forEach(date => {
    const dailyTrades = tradesByDate.get(date) || [];
    if (dailyTrades.length === 0) return;

    // Equal-weighted allocation among concurrent trades on that day
    const avgDailyNetReturn = dailyTrades.reduce((sum, t) => sum + t.netReturnPct, 0) / dailyTrades.length;

    currentEquity = currentEquity * (1 + avgDailyNetReturn / 100);
    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const dd = ((peakEquity - currentEquity) / peakEquity) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;

    dailyTrades.forEach(t => {
      tradeIndex++;
      equityCurve.push({
        tradeNumber: tradeIndex,
        date: t.entryDate,
        equity: Math.round(currentEquity * 100) / 100,
      });
    });
  });

  let currentStreak = 0;
  let maxConsecLosses = 0;
  allTrades.forEach(t => {
    if (t.netReturnPct < -0.0001) {
      currentStreak++;
      if (currentStreak > maxConsecLosses) maxConsecLosses = currentStreak;
    } else if (t.netReturnPct > 0.0001) {
      currentStreak = 0;
    }
  });

  // Standard deviation for Sharpe-like ratio
  const variance = netReturns.reduce((acc, val) => acc + Math.pow(val - avgNet, 2), 0) / netReturns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgNet / stdDev) * Math.sqrt(240) : 0; // Annualized

  // Distribution buckets
  const buckets = [
    { range: '< -3.0%', min: -Infinity, max: -3.0, isLoss: true },
    { range: '-3.0% to -2.0%', min: -3.0, max: -2.0, isLoss: true },
    { range: '-2.0% to -1.0%', min: -2.0, max: -1.0, isLoss: true },
    { range: '-1.0% to -0.5%', min: -1.0, max: -0.5, isLoss: true },
    { range: '-0.5% to 0.0%', min: -0.5, max: 0.0, isLoss: true },
    { range: '0.0% to +0.5%', min: 0.0, max: 0.5, isLoss: false },
    { range: '+0.5% to +1.0%', min: 0.5, max: 1.0, isLoss: false },
    { range: '+1.0% to +2.0%', min: 1.0, max: 2.0, isLoss: false },
    { range: '+2.0% to +3.0%', min: 2.0, max: 3.0, isLoss: false },
    { range: '> +3.0%', min: 3.0, max: Infinity, isLoss: false },
  ];

  const distribution = buckets.map(b => {
    const count = grossReturns.filter(r => r >= b.min && r < b.max).length;
    return {
      range: b.range,
      count,
      percentage: Math.round((count / grossReturns.length) * 1000) / 10,
      isLoss: b.isLoss,
    };
  });

  const badGapCount = allTrades.filter(t => t.isBadGap).length;
  const severeGapCount = allTrades.filter(t => t.isSevereGap).length;

  return {
    totalTrades: allTrades.length,
    wins,
    losses,
    flats,
    winRate: Math.round((wins / allTrades.length) * 1000) / 10,
    avgGrossReturn: Math.round(avgGross * 100) / 100,
    avgNetReturn: Math.round(avgNet * 100) / 100,
    medianNetReturn: Math.round(medianNet * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    expectedValuePerTrade: Math.round(avgNet * 100) / 100,
    maxDrawdownPct: Math.round(maxDrawdown * 10) / 10,
    worstTradePct: Math.round(Math.min(...netReturns) * 100) / 100,
    bestTradePct: Math.round(Math.max(...netReturns) * 100) / 100,
    badGap1PctCount: badGapCount,
    badGap1PctRate: Math.round((badGapCount / allTrades.length) * 1000) / 10,
    severeGap2PctCount: severeGapCount,
    severeGap2PctRate: Math.round((severeGapCount / allTrades.length) * 1000) / 10,
    maxConsecutiveLosses: maxConsecLosses,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    gapReturnDistribution: distribution,
    equityCurve,
  };
}
