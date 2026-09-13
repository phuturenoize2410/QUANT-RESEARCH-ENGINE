import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const srcRoot = join(repoRoot, 'src');
const uiRoots = [join(srcRoot, 'App.tsx'), join(srcRoot, 'components')];

function collectTypeScriptFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return /\.(ts|tsx)$/.test(path) ? [path] : [];

  return readdirSync(path).flatMap(entry => collectTypeScriptFiles(join(path, entry)));
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
    .map(match => match[1]);
}

/**
 * UI may render canonical application outputs, but it must not execute
 * Risk/Execution policy, re-apply canonical score bounds, or depend directly on
 * the concrete research-pipeline contract. Keeping these modules behind the
 * application boundary prevents React surfaces from drifting away from the same
 * provider -> feature -> strategy -> risk/execution flow used by the engine.
 */
function isDirectDecisionPolicyImport(specifier: string): boolean {
  const normalized = specifier.replaceAll('\\', '/');
  return /(?:^|\/)engine\/(?:(?:risk|execution)[^/]*|scorePolicy|researchPipeline)$/i.test(normalized);
}

const violations: string[] = [];

for (const file of uiRoots.flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(file, 'utf8');

  for (const specifier of importSpecifiers(source)) {
    if (isDirectDecisionPolicyImport(specifier)) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; UI must consume provider/pipeline state, bounded scores, and Risk/Execution outputs through the application boundary rather than depending on canonical engine policy directly.`,
      );
    }
  }
}

if (violations.length > 0) {
  throw new Error(`UI application-boundary violations:\n- ${violations.join('\n- ')}`);
}

console.log(
  'UI application-boundary smoke passed: React surfaces cannot directly import researchPipeline, scorePolicy, or risk/execution engine modules and must consume canonical outputs through researchApplication.',
);
