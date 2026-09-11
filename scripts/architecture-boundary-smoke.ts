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

/**
 * Treat every provider-prefixed engine module as upstream provider
 * infrastructure automatically. This prevents a newly added provider health,
 * cache, adapter-policy or status helper from silently escaping the architecture
 * guard just because its filename was not manually added to a fixed allowlist.
 */
const providerRoots = collectTypeScriptFiles(engineRoot).filter(file => {
  const name = basename(file);
  return name === 'dataProviders.ts' || /^provider.*\.ts$/i.test(name);
});

/**
 * Feature modules may consume provider contracts/data, but must remain upstream
 * of strategy and risk/execution. Keeping this dependency direction explicit is
 * what lets a future Google Finance, free API or paid IDX adapter feed the same
 * canonical feature layer without strategy-specific provider plumbing.
 */
const featureRoots = collectTypeScriptFiles(engineRoot).filter(file => {
  const normalized = file.replaceAll('\\', '/');
  const name = basename(file);
  return /^feature.*\.ts$/i.test(name) || normalized.endsWith('/ml/featureStore.ts');
});

/**
 * Strategy modules consume canonical features and market-domain contracts. They
 * must not reach backward into provider infrastructure or forward into execution,
 * otherwise the DataProvider -> Feature -> Strategy -> Risk/Execution spine can
 * silently collapse as new strategies are added.
 */
const strategyRoots = collectTypeScriptFiles(engineRoot).filter(file => {
  const normalized = file.replaceAll('\\', '/');
  const name = basename(file);
  return (
    name === 'strategyTypes.ts' ||
    normalized.includes('/engine/strategies/') ||
    normalized.includes('/engine/strategy/')
  );
});

/**
 * Risk/Execution is downstream of Strategy and may consume strategy/domain
 * outputs, but it must not bypass the spine by reaching directly into provider
 * infrastructure, feature implementations, UI, or mock-universe data.
 */
const riskExecutionRoots = collectTypeScriptFiles(engineRoot).filter(file => {
  const name = basename(file);
  return /^(?:risk|execution).*\.ts$/i.test(name);
});

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
    .map(match => match[1]);
}

const uiForbiddenBoundaries = [
  '/engine/dataProviders',
  '/engine/providerPolicy',
  '/engine/providerGate',
  '/engine/providerCache',
  '/engine/providerHealth',
  '/engine/ml/',
  '/data/mockStocks',
];

/**
 * Temporary debt register for direct UI -> model-engine imports that pre-date
 * the application boundary. Keeping this list exact means no other component can
 * introduce a new ML/model bypass while FinalDecisionModal is migrated to the
 * already-available ResearchApplicationService decision DTO.
 *
 * Delete these entries as soon as that modal consumes DecisionCandidateEvaluation.
 */
const legacyUiBoundaryExceptions = new Map<string, Set<string>>([
  [
    'src/components/FinalDecisionModal.tsx',
    new Set([
      '../engine/ml/ensembleRouter',
      '../engine/ml/models',
    ]),
  ],
]);

const providerForbiddenBoundaries = [
  'strategyTypes',
  '/strategies/',
  '/strategy/',
  './strategies/',
  './strategy/',
  '/execution',
  './execution',
  '/components/',
  '/data/mockStocks',
];

const featureForbiddenBoundaries = [
  'strategyTypes',
  '/strategies/',
  '/strategy/',
  './strategies/',
  './strategy/',
  '/execution',
  './execution',
  '/components/',
  '/data/mockStocks',
];

const strategyForbiddenBoundaries = [
  '/dataProviders',
  './dataProviders',
  '/providerPolicy',
  './providerPolicy',
  '/providerGate',
  './providerGate',
  '/providerCache',
  './providerCache',
  '/providerHealth',
  './providerHealth',
  '/execution',
  './execution',
  '/components/',
  '/data/mockStocks',
];

const riskExecutionForbiddenBoundaries = [
  '/dataProviders',
  './dataProviders',
  '/providerPolicy',
  './providerPolicy',
  '/providerGate',
  './providerGate',
  '/providerCache',
  './providerCache',
  '/providerHealth',
  './providerHealth',
  '/featureContext',
  './featureContext',
  '/featureProvenance',
  './featureProvenance',
  '/ml/featureStore',
  './ml/featureStore',
  '/components/',
  '/data/mockStocks',
];

const violations: string[] = [];

for (const file of uiRoots.flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(file, 'utf8');
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  const exceptions = legacyUiBoundaryExceptions.get(filePath) ?? new Set<string>();

  for (const specifier of importSpecifiers(source)) {
    if (
      uiForbiddenBoundaries.some(boundary => specifier.includes(boundary)) &&
      !exceptions.has(specifier)
    ) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; UI must consume provider-backed data and model outputs through the application/pipeline boundary.`,
      );
    }
  }
}

for (const file of providerRoots) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (providerForbiddenBoundaries.some(boundary => specifier.includes(boundary))) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; DataProvider infrastructure must remain upstream of Strategy/Risk/Execution and independent from UI/mock-universe implementations.`,
      );
    }
  }
}

for (const file of featureRoots) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (featureForbiddenBoundaries.some(boundary => specifier.includes(boundary))) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; Feature Engine must remain upstream of Strategy/Risk/Execution and independent from UI/mock-universe implementations.`,
      );
    }
  }
}

for (const file of strategyRoots) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (strategyForbiddenBoundaries.some(boundary => specifier.includes(boundary))) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; Strategy Engine must consume canonical feature/domain contracts instead of reaching into providers, Risk/Execution, UI or mock-universe implementations.`,
      );
    }
  }
}

for (const file of riskExecutionRoots) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (riskExecutionForbiddenBoundaries.some(boundary => specifier.includes(boundary))) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; Risk/Execution must consume downstream strategy/domain contracts instead of bypassing the pipeline into providers, feature implementations, UI or mock-universe data.`,
      );
    }
  }
}

for (const file of collectTypeScriptFiles(engineRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (specifier.includes('/components/') || specifier.endsWith('/App') || specifier.endsWith('/App.tsx')) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; engine layers must remain independent from React/UI.`,
      );
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Architecture boundary violations:\n- ${violations.join('\n- ')}`);
}

console.log(
  `Architecture-boundary smoke passed: UI cannot bypass provider/application boundaries or add new direct ML/model imports; ${providerRoots.length} provider modules remain upstream; ${featureRoots.length} feature modules remain upstream of Strategy/Risk/Execution; ${strategyRoots.length} strategy modules remain upstream of Risk/Execution; ${riskExecutionRoots.length} Risk/Execution modules cannot bypass into providers/features/UI/mock data; and engine code remains UI-independent.`,
);
