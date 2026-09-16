import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const srcRoot = join(repoRoot, 'src');
const uiRoots = [join(srcRoot, 'App.tsx'), join(srcRoot, 'components')];
const engineRoot = join(srcRoot, 'engine');

function collectTypeScriptFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return /\.(ts|tsx)$/.test(path) ? [path] : [];

  return readdirSync(path).flatMap(entry => collectTypeScriptFiles(join(path, entry)));
}

const providerRoots = collectTypeScriptFiles(engineRoot).filter(file => {
  const name = basename(file);
  // Provider adapters are allowed to be vendor-named (for example
  // googleFinanceProvider.ts or idxFeedProvider.ts). Match "provider" anywhere in
  // the filename so future free/paid adapters cannot silently escape the upstream
  // DataProvider dependency guard merely because their filename does not start
  // with "provider".
  return name === 'dataProviders.ts' || /provider.*\.ts$/i.test(name);
});

const featureRoots = collectTypeScriptFiles(engineRoot).filter(file => {
  const normalized = file.replaceAll('\\', '/');
  const name = basename(file);
  return /^feature.*\.ts$/i.test(name) || normalized.endsWith('/ml/featureStore.ts');
});

const strategyRoots = collectTypeScriptFiles(engineRoot).filter(file => {
  const normalized = file.replaceAll('\\', '/');
  const name = basename(file);
  return name === 'strategyTypes.ts' || normalized.includes('/engine/strategies/') || normalized.includes('/engine/strategy/');
});

const riskExecutionRoots = collectTypeScriptFiles(engineRoot).filter(file => {
  const normalized = file.replaceAll('\\', '/');
  const name = basename(file);
  return /^(?:risk|execution).*\.ts$/i.test(name) || normalized.includes('/engine/risk/') || normalized.includes('/engine/execution/');
});

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(match => match[1]);
}

/**
 * React is terminal presentation. Default-deny every engine import rather than
 * maintaining a filename allow/deny list that new quant-core modules can silently
 * escape. Presentation consumes application facades and passive shared DTOs only.
 * The exact legacy ML Lab exceptions below are temporary migration debt and must
 * remain exercised so they cannot become reusable bypasses.
 */
const uiForbiddenBoundaries = ['/engine/', '/data/mockStocks'];

const legacyUiBoundaryExceptions = new Map<string, Set<string>>([
  ['src/components/MLLabView.tsx', new Set(['../engine/ml/featureStore', '../engine/ml/models', '../engine/ml/ensembleRouter', '../engine/ml/modelRegistry'])],
]);

// DataProvider is the first executable layer. It may publish canonical provider
// contracts, but it must never reach downstream into Feature/Strategy/Risk/Execution.
// Keeping this direction explicit prevents a future Google Finance, IDX feed or
// broker adapter from quietly embedding indicators or signal logic in ingestion.
const providerForbiddenBoundaries = ['/featureContext', './featureContext', '/featureProvenance', './featureProvenance', '/ml/featureStore', './ml/featureStore', 'strategyTypes', '/strategies/', '/strategy/', './strategies/', './strategy/', '/risk', './risk', '/execution', './execution', '/components/', '/data/mockStocks'];
const featureForbiddenBoundaries = ['strategyTypes', '/strategies/', '/strategy/', './strategies/', './strategy/', '/risk', './risk', '/execution', './execution', '/components/', '/data/mockStocks'];
const strategyForbiddenBoundaries = ['/dataProviders', './dataProviders', '/providerPolicy', './providerPolicy', '/providerGate', './providerGate', '/providerCache', './providerCache', '/providerHealth', './providerHealth', '/risk', './risk', '/execution', './execution', '/components/', '/data/mockStocks'];
const riskExecutionForbiddenBoundaries = ['/dataProviders', './dataProviders', '/providerPolicy', './providerPolicy', '/providerGate', './providerGate', '/providerCache', './providerCache', '/providerHealth', './providerHealth', '/featureContext', './featureContext', '/featureProvenance', './featureProvenance', '/ml/featureStore', './ml/featureStore', '/components/', '/data/mockStocks'];

