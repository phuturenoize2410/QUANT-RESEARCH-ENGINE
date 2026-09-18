import { ExitDecisionStatus, StrategySettings } from '../types';

export interface ExecutionCosts {
  readonly buyFeePct: number;
  readonly sellFeePct: number;
  readonly slippagePct: number;
}

export interface ExecutionFrictionBreakdown {
  readonly grossProfit: number;
  readonly buyFee: number;
  readonly sellFee: number;
  readonly slippage: number;
  readonly totalFriction: number;
  readonly netProfit: number;
}

/** Canonical percentage domain for execution/risk policy inputs. */
export const EXECUTION_POLICY_PERCENT_MIN = 0;
export const EXECUTION_POLICY_PERCENT_MAX = 100;

/**
 * Canonical default transaction-friction assumptions for the research engine.
 *
 * Keep these defaults dependency-free: strategy/backtest/execution layers may
 * depend on this policy, but this policy must not depend on analytics or UI.
 * That preserves the intended flow and prevents circular imports when
 * backtests consume the same cost model as simulated execution.
 */
export const DEFAULT_EXECUTION_COSTS: Readonly<ExecutionCosts> = Object.freeze({
  buyFeePct: 0.15,
  sellFeePct: 0.25,
  slippagePct: 0.10,
});

export const DEFAULT_RESEARCH_POSITION_LOTS = 100;

export const DEFAULT_TOTAL_FRICTION_PCT =
  DEFAULT_EXECUTION_COSTS.buyFeePct +
  DEFAULT_EXECUTION_COSTS.sellFeePct +
  DEFAULT_EXECUTION_COSTS.slippagePct;

export interface OvernightExitPolicy {
  readonly stopLossPct: number;
  readonly takeProfitPct: number;
  readonly takeProfitGapPct: number;
  readonly cutLossGapPct: number;
}

export const DEFAULT_OVERNIGHT_EXIT_POLICY: Readonly<OvernightExitPolicy> = Object.freeze({
  stopLossPct: 1.5,
  takeProfitPct: 1.5,
  takeProfitGapPct: 0.8,
  cutLossGapPct: 0.8,
});

export interface OvernightExitDecision {
  readonly cutLossLevel: number;
  readonly takeProfitLevel: number;
  readonly exitStatus: ExitDecisionStatus;
}

function finitePolicyPercentage(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= EXECUTION_POLICY_PERCENT_MIN && value <= EXECUTION_POLICY_PERCENT_MAX
    ? value
    : fallback;
}

export function normalizeExecutionCosts(
  costs: Partial<ExecutionCosts> = DEFAULT_EXECUTION_COSTS,
): Readonly<ExecutionCosts> {
  return Object.freeze({
    buyFeePct: finitePolicyPercentage(costs.buyFeePct ?? DEFAULT_EXECUTION_COSTS.buyFeePct, DEFAULT_EXECUTION_COSTS.buyFeePct),
    sellFeePct: finitePolicyPercentage(costs.sellFeePct ?? DEFAULT_EXECUTION_COSTS.sellFeePct, DEFAULT_EXECUTION_COSTS.sellFeePct),
    slippagePct: finitePolicyPercentage(costs.slippagePct ?? DEFAULT_EXECUTION_COSTS.slippagePct, DEFAULT_EXECUTION_COSTS.slippagePct),
  });
}

export function normalizeOvernightExitPolicy(
  policy: Partial<OvernightExitPolicy> = DEFAULT_OVERNIGHT_EXIT_POLICY,
): Readonly<OvernightExitPolicy> {
  return Object.freeze({
    stopLossPct: finitePolicyPercentage(policy.stopLossPct ?? DEFAULT_OVERNIGHT_EXIT_POLICY.stopLossPct, DEFAULT_OVERNIGHT_EXIT_POLICY.stopLossPct),
    takeProfitPct: finitePolicyPercentage(policy.takeProfitPct ?? DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitPct, DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitPct),
    takeProfitGapPct: finitePolicyPercentage(policy.takeProfitGapPct ?? DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitGapPct, DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitGapPct),
    cutLossGapPct: finitePolicyPercentage(policy.cutLossGapPct ?? DEFAULT_OVERNIGHT_EXIT_POLICY.cutLossGapPct, DEFAULT_OVERNIGHT_EXIT_POLICY.cutLossGapPct),
  });
}

