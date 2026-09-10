import { ExitDecisionStatus, StrategySettings } from '../types';

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

/**
 * Canonical prototype position size for strategy-generated journal entries.
 * This is a Risk/Execution policy, not market microstructure: the active market
 * adapter still owns the conversion from lots to shares/contracts.
 */
export const DEFAULT_RESEARCH_POSITION_LOTS = 100;

/**
 * Canonical default round-trip friction used by research consumers that only
 * need the aggregate hurdle. Exporting the aggregate prevents downstream ML,
 * strategy and UI layers from re-encoding a stale magic number.
 */
export const DEFAULT_TOTAL_FRICTION_PCT =
  DEFAULT_EXECUTION_COSTS.buyFeePct +
  DEFAULT_EXECUTION_COSTS.sellFeePct +
  DEFAULT_EXECUTION_COSTS.slippagePct;

export interface OvernightExitPolicy {
  /** Stop distance below entry, expressed as a positive percentage. */
  stopLossPct: number;
  /** Take-profit distance above entry, expressed as a positive percentage. */
  takeProfitPct: number;
  /** Open-gap threshold that immediately classifies the position as take profit. */
  takeProfitGapPct: number;
  /** Absolute negative open-gap threshold that immediately classifies the position as cut loss. */
  cutLossGapPct: number;
}

/**
 * Canonical simulated risk/exit assumptions. Keeping them next to transaction
 * costs makes Risk/Execution the single owner of execution policy instead of
 * allowing UI/builders to embed their own thresholds.
 */
export const DEFAULT_OVERNIGHT_EXIT_POLICY: Readonly<OvernightExitPolicy> = Object.freeze({
  stopLossPct: 1.5,
  takeProfitPct: 1.5,
  takeProfitGapPct: 0.8,
  cutLossGapPct: 0.8,
});

export interface OvernightExitDecision {
  cutLossLevel: number;
  takeProfitLevel: number;
  exitStatus: ExitDecisionStatus;
}

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

export function normalizeOvernightExitPolicy(
  policy: Partial<OvernightExitPolicy> = DEFAULT_OVERNIGHT_EXIT_POLICY,
): OvernightExitPolicy {
  return {
    stopLossPct: finiteNonNegative(policy.stopLossPct ?? DEFAULT_OVERNIGHT_EXIT_POLICY.stopLossPct, DEFAULT_OVERNIGHT_EXIT_POLICY.stopLossPct),
    takeProfitPct: finiteNonNegative(policy.takeProfitPct ?? DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitPct, DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitPct),
    takeProfitGapPct: finiteNonNegative(policy.takeProfitGapPct ?? DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitGapPct, DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitGapPct),
    cutLossGapPct: finiteNonNegative(policy.cutLossGapPct ?? DEFAULT_OVERNIGHT_EXIT_POLICY.cutLossGapPct, DEFAULT_OVERNIGHT_EXIT_POLICY.cutLossGapPct),
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

/**
 * Convert simulated open-gap output into the canonical overnight risk decision.
 * UI consumers receive the decision; they do not own or reconstruct thresholds.
 */
export function deriveOvernightExitDecision(
  entryPrice: number,
  openGapPct: number,
  policy: Partial<OvernightExitPolicy> = DEFAULT_OVERNIGHT_EXIT_POLICY,
): OvernightExitDecision {
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

  return {
    cutLossLevel,
    takeProfitLevel,
    exitStatus,
  };
}
