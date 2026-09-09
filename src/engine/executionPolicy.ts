import { StrategySettings } from '../types';

export interface ExecutionCosts {
  buyFeePct: number;
  sellFeePct: number;
  slippagePct: number;
}

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

function finiteNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Keep all transaction-friction assumptions behind one boundary so backtests,
 * simulated execution and future broker/provider integrations cannot silently
 * diverge on fees or slippage.
 */
export function normalizeExecutionCosts(
  costs: Partial<ExecutionCosts> = DEFAULT_EXECUTION_COSTS,
): ExecutionCosts {
  return {
    buyFeePct: finiteNonNegative(costs.buyFeePct ?? DEFAULT_EXECUTION_COSTS.buyFeePct, DEFAULT_EXECUTION_COSTS.buyFeePct),
    sellFeePct: finiteNonNegative(costs.sellFeePct ?? DEFAULT_EXECUTION_COSTS.sellFeePct, DEFAULT_EXECUTION_COSTS.sellFeePct),
    slippagePct: finiteNonNegative(costs.slippagePct ?? DEFAULT_EXECUTION_COSTS.slippagePct, DEFAULT_EXECUTION_COSTS.slippagePct),
  };
}

export function executionCostsFromSettings(settings: StrategySettings): ExecutionCosts {
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
