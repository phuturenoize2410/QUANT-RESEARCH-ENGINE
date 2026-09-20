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
const featureFiles = collectTypeScriptFiles(engineRoot).filter(file => { const normalized = file.replaceAll('\\', '/'); const name = basename(file); return /^feature.*\.ts$/i.test(name) || normalized.endsWith('/ml/featureStore.ts'); });

/**
 * Feature Engine may consume provider-neutral evidence from providerContracts,
 * but concrete provider implementation/policy/health/cache modules are now fully
 * default-denied. Migration debt reached zero and must stay at zero.
 */
const violations: string[] = [];
for (const file of featureFiles) {
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
    const isConcreteProviderImport = specifier.includes('dataProviders') || specifier.includes('providerPolicy') || specifier.includes('providerGate') || specifier.includes('providerCache') || specifier.includes('providerHealth');
    if (isConcreteProviderImport) violations.push(`${filePath} imports ${specifier}; Feature Engine must consume provider-neutral contracts/evidence instead of concrete provider infrastructure.`);
  }
}
if (violations.length > 0) throw new Error(`Feature/provider coupling violations:\n- ${violations.join('\n- ')}`);
console.log('Feature/provider coupling smoke passed: static, dynamic and require-based concrete provider infrastructure is default-denied from Feature Engine; migration debt is zero.');
