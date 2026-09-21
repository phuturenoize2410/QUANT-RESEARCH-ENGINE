import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, 'src', 'engine', 'researchExecutionPolicy.ts');
const source = fs.readFileSync(POLICY_PATH, 'utf8');

// researchExecutionPolicy is the canonical fail-closed research -> execution evaluator.
// Keep it dependent on neutral evidence/readiness contracts rather than concrete providers,
// strategy implementations, application facades, prototype data, or UI modules.
const FORBIDDEN_MODULES = [
  'dataProviders',
  'providerHealth',
  'providerPolicy',
  'providerGate',
  'providerCache',
  'providerBars',
  'providerQuote',
  'researchApplication',
  'researchExecutionApplication',
] as const;

function normalizeModuleSpecifier(specifier: string): string {
  return specifier
    .replace(/\\/g, '/')
    .replace(/[?#].*$/, '')
    .replace(/\.(?:ts|tsx|js|jsx|mjs|cjs)$/, '');
}

function importedModuleSpecifiers(): string[] {
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  return patterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => normalizeModuleSpecifier(match[1])),
  );
}

function referencesModule(specifier: string, moduleName: string): boolean {
  const segments = specifier.split('/').filter(Boolean);
  return segments.at(-1) === moduleName;
}

const specifiers = importedModuleSpecifiers();
for (const moduleName of FORBIDDEN_MODULES) {
  const refs = specifiers.filter((specifier) => referencesModule(specifier, moduleName));
  if (refs.length > 0) {
    throw new Error(
      `researchExecutionPolicy.ts must not depend on ${moduleName}; found ${refs.join(', ')}. ` +
        'Keep execution eligibility provider-neutral and fail-closed.',
    );
  }
}

const providerContractRefs = specifiers.filter((specifier) => referencesModule(specifier, 'providerContracts'));
if (providerContractRefs.length !== 1) {
  throw new Error(
    `researchExecutionPolicy.ts must have exactly one providerContracts dependency; found ${providerContractRefs.length}.`,
  );
}

if (!/import\s+type\s+\{[^}]*\bProviderHealth\b[^}]*\}\s+from\s+['"][^'"]*providerContracts(?:\.(?:ts|tsx|js|jsx|mjs|cjs))?(?:[?#][^'"]*)?['"]/.test(source)) {
  throw new Error('researchExecutionPolicy.ts must consume ProviderHealth through a type-only providerContracts import.');
}

if (!/import\s+\{[^}]*\bproviderHealthReadinessError\b[^}]*\}\s+from\s+['"][^'"]*providerHealthPolicy(?:\.(?:ts|tsx|js|jsx|mjs|cjs))?(?:[?#][^'"]*)?['"]/.test(source)) {
  throw new Error('researchExecutionPolicy.ts must delegate provider readiness to providerHealthPolicy.');
}

if (!/import\s+type\s+\{[^}]*\bResearchExecutionEligibility\b[^}]*\}\s+from\s+['"][^'"]*researchPipelineStagePolicy(?:\.(?:ts|tsx|js|jsx|mjs|cjs))?(?:[?#][^'"]*)?['"]/.test(source)) {
  throw new Error('ResearchExecutionEligibility must remain a type-only stage-policy dependency.');
}

for (const factory of ['createApprovedExecutionEligibility', 'createBlockedExecutionEligibility'] as const) {
  const pattern = new RegExp(
    `import\\s+\\{[^}]*\\b${factory}\\b[^}]*\\}\\s+from\\s+['\"][^'\"]*researchPipelineStagePolicy(?:\\.(?:ts|tsx|js|jsx|mjs|cjs))?(?:[?#][^'\"]*)?['\"]`,
  );
  if (!pattern.test(source)) {
    throw new Error(`researchExecutionPolicy.ts must delegate ${factory} to researchPipelineStagePolicy.`);
  }
}

console.log(
  'research execution policy coupling smoke: PASS (neutral evidence contracts and canonical fail-closed policy dependencies only)',
);
