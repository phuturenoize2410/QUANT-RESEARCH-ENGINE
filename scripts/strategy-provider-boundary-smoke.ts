import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const engineRoot = join(repoRoot, 'src', 'engine');
const strategyRoots = [join(engineRoot, 'strategy'), join(engineRoot, 'strategies')];

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

function normalizeModuleSpecifier(specifier: string): string {
  return specifier.replaceAll('\\', '/').split(/[?#]/, 1)[0].replace(/\.(?:[cm]?[jt]sx?)$/i, '');
}

function hasModuleSegment(specifier: string, segment: string): boolean {
  return normalizeModuleSpecifier(specifier).split('/').includes(segment);
}

function isConcreteProviderNamespaceImport(specifier: string): boolean {
  const segments = normalizeModuleSpecifier(specifier).split('/').filter(Boolean);
  return segments.some(segment => /^provider$/i.test(segment));
}

/**
 * Strategy Engine must consume feature/strategy contracts, never provider machinery
 * or provider-neutral raw contracts directly. This keeps the enforced direction:
 * DataProvider -> Feature Engine -> Strategy Engine -> Risk/Execution -> Application/UI.
 * Future nested provider adapters (for example provider/googleFinance/* or provider/idx/*)
 * are default-denied as well, so reorganizing adapters cannot bypass this boundary.
 * Discovery must also fail closed: an empty strategy surface must never turn this gate
 * into a silently passing no-op after a future directory/layout refactor.
 */
const forbiddenProviderModules = new Set([
  'dataProviders',
  'providerContracts',
  'providerPolicy',
  'providerGate',
  'providerCache',
  'providerHealth',
  'providerHealthPolicy',
  'providerBars',
  'providerQuote',
]);

const strategyFiles = [...new Set(strategyRoots.flatMap(collectTypeScriptFiles))].sort();
if (strategyFiles.length === 0) {
  throw new Error('Strategy/provider boundary gate discovered no strategy surfaces; fail closed rather than silently skipping enforcement.');
}

const violations: string[] = [];
for (const file of strategyFiles) {
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
    const isProviderImport = isConcreteProviderNamespaceImport(specifier)
      || [...forbiddenProviderModules].some(moduleName => hasModuleSegment(specifier, moduleName));
    if (isProviderImport) {
      violations.push(`${filePath} imports ${specifier}; Strategy Engine must consume Feature Engine outputs/contracts rather than provider modules.`);
    }
  }
}

if (violations.length > 0) throw new Error(`Strategy/provider boundary violations:\n- ${violations.join('\n- ')}`);
console.log(`Strategy/provider boundary smoke passed: ${strategyFiles.length} discovered strategy surface(s) are default-denied from provider modules, including future nested provider adapter namespaces, and must consume feature-layer evidence instead.`);
