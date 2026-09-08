import { MorningPosition, StockData, StrategySettings } from '../types';

export interface ExecutionCosts {
  buyFeePct: number;
  sellFeePct: number;
  slippagePct: number;
}

export interface OvernightExecutionEstimate {
  entryPrice: number;
  estimatedOpenPrice: number;
  grossReturnPct: number;
  netReturnPct: number;
  totalCostIDR: number;
  estimatedSellValueIDR: number;
  grossProfitIDR: number;
  netProfitIDR: number;
  totalFrictionPct: number;
}

export const DEFAULT_EXECUTION_COSTS: ExecutionCosts = {
  buyFeePct: 0.15,
  sellFeePct: 0.25,
  slippagePct: 0.10,
};

export function executionCostsFromSettings(settings: StrategySettings): ExecutionCosts {
  return {
    buyFeePct: settings.buyFeePct,
    sellFeePct: settings.sellFeePct,
    slippagePct: settings.slippagePct,
  };
}

export function totalFrictionPct(costs: ExecutionCosts = DEFAULT_EXECUTION_COSTS): number {
  return costs.buyFeePct + costs.sellFeePct + costs.slippagePct;
}

export function netReturnAfterCosts(
  grossReturnPct: number,
  costs: ExecutionCosts = DEFAULT_EXECUTION_COSTS,
): number {
  return grossReturnPct - totalFrictionPct(costs);
}

export function estimateOvernightExecution(
  entryPrice: number,
  lots: number,
  expectedGapPct: number,
  costs: ExecutionCosts = DEFAULT_EXECUTION_COSTS,
): OvernightExecutionEstimate {
  const shares = lots * 100;
  const estimatedOpenPrice = Math.round(entryPrice * (1 + expectedGapPct / 100));
  const totalCostIDR = entryPrice * shares;
  const estimatedSellValueIDR = estimatedOpenPrice * shares;
  const grossProfitIDR = estimatedSellValueIDR - totalCostIDR;

  const buyFeeIDR = totalCostIDR * (costs.buyFeePct / 100);
  const sellFeeIDR = estimatedSellValueIDR * (costs.sellFeePct / 100);
  const slippageIDR = (totalCostIDR + estimatedSellValueIDR) * (costs.slippagePct / 200);
  const netProfitIDR = grossProfitIDR - buyFeeIDR - sellFeeIDR - slippageIDR;

  const grossReturnPct = totalCostIDR > 0 ? (grossProfitIDR / totalCostIDR) * 100 : 0;
  const netReturnPct = totalCostIDR > 0 ? (netProfitIDR / totalCostIDR) * 100 : 0;

  return {
    entryPrice,
    estimatedOpenPrice,
    grossReturnPct,
    netReturnPct,
    totalCostIDR,
    estimatedSellValueIDR,
    grossProfitIDR,
    netProfitIDR,
    totalFrictionPct: totalFrictionPct(costs),
  };
}

export function buildMorningPositionFromStock(
  stock: StockData,
  settings: StrategySettings,
  lots: number = 100,
): MorningPosition {
  const execution = estimateOvernightExecution(
    stock.price,
    lots,
    stock.historicalStats.avgOvernightGap,
    executionCostsFromSettings(settings),
  );

  const gapPct = Math.round(execution.grossReturnPct * 10) / 10;

  return {
    id: `pos-${Date.now()}`,
    ticker: stock.ticker,
    name: stock.name,
    purchaseDate: 'Today 15:45 WIB',
    entryPrice: stock.price,
    lots,
    totalCostIDR: execution.totalCostIDR,
    currentOpenPrice: execution.estimatedOpenPrice,
    openGapPct: gapPct,
    grossProfitIDR: execution.grossProfitIDR,
    netProfitIDR: Math.round(execution.netProfitIDR),
    netProfitPct: Math.round(execution.netReturnPct * 100) / 100,
    cutLossLevel: Math.round(stock.price * 0.985),
    takeProfitLevel: Math.round(stock.price * 1.015),
    exitStatus: gapPct >= 0.8 ? 'TAKE PROFIT' : gapPct <= -0.8 ? 'CUT LOSS' : 'FLAT / EXIT',
    notes: `Bought from 15:45 Shortlist (Edge Score: ${stock.overnightEdgeScore}; simulated friction: ${execution.totalFrictionPct.toFixed(2)}%)`,
  };
}
