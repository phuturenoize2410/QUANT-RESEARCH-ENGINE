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

/**
 * Exact temporary debt register for presentation files that pre-date the
 * application facade. These entries are intentionally file+specifier specific:
 * they prevent the guard from becoming a broad bypass while allowing migration
 * to proceed incrementally without breaking the current UI.
 *
 * Every exception must be exercised. Once a component is migrated to
 * src/application/researchApplication, its stale entry makes this smoke fail so
 * the debt register cannot silently accumulate obsolete exemptions.
 */
const legacyUiBoundaryExceptions = new Map<string, Set<string>>([
  ['src/components/FinalDecisionModal.tsx', new Set(['../engine/researchApplication'])],
  ['src/components/QuantLabView.tsx', new Set(['../engine/researchApplication'])],
  ['src/components/StrategySettingsModal.tsx', new Set(['../engine/researchApplication'])],
  ['src/components/MorningExitDashboardView.tsx', new Set(['../engine/execution'])],
]);

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
  `UI application-boundary smoke passed: new React surfaces cannot directly import researchPipeline, engine/researchApplication, scorePolicy, or risk/execution modules; ${exercisedLegacyExceptions.size} exact legacy presentation imports remain registered as migration debt; and the application facade exposes an explicit allow-listed contract.`,
);
