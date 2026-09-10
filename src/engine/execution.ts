import { MorningPosition, StockData, StrategySettings } from '../types';
import {
  DEFAULT_EXECUTION_COSTS,
  DEFAULT_OVERNIGHT_EXIT_POLICY,
  DEFAULT_RESEARCH_POSITION_LOTS,
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
  DEFAULT_RESEARCH_POSITION_LOTS,
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

export interface ManualMorningPositionInput {
  ticker: string;
  entryPrice: number;
  lots: number;
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

/**
 * Converts raw manual-journal input into the same canonical Risk/Execution
 * contract used by shortlist-generated positions. The UI must not own lot-size,
 * fee/slippage, P/L, gap, or exit-threshold calculations.
 */
export function buildManualMorningPosition(
  input: ManualMorningPositionInput,
  stock: StockData | undefined,
  settings: StrategySettings,
  market: MarketAdapter = IDX_MARKET_ADAPTER,
): Omit<MorningPosition, 'id'> {
  const safeEntryPrice = Number.isFinite(input.entryPrice) && input.entryPrice > 0
    ? input.entryPrice
    : stock?.price ?? 1000;
  const safeLots = Number.isFinite(input.lots) && input.lots > 0 ? input.lots : 0;

  // Preserve prototype behavior: when a mock-universe stock exists, its mock
  // close is the base for the simulated next-open estimate. Otherwise use the
  // existing +0.8% fallback, but keep the result explicitly labelled simulated.
  const openBasePrice = stock?.price ?? safeEntryPrice;
  const simulatedGapPct = stock?.historicalStats.avgOvernightGap ?? 0.8;
  const simulatedOpenPrice = Math.round(openBasePrice * (1 + simulatedGapPct / 100));
  const expectedGapFromEntryPct = safeEntryPrice > 0
    ? ((simulatedOpenPrice / safeEntryPrice) - 1) * 100
    : 0;

  const execution = estimateOvernightExecution(
    safeEntryPrice,
    safeLots,
    expectedGapFromEntryPct,
    executionCostsFromSettings(settings),
    market,
  );
  const gapPct = Math.round(execution.grossReturnPct * 10) / 10;
  const riskDecision = deriveOvernightExitDecision(safeEntryPrice, gapPct);
  const roundedNetProfit = Math.round(execution.netProfit);

  return {
    ticker: input.ticker,
    name: stock?.name ?? input.ticker,
    purchaseDate: formatMarketTimeLabel(market, '15:42', 'Yesterday'),
    entryPrice: safeEntryPrice,
    lots: safeLots,
    currency: execution.currency,
    totalCost: execution.totalCost,
    grossProfit: execution.grossProfit,
    netProfit: roundedNetProfit,
    totalCostIDR: execution.totalCost,
    currentOpenPrice: execution.estimatedOpenPrice,
    openGapPct: gapPct,
    grossProfitIDR: execution.grossProfit,
    netProfitIDR: roundedNetProfit,
    netProfitPct: Math.round(execution.netReturnPct * 10) / 10,
    cutLossLevel: riskDecision.cutLossLevel,
    takeProfitLevel: riskDecision.takeProfitLevel,
    exitStatus: riskDecision.exitStatus,
    notes: `Manual overnight journal entry; simulated open estimate with centralized friction: ${execution.totalFrictionPct.toFixed(2)}%`,
  };
}

export function buildMorningPositionFromStock(
  stock: StockData,
  settings: StrategySettings,
  lots: number = DEFAULT_RESEARCH_POSITION_LOTS,
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
