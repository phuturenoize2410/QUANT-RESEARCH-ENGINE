import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const srcRoot = join(repoRoot, 'src');
const canonicalPolicy = 'src/engine/executionPolicy.ts';

function collectTypeScriptFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return /\.(ts|tsx)$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap(entry => collectTypeScriptFiles(join(path, entry)));
}

// Fee/slippage values may be supplied dynamically through settings, but numeric
// defaults/assumptions must have exactly one owner. This prevents a UI, strategy,
// backtest or future provider adapter from silently creating a second execution-
// cost truth that diverges from executionPolicy.ts.
const numericCostAssignment = /\b(buyFeePct|sellFeePct|slippagePct)\s*:\s*(-?\d+(?:\.\d+)?)(?![\w.])/g;
const violations: string[] = [];

for (const file of collectTypeScriptFiles(srcRoot)) {
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  if (filePath === canonicalPolicy) continue;

  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(numericCostAssignment)) {
    violations.push(
      `${filePath} hardcodes ${match[1]}: ${match[2]}; execution-cost defaults belong only in ${canonicalPolicy}. Consume DEFAULT_EXECUTION_COSTS, normalizeExecutionCosts, executionCostsFromSettings, totalFrictionPct, netReturnAfterCosts, or calculateExecutionFriction instead.`,
    );
  }
}

if (violations.length > 0) {
  throw new Error(`Execution-cost ownership violations:\n- ${violations.join('\n- ')}`);
}

console.log(
  `Execution-cost ownership smoke passed: numeric buy-fee, sell-fee and slippage assumptions have one canonical owner in ${canonicalPolicy}; UI/strategy/backtest/provider code cannot introduce duplicate hardcoded cost defaults.`,
);
