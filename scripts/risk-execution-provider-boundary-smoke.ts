import { readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const engineRoot = join(repoRoot, 'src', 'engine');
const riskExecutionFiles = [
  join(engineRoot, 'execution.ts'),
  join(engineRoot, 'executionPolicy.ts'),
  join(engineRoot, 'researchExecutionPolicy.ts'),
];

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

/**
 * Risk/Execution may consume provider-neutral evidence types, but must never reach
 * into concrete provider implementations, acquisition/gating policy, caches, raw
 * bars/quotes, or health orchestration. This preserves the enforced direction:
 * DataProvider -> Feature Engine -> Strategy Engine -> Risk/Execution -> Application/UI.
 */
const forbiddenProviderModules = new Set([
  'dataProviders',
  'providerPolicy',
  'providerGate',
  'providerCache',
  'providerHealth',
  'providerHealthPolicy',
  'providerBars',
  'providerQuote',
]);

const violations: string[] = [];
for (const file of riskExecutionFiles) {
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
    if ([...forbiddenProviderModules].some(moduleName => hasModuleSegment(specifier, moduleName))) {
      violations.push(`${filePath} imports ${specifier}; Risk/Execution must consume upstream evidence/contracts rather than provider machinery.`);
    }
  }
}

// researchExecutionPolicy intentionally consumes ProviderHealth as a type-only,
// provider-neutral evidence contract. Prevent regression back to a concrete provider.
const researchExecutionSource = readFileSync(join(engineRoot, 'researchExecutionPolicy.ts'), 'utf8');
if (!/import\s+type\s*\{[^}]*ProviderHealth[^}]*\}\s+from\s+['"][^'"]*providerContracts['"]/.test(researchExecutionSource)) {
  violations.push(`${basename(join(engineRoot, 'researchExecutionPolicy.ts'))} must source ProviderHealth as a type-only import from providerContracts.`);
}

if (violations.length > 0) throw new Error(`Risk/Execution provider boundary violations:\n- ${violations.join('\n- ')}`);
console.log('Risk/Execution provider boundary smoke passed: execution surfaces are isolated from concrete provider machinery and consume only upstream/provider-neutral evidence contracts.');