const violations: string[] = [];
const exercisedLegacyUiExceptions = new Set<string>();

for (const file of uiRoots.flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(file, 'utf8');
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  const exceptions = legacyUiBoundaryExceptions.get(filePath) ?? new Set<string>();
  for (const specifier of importSpecifiers(source)) {
    const exceptionKey = `${filePath}::${specifier}`;
    if (exceptions.has(specifier)) exercisedLegacyUiExceptions.add(exceptionKey);
    if (uiForbiddenBoundaries.some(boundary => specifier.includes(boundary)) && !exceptions.has(specifier)) {
      violations.push(`${relative(repoRoot, file)} imports ${specifier}; UI must consume quant-core behavior through the application boundary instead of importing engine modules directly.`);
    }
  }
}

for (const [filePath, exceptions] of legacyUiBoundaryExceptions) {
  for (const specifier of exceptions) {
    const exceptionKey = `${filePath}::${specifier}`;
    if (!exercisedLegacyUiExceptions.has(exceptionKey)) violations.push(`${filePath} retains unused legacy exception ${specifier}; remove stale UI boundary exceptions as soon as the direct import is migrated.`);
  }
}

for (const file of providerRoots) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) if (providerForbiddenBoundaries.some(boundary => specifier.includes(boundary))) violations.push(`${relative(repoRoot, file)} imports ${specifier}; DataProvider infrastructure must remain the first executable layer, independent from Feature/Strategy/Risk/Execution and UI/mock-universe implementations.`);
}
for (const file of featureRoots) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) if (featureForbiddenBoundaries.some(boundary => specifier.includes(boundary))) violations.push(`${relative(repoRoot, file)} imports ${specifier}; Feature Engine must remain upstream of Strategy/Risk/Execution and independent from UI/mock-universe implementations.`);
}
for (const file of strategyRoots) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) if (strategyForbiddenBoundaries.some(boundary => specifier.includes(boundary))) violations.push(`${relative(repoRoot, file)} imports ${specifier}; Strategy Engine must consume canonical feature/domain contracts instead of reaching into providers, Risk/Execution, UI or mock-universe implementations.`);
}
for (const file of riskExecutionRoots) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) if (riskExecutionForbiddenBoundaries.some(boundary => specifier.includes(boundary))) violations.push(`${relative(repoRoot, file)} imports ${specifier}; Risk/Execution must consume downstream strategy/domain contracts instead of bypassing the pipeline into providers, feature implementations, UI or mock-universe data.`);
}
for (const file of collectTypeScriptFiles(engineRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (specifier.includes('/components/') || specifier.endsWith('/App') || specifier.endsWith('/App.tsx')) violations.push(`${relative(repoRoot, file)} imports ${specifier}; engine layers must remain independent from React/UI.`);
    if (specifier.includes('/application/') || specifier.endsWith('/application')) violations.push(`${relative(repoRoot, file)} imports ${specifier}; engine layers must remain below the application orchestration boundary and cannot depend on application facades.`);
  }
}

if (violations.length > 0) throw new Error(`Architecture boundary violations:\n- ${violations.join('\n- ')}`);
console.log(`Architecture-boundary smoke passed: UI default-denies all direct engine imports except exact, exercised ML Lab migration debt; UI cannot import mock universe data; ${providerRoots.length} provider modules remain the first executable layer and independent from Feature/Strategy/Risk/Execution; ${featureRoots.length} feature modules remain upstream of Strategy/Risk/Execution; ${strategyRoots.length} strategy modules remain upstream of Risk/Execution; ${riskExecutionRoots.length} Risk/Execution modules cannot bypass into providers/features/UI/mock data; engine code cannot invert the dependency into application orchestration; and engine code remains UI-independent.`);