import { MorningPosition, StockData, StrategySettings } from '../types';
import {
  DEFAULT_EXECUTION_COSTS,
  ExecutionCosts,
  executionCostsFromSettings,
  normalizeExecutionCosts,
  totalFrictionPct,
  netReturnAfterCosts,
} from './executionPolicy';
import { formatMarketTimeLabel, MarketAdapter } from './market/marketAdapter';
import { IDX_MARKET_ADAPTER } from './market/idxMarketAdapter';

export type { ExecutionCosts } from './executionPolicy';
export {
  DEFAULT_EXECUTION_COSTS,
  executionCostsFromSettings,
  normalizeExecutionCosts,
  totalFrictionPct,
  netReturnAfterCosts,
} from './executionPolicy';

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

export function estimateOvernightExecution(
  entryPrice: number,
  lots: number,
  expectedGapPct: number,
  costs: ExecutionCosts = DEFAULT_EXECUTION_COSTS,
  market: MarketAdapter = IDX_MARKET_ADAPTER,
): OvernightExecutionEstimate {
  const normalizedCosts = normalizeExecutionCosts(costs);
  const safeEntryPrice = Number.isFinite(entryPrice) && entryPrice > 0 ? entryPrice : 0;
  const safeLots = Number.isFinite(lots) && lots > 0 ? lots : 0;
  const safeExpectedGapPct = Number.isFinite(expectedGapPct) ? expectedGapPct : 0;

  // Quantity conversion is a market-microstructure concern. IDX currently uses
  // 100 shares per board lot; future markets can supply a different adapter
  // without changing the generic execution calculation below.
  const shares = safeLots * market.microstructure.sharesPerLot();
  const estimatedOpenPrice = Math.round(safeEntryPrice * (1 + safeExpectedGapPct / 100));
  const totalCostIDR = safeEntryPrice * shares;
  const estimatedSellValueIDR = estimatedOpenPrice * shares;
  const grossProfitIDR = estimatedSellValueIDR - totalCostIDR;

  const buyFeeIDR = totalCostIDR * (normalizedCosts.buyFeePct / 100);
  const sellFeeIDR = estimatedSellValueIDR * (normalizedCosts.sellFeePct / 100);
  const slippageIDR = (totalCostIDR + estimatedSellValueIDR) * (normalizedCosts.slippagePct / 200);
  const netProfitIDR = grossProfitIDR - buyFeeIDR - sellFeeIDR - slippageIDR;

  const grossReturnPct = totalCostIDR > 0 ? (grossProfitIDR / totalCostIDR) * 100 : 0;
  const netReturnPct = totalCostIDR > 0 ? (netProfitIDR / totalCostIDR) * 100 : 0;

  return {
    entryPrice: safeEntryPrice,
    estimatedOpenPrice,
    grossReturnPct,
    netReturnPct,
    totalCostIDR,
    estimatedSellValueIDR,
    grossProfitIDR,
    netProfitIDR,
    totalFrictionPct: totalFrictionPct(normalizedCosts),
  };
}

export function buildMorningPositionFromStock(
  stock: StockData,
  settings: StrategySettings,
  lots: number = 100,
  market: MarketAdapter = IDX_MARKET_ADAPTER,
): MorningPosition {
  const execution = estimateOvernightExecution(
    stock.price,
    lots,
    stock.historicalStats.avgOvernightGap,
    executionCostsFromSettings(settings),
    market,
  );

  const gapPct = Math.round(execution.grossReturnPct * 10) / 10;

  return {
    id: `pos-${Date.now()}`,
    ticker: stock.ticker,
    name: stock.name,
    purchaseDate: formatMarketTimeLabel(market, '15:45'),
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
