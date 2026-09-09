import { 
  StrategyBacktestTrade, 
  StrategyBacktestResult, 
  WalkForwardResult, 
  MonteCarloResult, 
  MarketRegime 
} from '../strategyTypes';
import { roundResearchRobustnessScore } from '../scorePolicy';

/**
 * Calculates Value at Risk (VaR 95%) and Conditional VaR / Expected Shortfall (CVaR 95%)
 */
export function calculateVaRAndCVaR(returns: number[], confidenceLevel: number = 0.95): { var95: number; cvar95: number } {
  if (returns.length === 0) return { var95: 0, cvar95: 0 };
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoffIndex = Math.max(0, Math.floor((1 - confidenceLevel) * sorted.length));
  const var95 = Math.abs(sorted[cutoffIndex] ?? 0);
  
  const tailLosses = sorted.slice(0, cutoffIndex + 1);
  const cvar95 = tailLosses.length > 0 
    ? Math.abs(tailLosses.reduce((sum, val) => sum + val, 0) / tailLosses.length)
    : var95;

  return {
    var95: Math.round(var95 * 100) / 100,
    cvar95: Math.round(cvar95 * 100) / 100,
  };
}

/**
 * Calculates Sortino Ratio (downside deviation only)
 */
export function calculateSortinoRatio(returns: number[], avgReturn: number): number {
  if (returns.length === 0) return 0;
  const downsideReturns = returns.filter(r => r < 0);
  if (downsideReturns.length === 0) return 3.5;
  const sumDownsideSquares = downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0);
  const downsideDeviation = Math.sqrt(sumDownsideSquares / returns.length);
  return downsideDeviation > 0 ? Math.round(((avgReturn / downsideDeviation) * Math.sqrt(240)) * 100) / 100 : 0;
}

/**
 * Walk-Forward Analysis (Strictly Chronological Split: 60% Train, 20% Validate, 20% Test)
 * Prevents overfitting and detects out-of-sample edge decay.
 */
export function runWalkForwardAnalysis(trades: StrategyBacktestTrade[]): WalkForwardResult {
  if (trades.length < 10) {
    return {
      trainWinRate: 50,
      trainProfitFactor: 1.0,
      trainTradesCount: trades.length,
      validateWinRate: 50,
      validateProfitFactor: 1.0,
      validateTradesCount: 0,
      testWinRate: 50,
      testProfitFactor: 1.0,
      testTradesCount: 0,
      robustnessScore: 50,
      isOverfitWarning: false,
    };
  }

  const sortedTrades = [...trades].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const n = sortedTrades.length;
  const trainEnd = Math.floor(n * 0.60);
  const valEnd = Math.floor(n * 0.80);

  const trainSet = sortedTrades.slice(0, trainEnd);
  const valSet = sortedTrades.slice(trainEnd, valEnd);
  const testSet = sortedTrades.slice(valEnd);

  const calcSetMetrics = (set: StrategyBacktestTrade[]) => {
    if (set.length === 0) return { winRate: 0, profitFactor: 1.0 };
    const wins = set.filter(t => t.isWin).length;
    const grossWins = set.filter(t => t.netReturnPct > 0).reduce((s, t) => s + t.netReturnPct, 0);
    const grossLosses = Math.abs(set.filter(t => t.netReturnPct < 0).reduce((s, t) => s + t.netReturnPct, 0));
    return {
      winRate: Math.round((wins / set.length) * 1000) / 10,
      profitFactor: grossLosses > 0 ? Math.round((grossWins / grossLosses) * 100) / 100 : 2.5,
    };
  };

  const trainMetrics = calcSetMetrics(trainSet);
  const valMetrics = calcSetMetrics(valSet);
  const testMetrics = calcSetMetrics(testSet);

  const trainWR = trainMetrics.winRate || 50;
  const testWR = testMetrics.winRate || 50;
  const ratio = testWR / Math.max(1, trainWR);
  const robustnessScore = roundResearchRobustnessScore(ratio * 85);
  const isOverfitWarning = trainWR > 65 && testWR < 45;

  return {
    trainWinRate: trainMetrics.winRate,
    trainProfitFactor: trainMetrics.profitFactor,
    trainTradesCount: trainSet.length,
    validateWinRate: valMetrics.winRate,
    validateProfitFactor: valMetrics.profitFactor,
    validateTradesCount: valSet.length,
    testWinRate: testMetrics.winRate,
    testProfitFactor: testMetrics.profitFactor,
    testTradesCount: testSet.length,
    robustnessScore,
    isOverfitWarning,
  };
}

