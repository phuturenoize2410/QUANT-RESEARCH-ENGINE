import { StrategySettings } from '../types';
import { DEFAULT_STRATEGY_SETTINGS } from './analytics';

export interface ExecutionCosts {
  buyFeePct: number;
  sellFeePct: number;
  slippagePct: number;
}

// Strategy settings remain the single source of default fee/slippage assumptions.
// Execution consumers read them only through this policy boundary.
export const DEFAULT_EXECUTION_COSTS: Readonly<ExecutionCosts> = Object.freeze({
  buyFeePct: DEFAULT_STRATEGY_SETTINGS.buyFeePct,
  sellFeePct: DEFAULT_STRATEGY_SETTINGS.sellFeePct,
  slippagePct: DEFAULT_STRATEGY_SETTINGS.slippagePct,
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
