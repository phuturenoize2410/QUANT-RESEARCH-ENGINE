import {
  DEFAULT_EXECUTION_COSTS,
  netReturnAfterCosts,
  normalizeExecutionCosts,
  totalFrictionPct,
} from '../src/engine/executionPolicy';
import { estimateOvernightExecution } from '../src/engine/execution';

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

console.log(
  `Execution-policy smoke passed: canonical friction is ${canonicalFriction.toFixed(2)}% and malformed inputs safely normalize to defaults.`,
);