/**
 * Monte Carlo Simulation: 1,000 runs sampling with replacement from historical trades.
 * Generates terminal wealth percentiles and drawdown probability bands.
 */
export function runMonteCarloSimulation(trades: StrategyBacktestTrade[], iterations: number = 1000): MonteCarloResult {
  if (trades.length === 0) {
    return {
      iterations,
      medianFinalEquity: 100,
      p5WorstCaseEquity: 85,
      p95BestCaseEquity: 115,
      probOfDrawdownOver10Pct: 15,
      probOfDrawdownOver20Pct: 3,
      probOfPositiveReturn: 70,
      simulatedPaths: [],
    };
  }

  const returns = trades.map(t => t.netReturnPct);
  const simTradeCount = Math.min(60, Math.max(20, trades.length));
  const finalEquities: number[] = [];
  let countDrawdown10 = 0;
  let countDrawdown20 = 0;
  let countPositive = 0;

  const samplePathsToRender: { pathId: number; points: number[] }[] = [];

  for (let iter = 0; iter < iterations; iter++) {
    let eq = 100.0;
    let peak = 100.0;
    let maxDD = 0;
    const points: number[] = [100.0];

    for (let step = 0; step < simTradeCount; step++) {
      const rndIdx = Math.floor(Math.random() * returns.length);
      const ret = returns[rndIdx];
      eq = eq * (1 + ret / 100);
      if (eq > peak) peak = eq;
      const dd = ((peak - eq) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
      
      if (iter < 12 && (step % 3 === 0 || step === simTradeCount - 1)) {
        points.push(Math.round(eq * 10) / 10);
      }
    }

    finalEquities.push(eq);
    if (maxDD >= 10) countDrawdown10++;
    if (maxDD >= 20) countDrawdown20++;
    if (eq > 100) countPositive++;

    if (iter < 12) {
      samplePathsToRender.push({ pathId: iter, points });
    }
  }

  finalEquities.sort((a, b) => a - b);
  const p5 = finalEquities[Math.floor(iterations * 0.05)] || 90;
  const p50 = finalEquities[Math.floor(iterations * 0.50)] || 110;
  const p95 = finalEquities[Math.floor(iterations * 0.95)] || 135;

  return {
    iterations,
    medianFinalEquity: Math.round(p50 * 10) / 10,
    p5WorstCaseEquity: Math.round(p5 * 10) / 10,
    p95BestCaseEquity: Math.round(p95 * 10) / 10,
    probOfDrawdownOver10Pct: Math.round((countDrawdown10 / iterations) * 100),
    probOfDrawdownOver20Pct: Math.round((countDrawdown20 / iterations) * 100),
    probOfPositiveReturn: Math.round((countPositive / iterations) * 100),
    simulatedPaths: samplePathsToRender,
  };
}

/**
 * Calculates standard Backtest summary and builds cumulative equity curve
 */
export function buildBacktestSummary(
  strategyId: string,
  strategyName: string,
  trades: StrategyBacktestTrade[]
): StrategyBacktestResult {
  if (trades.length === 0) {
    return {
      strategyId,
      strategyName,
      totalTrades: 0,
      winRate: 0,
      avgReturnPct: 0,
      medianReturnPct: 0,
      profitFactor: 1.0,
      maxDrawdownPct: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      var95: 0,
      expectedShortfallCVaR: 0,
      worstTradePct: 0,
      bestTradePct: 0,
      avgWinPct: 0,
      avgLossPct: 0,
      calmarRatio: 0,
      equityCurve: [{ date: 'Start', equity: 100, tradeNumber: 0 }],
      trades: [],
      regimeBreakdown: {
        BULLISH_TREND: { winRate: 0, tradeCount: 0, avgReturnPct: 0 },
        SIDEWAYS_RANGE: { winRate: 0, tradeCount: 0, avgReturnPct: 0 },
        HIGH_VOLATILITY: { winRate: 0, tradeCount: 0, avgReturnPct: 0 },
        BEARISH_CORRECTION: { winRate: 0, tradeCount: 0, avgReturnPct: 0 },
      },
    };
  }

  const returns = trades.map(t => t.netReturnPct);
  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin);

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const medianReturn = sortedReturns[Math.floor(sortedReturns.length / 2)] || 0;

  const grossWins = wins.reduce((sum, t) => sum + t.netReturnPct, 0);
  const grossLosses = Math.abs(losses.reduce((sum, t) => sum + t.netReturnPct, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : 3.0;

  const avgWinPct = wins.length > 0 ? grossWins / wins.length : 0;
  const avgLossPct = losses.length > 0 ? -(grossLosses / losses.length) : 0;

  let equity = 100.0;
  let peak = 100.0;
  let maxDD = 0;
  const equityCurve = [{ date: trades[0].entryDate || 'Start', equity: 100.0, tradeNumber: 0 }];

  trades.forEach((t, i) => {
    equity = equity * (1 + t.netReturnPct / 100);
    if (equity > peak) peak = equity;
    const dd = ((peak - equity) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
    equityCurve.push({
      date: t.exitDate,
      equity: Math.round(equity * 100) / 100,
      tradeNumber: i + 1,
    });
  });

  const { var95, cvar95 } = calculateVaRAndCVaR(returns);
  const variance = returns.reduce((acc, val) => acc + Math.pow(val - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? Math.round(((avgReturn / stdDev) * Math.sqrt(240)) * 100) / 100 : 0;
  const sortinoRatio = calculateSortinoRatio(returns, avgReturn);
  const calmarRatio = maxDD > 0 ? Math.round(((avgReturn * 240 / maxDD)) * 10) / 10 : 1.5;

  const regimes: MarketRegime[] = ['BULLISH_TREND', 'SIDEWAYS_RANGE', 'HIGH_VOLATILITY', 'BEARISH_CORRECTION'];
  const regimeBreakdown = regimes.reduce((acc, reg) => {
    const regTrades = trades.filter(t => t.regime === reg);
    const regWins = regTrades.filter(t => t.isWin).length;
    const regWinRate = regTrades.length > 0 ? Math.round((regWins / regTrades.length) * 1000) / 10 : 0;
    const regAvgRet = regTrades.length > 0 
      ? Math.round((regTrades.reduce((s, t) => s + t.netReturnPct, 0) / regTrades.length) * 100) / 100 
      : 0;
    acc[reg] = {
      winRate: regWinRate,
      tradeCount: regTrades.length,
      avgReturnPct: regAvgRet,
    };
    return acc;
  }, {} as Record<MarketRegime, { winRate: number; tradeCount: number; avgReturnPct: number }>);

  const walkForward = runWalkForwardAnalysis(trades);
  const monteCarlo = runMonteCarloSimulation(trades, 800);

  return {
    strategyId,
    strategyName,
    totalTrades: trades.length,
    winRate: Math.round((wins.length / trades.length) * 1000) / 10,
    avgReturnPct: Math.round(avgReturn * 100) / 100,
    medianReturnPct: Math.round(medianReturn * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdownPct: Math.round(maxDD * 10) / 10,
    sharpeRatio,
    sortinoRatio,
    var95,
    expectedShortfallCVaR: cvar95,
    worstTradePct: Math.round(Math.min(...returns) * 100) / 100,
    bestTradePct: Math.round(Math.max(...returns) * 100) / 100,
    avgWinPct: Math.round(avgWinPct * 100) / 100,
    avgLossPct: Math.round(avgLossPct * 100) / 100,
    calmarRatio,
    equityCurve,
    trades,
    regimeBreakdown,
    walkForward,
    monteCarlo,
  };
}
