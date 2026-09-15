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
  return name === 'dataProviders.ts' || /^provider.*\.ts$/i.test(name);
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

/** React is terminal presentation. Risk and execution are both explicitly blocked
 * here so a new UI surface cannot bypass the application boundary by importing
 * risk sizing/policy directly while execution remains protected. */
const uiForbiddenBoundaries = [
  '/engine/dataProviders', '/engine/providerPolicy', '/engine/providerGate', '/engine/providerCache', '/engine/providerHealth',
  '/engine/featureContext', '/engine/featureProvenance', '/engine/analytics', '/engine/risk', '/engine/execution',
  '/engine/scorePolicy', '/engine/strategies/', '/engine/strategy/', '/engine/researchApplication', '/engine/ml/',
  '/engine/quantLabEngine', '/data/mockStocks',
];

const legacyUiBoundaryExceptions = new Map<string, Set<string>>([
  ['src/components/MLLabView.tsx', new Set(['../engine/ml/featureStore', '../engine/ml/models', '../engine/ml/ensembleRouter', '../engine/ml/modelRegistry'])],
]);

const providerForbiddenBoundaries = ['strategyTypes', '/strategies/', '/strategy/', './strategies/', './strategy/', '/risk', './risk', '/execution', './execution', '/components/', '/data/mockStocks'];
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
      violations.push(`${relative(repoRoot, file)} imports ${specifier}; UI must consume provider-backed data and decision-model outputs through the application/pipeline boundary.`);
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
  for (const specifier of importSpecifiers(source)) if (providerForbiddenBoundaries.some(boundary => specifier.includes(boundary))) violations.push(`${relative(repoRoot, file)} imports ${specifier}; DataProvider infrastructure must remain upstream of Strategy/Risk/Execution and independent from UI/mock-universe implementations.`);
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
  for (const specifier of importSpecifiers(source)) if (specifier.includes('/components/') || specifier.endsWith('/App') || specifier.endsWith('/App.tsx')) violations.push(`${relative(repoRoot, file)} imports ${specifier}; engine layers must remain independent from React/UI.`);
}

if (violations.length > 0) throw new Error(`Architecture boundary violations:\n- ${violations.join('\n- ')}`);
console.log(`Architecture-boundary smoke passed: UI cannot bypass provider/feature/strategy/risk-execution/application boundaries or add new direct quant-core imports; all ML engine modules are UI-forbidden by default; FinalDecisionModal and QuantLabView have no engine exceptions; remaining MLLab legacy UI exceptions are exact and non-stale; ${providerRoots.length} provider modules remain upstream of Strategy/Risk/Execution; ${featureRoots.length} feature modules remain upstream of Strategy/Risk/Execution; ${strategyRoots.length} strategy modules remain upstream of Risk/Execution; ${riskExecutionRoots.length} Risk/Execution modules cannot bypass into providers/features/UI/mock data; and engine code remains UI-independent.`);
