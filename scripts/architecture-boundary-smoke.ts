import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const srcRoot = join(repoRoot, 'src');
const uiRoots = [join(srcRoot, 'App.tsx'), join(srcRoot, 'components')];
const engineRoot = join(srcRoot, 'engine');
const providerRoots = [
  join(engineRoot, 'dataProviders.ts'),
  join(engineRoot, 'providerPolicy.ts'),
  join(engineRoot, 'providerGate.ts'),
  join(engineRoot, 'providerCache.ts'),
];

function collectTypeScriptFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return /\.(ts|tsx)$/.test(path) ? [path] : [];

  return readdirSync(path).flatMap(entry => collectTypeScriptFiles(join(path, entry)));
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
    .map(match => match[1]);
}

const uiForbiddenBoundaries = [
  '/engine/dataProviders',
  '/engine/providerPolicy',
  '/engine/providerGate',
  '/engine/providerCache',
  '/data/mockStocks',
];

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

const violations: string[] = [];

for (const file of uiRoots.flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (uiForbiddenBoundaries.some(boundary => specifier.includes(boundary))) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; UI must consume provider-backed data through the application/pipeline boundary.`,
      );
    }
  }
}

for (const file of providerRoots.flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (providerForbiddenBoundaries.some(boundary => specifier.includes(boundary))) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; DataProvider infrastructure must remain upstream of Strategy/Risk/Execution and independent from UI/mock-universe implementations.`,
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
  'Architecture-boundary smoke passed: UI cannot bypass the application boundary, provider infrastructure stays upstream of Strategy/Risk/Execution, and engine code remains UI-independent.',
);
