import { MorningPosition, StockData, StrategySettings } from '../types';
import {
  DEFAULT_EXECUTION_COSTS,
  DEFAULT_OVERNIGHT_EXIT_POLICY,
  ExecutionCosts,
  deriveOvernightExitDecision,
  executionCostsFromSettings,
  normalizeExecutionCosts,
  normalizeOvernightExitPolicy,
  totalFrictionPct,
  netReturnAfterCosts,
} from './executionPolicy';
import { CurrencyCode, formatMarketTimeLabel, MarketAdapter } from './market/marketAdapter';
import { IDX_MARKET_ADAPTER } from './market/idxMarketAdapter';

export type { ExecutionCosts, OvernightExitPolicy, OvernightExitDecision } from './executionPolicy';
export {
  DEFAULT_EXECUTION_COSTS,
  DEFAULT_OVERNIGHT_EXIT_POLICY,
  deriveOvernightExitDecision,
  executionCostsFromSettings,
  normalizeExecutionCosts,
  normalizeOvernightExitPolicy,
  totalFrictionPct,
  netReturnAfterCosts,
} from './executionPolicy';

export interface OvernightExecutionEstimate {
  entryPrice: number;
  estimatedOpenPrice: number;
  grossReturnPct: number;
  netReturnPct: number;
  /** Currency carried from the active market adapter. */
  currency: CurrencyCode;
  /** Market-neutral monetary fields for new quant/risk/execution consumers. */
  totalCost: number;
  estimatedSellValue: number;
  grossProfit: number;
  netProfit: number;
  /**
   * Legacy IDX aliases retained while UI/types are migrated incrementally.
   * New core consumers should use the market-neutral fields above.
   */
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
  const totalCost = safeEntryPrice * shares;
  const estimatedSellValue = estimatedOpenPrice * shares;
  const grossProfit = estimatedSellValue - totalCost;

  const buyFee = totalCost * (normalizedCosts.buyFeePct / 100);
  const sellFee = estimatedSellValue * (normalizedCosts.sellFeePct / 100);
  const slippage = (totalCost + estimatedSellValue) * (normalizedCosts.slippagePct / 200);
  const netProfit = grossProfit - buyFee - sellFee - slippage;

  const grossReturnPct = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0;
  const netReturnPct = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  return {
    entryPrice: safeEntryPrice,
    estimatedOpenPrice,
    grossReturnPct,
    netReturnPct,
    currency: market.identity.currency,
    totalCost,
    estimatedSellValue,
    grossProfit,
    netProfit,
    // Compatibility bridge for the existing IDX-oriented UI contract.
    totalCostIDR: totalCost,
    estimatedSellValueIDR: estimatedSellValue,
    grossProfitIDR: grossProfit,
    netProfitIDR: netProfit,
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
  const riskDecision = deriveOvernightExitDecision(stock.price, gapPct);

  return {
    id: `pos-${Date.now()}`,
    ticker: stock.ticker,
    name: stock.name,
    purchaseDate: formatMarketTimeLabel(market, '15:45'),
    entryPrice: stock.price,
    lots,
    currency: execution.currency,
    totalCost: execution.totalCost,
    grossProfit: execution.grossProfit,
    netProfit: Math.round(execution.netProfit),
    // Legacy aliases keep the existing IDX UI stable while downstream consumers migrate.
    totalCostIDR: execution.totalCost,
    currentOpenPrice: execution.estimatedOpenPrice,
    openGapPct: gapPct,
    grossProfitIDR: execution.grossProfit,
    netProfitIDR: Math.round(execution.netProfit),
    netProfitPct: Math.round(execution.netReturnPct * 100) / 100,
    cutLossLevel: riskDecision.cutLossLevel,
    takeProfitLevel: riskDecision.takeProfitLevel,
    exitStatus: riskDecision.exitStatus,
    notes: `Bought from 15:45 Shortlist (Edge Score: ${stock.overnightEdgeScore}; simulated friction: ${execution.totalFrictionPct.toFixed(2)}%)`,
  };
}
