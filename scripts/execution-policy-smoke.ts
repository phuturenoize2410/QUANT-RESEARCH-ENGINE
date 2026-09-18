import {
  DEFAULT_EXECUTION_COSTS,
  DEFAULT_OVERNIGHT_EXIT_POLICY,
  DEFAULT_RESEARCH_POSITION_LOTS,
  EXECUTION_POLICY_PERCENT_MAX,
  calculateExecutionFriction,
  deriveOvernightExitDecision,
  executionCostsFromSettings,
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

if (!Object.isFrozen(malformed)) {
  throw new Error('Normalized execution-cost snapshots must be immutable after policy validation.');
}

const outOfDomainCosts = normalizeExecutionCosts({
  buyFeePct: EXECUTION_POLICY_PERCENT_MAX + 0.01,
  sellFeePct: 10_000,
  slippagePct: EXECUTION_POLICY_PERCENT_MAX,
});
if (
  outOfDomainCosts.buyFeePct !== DEFAULT_EXECUTION_COSTS.buyFeePct ||
  outOfDomainCosts.sellFeePct !== DEFAULT_EXECUTION_COSTS.sellFeePct ||
  outOfDomainCosts.slippagePct !== EXECUTION_POLICY_PERCENT_MAX
) {
  throw new Error('Execution-cost percentages must stay inside the canonical 0-100 domain.');
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

// Lock the monetary execution path to the same canonical calculator. This
// catches a future regression where execution.ts reintroduces fee/slippage math
// that drifts from backtest/Risk policy assumptions.
const shares = 100 * 100;
const buyNotional = 10_000 * shares;
const sellNotional = 10_000 * (1 + grossReturnPct / 100) * shares;
const grossProfit = sellNotional - buyNotional;
const canonicalMonetaryFriction = calculateExecutionFriction(
  buyNotional,
  sellNotional,
  grossProfit,
  DEFAULT_EXECUTION_COSTS,
);

if (!Object.isFrozen(canonicalMonetaryFriction)) {
  throw new Error('Canonical monetary friction evidence must be immutable.');
}

if (Math.abs(estimate.netProfitIDR - canonicalMonetaryFriction.netProfit) > 1e-6) {
  throw new Error('Execution estimate net profit must come from the canonical monetary friction calculator.');
}

if (Math.abs(canonicalMonetaryFriction.totalFriction - (
  canonicalMonetaryFriction.buyFee +
  canonicalMonetaryFriction.sellFee +
  canonicalMonetaryFriction.slippage
)) > 1e-6) {
  throw new Error('Canonical monetary friction must reconcile buy fee + sell fee + slippage exactly.');
}

const takeProfitDecision = deriveOvernightExitDecision(10_000, DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitGapPct);
if (
  takeProfitDecision.exitStatus !== 'TAKE PROFIT' ||
  takeProfitDecision.takeProfitLevel !== 10_150 ||
  takeProfitDecision.cutLossLevel !== 9_850
) {
  throw new Error('Canonical overnight exit policy must own take-profit and stop-loss decisions.');
}

if (!Object.isFrozen(takeProfitDecision)) {
  throw new Error('Derived overnight exit decisions must be immutable Risk/Execution evidence.');
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

if (!Object.isFrozen(malformedExitPolicy)) {
  throw new Error('Normalized overnight exit-policy snapshots must be immutable after validation.');
}

const outOfDomainExitPolicy = normalizeOvernightExitPolicy({
  stopLossPct: EXECUTION_POLICY_PERCENT_MAX + 1,
  takeProfitPct: 1_000,
  takeProfitGapPct: EXECUTION_POLICY_PERCENT_MAX,
  cutLossGapPct: EXECUTION_POLICY_PERCENT_MAX + 0.01,
});
if (
  outOfDomainExitPolicy.stopLossPct !== DEFAULT_OVERNIGHT_EXIT_POLICY.stopLossPct ||
  outOfDomainExitPolicy.takeProfitPct !== DEFAULT_OVERNIGHT_EXIT_POLICY.takeProfitPct ||
  outOfDomainExitPolicy.takeProfitGapPct !== EXECUTION_POLICY_PERCENT_MAX ||
  outOfDomainExitPolicy.cutLossGapPct !== DEFAULT_OVERNIGHT_EXIT_POLICY.cutLossGapPct
) {
  throw new Error('Overnight risk percentages must stay inside the canonical 0-100 domain.');
}

const stock = buildUniverse()[0];
if (!stock) {
  throw new Error('Prototype universe must provide a stock fixture.');
}
const defaultSizedPosition = buildMorningPositionFromStock(stock, DEFAULT_STRATEGY_SETTINGS);
if (defaultSizedPosition.lots !== DEFAULT_RESEARCH_POSITION_LOTS) {
  throw new Error('Strategy-generated journal positions must use the centralized default position size.');
}

// Mock research economics must remain aligned with the same Risk/Execution
// transaction-cost contract used by execution and future backtests. Use
// deliberately non-default assumptions so a stale hard-coded 0.50% hurdle is
// caught immediately.
const customSettings = {
  ...DEFAULT_STRATEGY_SETTINGS,
  buyFeePct: 0.11,
  sellFeePct: 0.19,
  slippagePct: 0.07,
};
const customCosts = executionCostsFromSettings(customSettings);
const customFriction = totalFrictionPct(customCosts);
const customStock = buildUniverse(customSettings)[0];
if (!customStock) {
  throw new Error('Prototype universe must provide a custom-cost stock fixture.');
}

if (!Object.isFrozen(customCosts)) {
  throw new Error('Execution costs projected from strategy settings must remain immutable.');
}

const expectedMockNetGap = Math.round(
  netReturnAfterCosts(customStock.expectedGrossGap, customCosts) * 100,
) / 100;

if (customStock.estimatedFee !== Math.round(customFriction * 100) / 100) {
  throw new Error('Mock universe estimatedFee must follow the centralized execution-cost contract.');
}

if (customStock.expectedNetGap !== expectedMockNetGap) {
  throw new Error('Mock universe expectedNetGap must deduct costs through the canonical Risk/Execution economics contract.');
}

console.log(
  `Execution-policy smoke passed: canonical friction is ${canonicalFriction.toFixed(2)}%, monetary execution reconciles through the canonical calculator, percentage inputs are bounded to 0-${EXECUTION_POLICY_PERCENT_MAX}%, normalized policy snapshots are immutable, custom mock friction is ${customFriction.toFixed(2)}%, overnight risk/exit thresholds are centralized, and default research size is ${DEFAULT_RESEARCH_POSITION_LOTS} lots.`,
);
