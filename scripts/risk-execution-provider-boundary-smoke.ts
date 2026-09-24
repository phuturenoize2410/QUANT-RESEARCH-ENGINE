import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const engineRoot = join(repoRoot, 'src', 'engine');

function isRiskExecutionSurface(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/');
  const segments = normalized.split('/');
  const filename = segments.at(-1) ?? '';
  const stem = filename.replace(/\.(?:[cm]?[jt]sx?)$/i, '');
  return segments.some(segment => /^(?:risk|execution)$/i.test(segment))
    || /(?:^|[-_.])(?:risk|execution)(?:$|[-_.])/i.test(stem)
    || /(?:risk|execution)(?:Policy|Engine|Service|Manager|Gate)$/i.test(stem);
}

function discoverRiskExecutionFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverRiskExecutionFiles(path));
      continue;
    }
    if (!entry.isFile() || !/\.(?:[cm]?[jt]sx?)$/i.test(entry.name)) continue;
    const relativePath = relative(engineRoot, path);
    if (isRiskExecutionSurface(relativePath)) files.push(path);
  }
  return files.sort();
}

const riskExecutionFiles = discoverRiskExecutionFiles(engineRoot);
if (riskExecutionFiles.length === 0) {
  throw new Error('Risk/Execution provider boundary gate discovered no execution surfaces; fail closed rather than silently skipping enforcement.');
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
 * Risk/Execution may consume provider-neutral evidence contracts and the canonical
 * pure readiness evaluator, but must never reach into concrete provider adapters,
 * acquisition/gating policy, caches, raw bars/quotes, or health orchestration.
 * Future nested provider adapters (for example provider/googleFinance/* or provider/idx/*)
 * are default-denied as well, so reorganizing adapters cannot bypass this boundary.
 * Risk/Execution surfaces are discovered rather than maintained as a fixed allowlist,
 * so adding a new execution engine/service/policy cannot silently escape enforcement.
 * This preserves the enforced direction:
 * DataProvider -> Feature Engine -> Strategy Engine -> Risk/Execution -> Application/UI.
 */
const forbiddenProviderModules = new Set([
  'dataProviders',
  'providerPolicy',
  'providerGate',
  'providerCache',
  'providerHealth',
  'providerBars',
  'providerQuote',
]);

const violations: string[] = [];
for (const file of riskExecutionFiles) {
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
    const isProviderImport = isConcreteProviderNamespaceImport(specifier)
      || [...forbiddenProviderModules].some(moduleName => hasModuleSegment(specifier, moduleName));
    if (isProviderImport) {
      violations.push(`${filePath} imports ${specifier}; Risk/Execution must consume upstream evidence/contracts rather than provider machinery.`);
    }
  }
}

// researchExecutionPolicy intentionally consumes ProviderHealth as type-only neutral
// evidence plus the canonical pure readiness evaluator. Keep the evidence contract
// decoupled from concrete providers while avoiding duplicated freshness/status logic.
const researchExecutionSource = readFileSync(join(engineRoot, 'researchExecutionPolicy.ts'), 'utf8');
if (!/import\s+type\s*\{[^}]*ProviderHealth[^}]*\}\s+from\s+['"][^'"]*providerContracts['"]/.test(researchExecutionSource)) {
  violations.push(`${basename(join(engineRoot, 'researchExecutionPolicy.ts'))} must source ProviderHealth as a type-only import from providerContracts.`);
}
if (!/import\s*\{[^}]*providerHealthReadinessError[^}]*\}\s+from\s+['"][^'"]*providerHealthPolicy['"]/.test(researchExecutionSource)) {
  violations.push(`${basename(join(engineRoot, 'researchExecutionPolicy.ts'))} must reuse the canonical providerHealthReadinessError policy rather than duplicate provider readiness logic.`);
}

if (violations.length > 0) throw new Error(`Risk/Execution provider boundary violations:\n- ${violations.join('\n- ')}`);
console.log(`Risk/Execution provider boundary smoke passed: ${riskExecutionFiles.length} discovered execution surface(s) are isolated from provider machinery, including future nested provider adapter namespaces, use provider-neutral evidence, and reuse canonical readiness policy.`);
