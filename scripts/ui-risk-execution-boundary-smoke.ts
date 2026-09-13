import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const srcRoot = join(repoRoot, 'src');
const uiRoots = [join(srcRoot, 'App.tsx'), join(srcRoot, 'components')];
const applicationFacade = join(srcRoot, 'application', 'researchApplication.ts');

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
 * Risk/Execution policy, re-apply canonical score bounds, depend directly on the
 * concrete research-pipeline contract, or bypass the application facade by
 * importing the application-service implementation from the engine package.
 */
function isDirectDecisionPolicyImport(specifier: string): boolean {
  const normalized = specifier.replaceAll('\\', '/');
  return /(?:^|\/)engine\/(?:(?:risk|execution)[^/]*|scorePolicy|researchPipeline|researchApplication)$/i.test(normalized);
}

const violations: string[] = [];

for (const file of uiRoots.flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(file, 'utf8');

  for (const specifier of importSpecifiers(source)) {
    if (isDirectDecisionPolicyImport(specifier)) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; UI must consume provider/pipeline state, bounded scores, Risk/Execution outputs, and application orchestration through src/application rather than depending on canonical engine policy directly.`,
      );
    }
  }
}

const facadeSource = readFileSync(applicationFacade, 'utf8');
if (/export\s+\*\s+from\s+['"][^'"]*engine\/researchApplication['"]/i.test(facadeSource)) {
  violations.push(
    `${relative(repoRoot, applicationFacade)} wildcard re-exports engine/researchApplication; the presentation facade must explicitly whitelist its public application contract so new engine symbols cannot leak into UI dependencies.`,
  );
}

if (violations.length > 0) {
  throw new Error(`UI application-boundary violations:\n- ${violations.join('\n- ')}`);
}

console.log(
  'UI application-boundary smoke passed: React surfaces cannot directly import researchPipeline, engine/researchApplication, scorePolicy, or risk/execution modules, and the application facade exposes an explicit allow-listed contract.',
);