export function executionCostsFromSettings(settings: StrategySettings): Readonly<ExecutionCosts> {
  return normalizeExecutionCosts({
    buyFeePct: settings.buyFeePct,
    sellFeePct: settings.sellFeePct,
    slippagePct: settings.slippagePct,
  });
}

export function totalFrictionPct(costs: Partial<ExecutionCosts> = DEFAULT_EXECUTION_COSTS): number {
  const normalized = normalizeExecutionCosts(costs);
  return normalized.buyFeePct + normalized.sellFeePct + normalized.slippagePct;
}

export function netReturnAfterCosts(
  grossReturnPct: number,
  costs: Partial<ExecutionCosts> = DEFAULT_EXECUTION_COSTS,
): number {
  const safeGrossReturn = Number.isFinite(grossReturnPct) ? grossReturnPct : 0;
  return safeGrossReturn - totalFrictionPct(costs);
}

/**
 * Canonical monetary friction calculation for simulated/backtest execution.
 * Consumers supply only authoritative buy/sell notionals; gross P/L is derived
 * internally and returned as evidence so downstream execution does not derive
 * a second monetary truth from the same notionals.
 */
export function calculateExecutionFriction(
  buyNotional: number,
  sellNotional: number,
  costs: Partial<ExecutionCosts> = DEFAULT_EXECUTION_COSTS,
): Readonly<ExecutionFrictionBreakdown> {
  const normalized = normalizeExecutionCosts(costs);
  const safeBuyNotional = Number.isFinite(buyNotional) && buyNotional > 0 ? buyNotional : 0;
  const safeSellNotional = Number.isFinite(sellNotional) && sellNotional > 0 ? sellNotional : 0;
  const grossProfit = safeSellNotional - safeBuyNotional;
  const buyFee = safeBuyNotional * (normalized.buyFeePct / 100);
  const sellFee = safeSellNotional * (normalized.sellFeePct / 100);
  const slippage = (safeBuyNotional + safeSellNotional) * (normalized.slippagePct / 200);
  const totalFriction = buyFee + sellFee + slippage;

  return Object.freeze({
    grossProfit,
    buyFee,
    sellFee,
    slippage,
    totalFriction,
    netProfit: grossProfit - totalFriction,
  });
}

export function deriveOvernightExitDecision(
  entryPrice: number,
  openGapPct: number,
  policy: Partial<OvernightExitPolicy> = DEFAULT_OVERNIGHT_EXIT_POLICY,
): Readonly<OvernightExitDecision> {
  const normalized = normalizeOvernightExitPolicy(policy);
  const safeEntryPrice = Number.isFinite(entryPrice) && entryPrice > 0 ? entryPrice : 0;
  const safeOpenGapPct = Number.isFinite(openGapPct) ? openGapPct : 0;

  const cutLossLevel = Math.round(safeEntryPrice * (1 - normalized.stopLossPct / 100));
  const takeProfitLevel = Math.round(safeEntryPrice * (1 + normalized.takeProfitPct / 100));
  const exitStatus: ExitDecisionStatus =
    safeOpenGapPct >= normalized.takeProfitGapPct
      ? 'TAKE PROFIT'
      : safeOpenGapPct <= -normalized.cutLossGapPct
        ? 'CUT LOSS'
        : 'FLAT / EXIT';

  return Object.freeze({ cutLossLevel, takeProfitLevel, exitStatus });
}
