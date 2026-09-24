import assert from 'node:assert/strict';
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
//
// Cover both object-property literals (`buyFeePct: 0.15`) and assignment/default
// forms (`buyFeePct = 0.15`). The latter matters because a consumer could otherwise
// bypass the ownership gate simply by moving the same hardcoded assumption into a
// local variable, function parameter default, or destructuring default.
const numericCostLiteralPatterns: Array<[RegExp, string]> = [
  [
    /\b(buyFeePct|sellFeePct|slippagePct)\s*:\s*(-?\d+(?:\.\d+)?)(?![\w.])/g,
    'numeric property literal',
  ],
  [
    /\b(buyFeePct|sellFeePct|slippagePct)\s*=\s*(-?\d+(?:\.\d+)?)(?![\w.])/g,
    'numeric assignment/default',
  ],
];

const sourceFiles = [...new Set(collectTypeScriptFiles(srcRoot))].sort();
const repoPaths = sourceFiles.map(file => relative(repoRoot, file).replaceAll('\\', '/'));

// This ownership gate must fail closed if a future layout/refactor removes or
// renames the canonical execution-cost policy. Otherwise every consumer would be
// skipped from ownership enforcement while the smoke test still reported PASS.
assert.ok(
  repoPaths.includes(canonicalPolicy),
  `Execution-cost ownership gate could not discover canonical policy ${canonicalPolicy}. Update the gate deliberately if the policy moves; do not silently lose fee/slippage ownership enforcement.`,
);
assert.ok(
  sourceFiles.length > 1,
  'Execution-cost ownership gate discovered no consumer TypeScript surfaces; refusing a silent no-op PASS.',
);

const violations: string[] = [];

for (const file of sourceFiles) {
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  if (filePath === canonicalPolicy) continue;

  const source = readFileSync(file, 'utf8');
  for (const [pattern, label] of numericCostLiteralPatterns) {
    for (const match of source.matchAll(pattern)) {
      violations.push(
        `${filePath} hardcodes ${match[1]} ${label}: ${match[2]}; execution-cost defaults belong only in ${canonicalPolicy}. Consume DEFAULT_EXECUTION_COSTS, normalizeExecutionCosts, executionCostsFromSettings, totalFrictionPct, netReturnAfterCosts, or calculateExecutionFriction instead.`,
      );
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Execution-cost ownership violations:\n- ${violations.join('\n- ')}`);
}

console.log(
  `Execution-cost ownership smoke passed across ${sourceFiles.length - 1} consumer surfaces: numeric buy-fee, sell-fee and slippage assumptions have one canonical owner in ${canonicalPolicy}; UI/strategy/backtest/provider code cannot introduce duplicate hardcoded cost defaults through object literals, assignments, or defaults.`,
);
