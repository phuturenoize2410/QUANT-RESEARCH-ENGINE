import {
  DEFAULT_EXECUTION_COSTS,
  DEFAULT_OVERNIGHT_EXIT_POLICY,
  DEFAULT_RESEARCH_POSITION_LOTS,
  deriveOvernightExitDecision,
  netReturnAfterCosts,
  normalizeExecutionCosts,
  normalizeOvernightExitPolicy,
  totalFrictionPct,
} from '../src/engine/executionPolicy';
import { buildMorningPositionFromStock, estimateOvernightExecution } from '../src/engine/execution';
import { buildUniverse } from '../src/data/mockStocks';
import { DEFAULT_STRATEGY_SETTINGS } from '../src/engine/analytics';

const canonicalFriction = totalFrictionPct(DEFAULT_EXECUTION_COSTS);
const expectedCanonicalFriction =
  DEFAULT_EXECUTION_COSTS.buyFeePct +
  DEFAULT_EXECUTION_COSTS.sellFeePct +
  DEFAULT_EXECUTION_COSTS.slippagePct;

if (Math.abs(canonicalFriction - expectedCanonicalFriction) > 1e-9) {
  throw new Error('Canonical total friction must equal buy fee + sell fee + slippage.');
}

const malformed = normalizeExecutionCosts({
  buyFeePct: Number.NaN,
  sellFeePct: -1,
  slippagePct: Number.POSITIVE_INFINITY,
});

if (
  malformed.buyFeePct !== DEFAULT_EXECUTION_COSTS.buyFeePct ||
  malformed.sellFeePct !== DEFAULT_EXECUTION_COSTS.sellFeePct ||
  malformed.slippagePct !== DEFAULT_EXECUTION_COSTS.slippagePct
) {
  throw new Error('Malformed execution costs must fall back to canonical defaults.');
}

const grossReturnPct = 1.5;
const netReturnPct = netReturnAfterCosts(grossReturnPct, DEFAULT_EXECUTION_COSTS);
if (Math.abs(netReturnPct - (grossReturnPct - canonicalFriction)) > 1e-9) {
  throw new Error('Net-return policy must deduct the same canonical friction used elsewhere.');
}

const estimate = estimateOvernightExecution(10_000, 100, grossReturnPct, DEFAULT_EXECUTION_COSTS);
if (Math.abs(estimate.totalFrictionPct - canonicalFriction) > 1e-9) {
  throw new Error('Execution estimates must report friction from the centralized policy.');
}

if (estimate.netProfitIDR >= estimate.grossProfitIDR) {
  throw new Error('Positive execution costs must reduce simulated profit.');
}

const takeProfitDecision = deriveOvernightExitDecision(10_000, DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitGapPct);
if (
  takeProfitDecision.exitStatus !== 'TAKE PROFIT' ||
  takeProfitDecision.takeProfitLevel !== 10_150 ||
  takeProfitDecision.cutLossLevel !== 9_850
) {
  throw new Error('Canonical overnight exit policy must own take-profit and stop-loss decisions.');
}

const cutLossDecision = deriveOvernightExitDecision(10_000, -DEFAULT_OVERNIGHT_EXIT_POLICY.cutLossGapPct);
if (cutLossDecision.exitStatus !== 'CUT LOSS') {
  throw new Error('Canonical overnight exit policy must classify negative gap thresholds consistently.');
}

const flatDecision = deriveOvernightExitDecision(10_000, 0.1);
if (flatDecision.exitStatus !== 'FLAT / EXIT') {
  throw new Error('Sub-threshold overnight gaps must remain flat/exit under the canonical policy.');
}

const malformedExitPolicy = normalizeOvernightExitPolicy({
  stopLossPct: Number.NaN,
  takeProfitPct: -1,
  takeProfitGapPct: Number.POSITIVE_INFINITY,
  cutLossGapPct: -2,
});
if (
  malformedExitPolicy.stopLossPct !== DEFAULT_OVERNIGHT_EXIT_POLICY.stopLossPct ||
  malformedExitPolicy.takeProfitPct !== DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitPct ||
  malformedExitPolicy.takeProfitGapPct !== DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitGapPct ||
  malformedExitPolicy.cutLossGapPct !== DEFAULT_OVERNIGHT_EXIT_POLICY.cutLossGapPct
) {
  throw new Error('Malformed overnight risk thresholds must fall back to canonical defaults.');
}

const stock = buildUniverse()[0];
if (!stock) {
  throw new Error('Prototype universe must provide a stock fixture.');
}
const defaultSizedPosition = buildMorningPositionFromStock(stock, DEFAULT_STRATEGY_SETTINGS);
if (defaultSizedPosition.lots !== DEFAULT_RESEARCH_POSITION_LOTS) {
  throw new Error('Strategy-generated journal positions must use the centralized default position size.');
}

console.log(
  `Execution-policy smoke passed: canonical friction is ${canonicalFriction.toFixed(2)}%, overnight risk/exit thresholds are centralized, and default research size is ${DEFAULT_RESEARCH_POSITION_LOTS} lots.`,
);
