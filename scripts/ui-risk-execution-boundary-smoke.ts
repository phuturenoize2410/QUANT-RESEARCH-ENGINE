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
  const staticSpecifiers = [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(match => match[1]);
  const dynamicSpecifiers = [...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
  const requireSpecifiers = [...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
  return [...new Set([...staticSpecifiers, ...dynamicSpecifiers, ...requireSpecifiers])];
}

/**
 * UI may render canonical application outputs, but it must not execute
 * Risk/Execution policy, re-apply canonical score bounds, depend directly on the
 * concrete research-pipeline contract, inspect provider adapters/health policy,
 * or bypass the application facade by importing engine implementations directly.
 */
function isDirectDecisionPolicyImport(specifier: string): boolean {
  const normalized = specifier.replaceAll('\\', '/');
  return /(?:^|\/)engine\/(?:(?:risk|execution)[^/]*|scorePolicy|researchPipeline|researchApplication|dataProviders|provider[^/]*)$/i.test(normalized);
}

/**
 * Exact temporary debt register for presentation files that pre-date the
 * application facade. Keep the register even when empty so any future temporary
 * exception remains file+specifier specific and must be retired once migrated.
 */
const legacyUiBoundaryExceptions = new Map<string, Set<string>>();

const violations: string[] = [];
const exercisedLegacyExceptions = new Set<string>();

for (const file of uiRoots.flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(file, 'utf8');
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  const exceptions = legacyUiBoundaryExceptions.get(filePath) ?? new Set<string>();

  for (const specifier of importSpecifiers(source)) {
    const exceptionKey = `${filePath}::${specifier}`;
    if (exceptions.has(specifier)) {
      exercisedLegacyExceptions.add(exceptionKey);
      continue;
    }

    if (isDirectDecisionPolicyImport(specifier)) {
      violations.push(
        `${filePath} imports ${specifier}; UI must consume provider/pipeline state, bounded scores, Risk/Execution outputs, and application orchestration through src/application rather than depending on canonical engine policy directly.`,
      );
    }
  }
}

for (const [filePath, exceptions] of legacyUiBoundaryExceptions) {
  for (const specifier of exceptions) {
    const exceptionKey = `${filePath}::${specifier}`;
    if (!exercisedLegacyExceptions.has(exceptionKey)) {
      violations.push(
        `${filePath} retains unused legacy application-boundary exception ${specifier}; remove the exception once that presentation import is migrated through src/application.`,
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
  `UI application-boundary smoke passed: React surfaces cannot directly import provider adapters/health policy, researchPipeline, engine/researchApplication, scorePolicy, or risk/execution modules through static, dynamic, or CommonJS imports; ${exercisedLegacyExceptions.size} exact legacy presentation imports remain registered as migration debt; and the application facade exposes an explicit allow-listed contract.`,
);
