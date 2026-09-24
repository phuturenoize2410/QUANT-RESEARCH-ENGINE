import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const engineRoot = join(repoRoot, 'src', 'engine');
function collectTypeScriptFiles(path: string): string[] { const stat = statSync(path); if (stat.isFile()) return /\.(ts|tsx)$/.test(path) ? [path] : []; return readdirSync(path).flatMap(entry => collectTypeScriptFiles(join(path, entry))); }
function importSpecifiers(source: string): string[] {
  const staticSpecifiers = [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(match => match[1]);
  const dynamicSpecifiers = [...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
  const requireSpecifiers = [...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
  return [...new Set([...staticSpecifiers, ...dynamicSpecifiers, ...requireSpecifiers])];
}
function normalizeModuleSpecifier(specifier: string): string {
  return specifier
    .replaceAll('\\', '/')
    .split(/[?#]/, 1)[0]
    .replace(/\.(?:[cm]?[jt]sx?)$/i, '');
}
function hasModuleSegment(specifier: string, segment: string): boolean {
  return normalizeModuleSpecifier(specifier).split('/').includes(segment);
}
function isConcreteProviderNamespaceImport(specifier: string): boolean {
  const segments = normalizeModuleSpecifier(specifier).split('/').filter(Boolean);
  return segments.some(segment => /^provider$/i.test(segment));
}
const featureFiles = [...new Set(collectTypeScriptFiles(engineRoot).filter(file => {
  const normalized = file.replaceAll('\\', '/');
  const name = basename(file);
  return /^feature.*\.tsx?$/i.test(name) || normalized.endsWith('/ml/featureStore.ts');
}))].sort();

if (featureFiles.length === 0) {
  throw new Error('Feature/provider coupling gate discovered zero Feature Engine surfaces; fail closed so a future layout/refactor cannot silently disable provider-isolation enforcement.');
}

/**
 * Feature Engine may consume provider-neutral evidence from providerContracts,
 * but concrete provider implementation/policy/health/cache modules are fully
 * default-denied. This includes future nested adapter namespaces such as
 * engine/provider/googleFinance/* or engine/provider/idx/*; reorganizing an
 * adapter must never create a coupling escape hatch. Migration debt is zero.
 */
const forbiddenProviderModules = new Set([
  'dataProviders',
  'providerPolicy',
  'providerGate',
  'providerCache',
  'providerHealth',
  'providerHealthPolicy',
]);
const violations: string[] = [];
for (const file of featureFiles) {
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
    const isConcreteProviderImport = isConcreteProviderNamespaceImport(specifier)
      || [...forbiddenProviderModules].some(moduleName => hasModuleSegment(specifier, moduleName));
    if (isConcreteProviderImport) violations.push(`${filePath} imports ${specifier}; Feature Engine must consume provider-neutral contracts/evidence instead of concrete provider infrastructure.`);
  }
}
if (violations.length > 0) throw new Error(`Feature/provider coupling violations:\n- ${violations.join('\n- ')}`);
console.log(`Feature/provider coupling smoke passed across ${featureFiles.length} discovered Feature Engine surface(s): normalized static, dynamic and require-based concrete provider infrastructure, including future nested provider adapter namespaces, is default-denied; migration debt is zero.`);
