import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const architectureSmokePath = resolve(process.cwd(), 'scripts/architecture-boundary-smoke.ts');
const source = readFileSync(architectureSmokePath, 'utf8');

const budgetMatch = source.match(/const LEGACY_UI_ENGINE_IMPORT_DEBT_BUDGET = (\d+);/);
if (!budgetMatch) {
  throw new Error('Architecture debt ratchet cannot find LEGACY_UI_ENGINE_IMPORT_DEBT_BUDGET. Keep the migration budget explicit and reviewable.');
}

const budget = Number(budgetMatch[1]);
const exceptionBlock = source.match(/const legacyUiBoundaryExceptions = new Map<string, Set<string>>\(\[([\s\S]*?)\n\]\);/);
if (!exceptionBlock) {
  throw new Error('Architecture debt ratchet cannot find legacyUiBoundaryExceptions.');
}

const declaredExceptions = [...exceptionBlock[1].matchAll(/new Set\(\[([^\]]*)\]\)/g)]
  .flatMap(match => [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(specifier => specifier[1]));
const uniqueExceptions = new Set(declaredExceptions);

if (uniqueExceptions.size !== declaredExceptions.length) {
  throw new Error('Legacy UI -> engine debt contains duplicate exceptions; each migration dependency must be counted exactly once.');
}

if (declaredExceptions.length !== budget) {
  throw new Error(
    `Legacy UI -> engine debt ratchet is stale: ${declaredExceptions.length} direct imports are declared but the stored budget is ${budget}. When migration removes an exception, lower the budget in the same change; never leave headroom that allows debt to regrow.`,
  );
}

console.log(`Architecture debt ratchet passed: legacy UI -> engine import debt is pinned at ${budget}; any migration that removes debt must lower the stored budget in the same change, so later changes cannot silently regrow it.`);
