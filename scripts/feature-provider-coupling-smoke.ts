import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const engineRoot = join(repoRoot, 'src', 'engine');

function collectTypeScriptFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return /\.(ts|tsx)$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap(entry => collectTypeScriptFiles(join(path, entry)));
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
    .map(match => match[1]);
}

const featureFiles = collectTypeScriptFiles(engineRoot).filter(file => {
  const normalized = file.replaceAll('\\', '/');
  const name = basename(file);
  return /^feature.*\.ts$/i.test(name) || normalized.endsWith('/ml/featureStore.ts');
});

/**
 * Feature code may consume provider evidence, but it should not be coupled to
 * the concrete provider implementation module. Two pre-existing type-only
 * dependencies remain while provider contracts are extracted from
 * dataProviders.ts. Lock them as explicit migration debt so future Google
 * Finance/free/paid adapters cannot spread concrete-provider coupling into the
 * Feature Engine.
 */
const legacyConcreteProviderImports = new Set([
  'src/engine/featureContext.ts::./dataProviders',
  'src/engine/featureProvenance.ts::./dataProviders',
]);
const LEGACY_FEATURE_PROVIDER_COUPLING_BUDGET = 2;

const violations: string[] = [];
const observedLegacyDebt = new Set<string>();

for (const file of featureFiles) {
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
    const isConcreteProviderImport =
      specifier.includes('dataProviders') ||
      specifier.includes('providerPolicy') ||
      specifier.includes('providerGate') ||
      specifier.includes('providerCache') ||
      specifier.includes('providerHealth');

    if (!isConcreteProviderImport) continue;

    const key = `${filePath}::${specifier}`;
    if (legacyConcreteProviderImports.has(key)) {
      observedLegacyDebt.add(key);
      continue;
    }

    violations.push(
      `${filePath} imports ${specifier}; Feature Engine must consume provider-neutral contracts/evidence instead of concrete provider infrastructure.`,
    );
  }
}

if (legacyConcreteProviderImports.size !== LEGACY_FEATURE_PROVIDER_COUPLING_BUDGET) {
  violations.push(
    `Declared Feature -> concrete-provider migration debt is ${legacyConcreteProviderImports.size}, but the ratchet budget is ${LEGACY_FEATURE_PROVIDER_COUPLING_BUDGET}. Reduce both together; the budget may never be raised.`,
  );
}

for (const key of legacyConcreteProviderImports) {
  if (!observedLegacyDebt.has(key)) {
    violations.push(
      `${key} is a stale migration exception. Remove it and lower LEGACY_FEATURE_PROVIDER_COUPLING_BUDGET in the same change.`,
    );
  }
}

if (violations.length > 0) {
  throw new Error(`Feature/provider coupling violations:\n- ${violations.join('\n- ')}`);
}

console.log(
  `Feature/provider coupling smoke passed: concrete provider infrastructure is default-denied from Feature Engine; ${observedLegacyDebt.size} pre-existing type dependency/dependencies remain explicit migration debt and may only shrink.`,
);
