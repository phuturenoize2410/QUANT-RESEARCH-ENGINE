import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, 'src', 'engine', 'providerHealthPolicy.ts');
const source = fs.readFileSync(POLICY_PATH, 'utf8');

// providerHealthPolicy is the canonical, provider-neutral evidence/readiness policy.
// It may consume only the shared provider contract and canonical runtime guards;
// concrete provider/acquisition machinery belongs upstream.
const FORBIDDEN_PROVIDER_MODULES = [
  'dataProviders',
  'providerHealth',
  'providerPolicy',
  'providerGate',
  'providerCache',
  'providerBars',
  'providerQuote',
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
for (const moduleName of FORBIDDEN_PROVIDER_MODULES) {
  const refs = specifiers.filter((specifier) => referencesModule(specifier, moduleName));
  if (refs.length > 0) {
    throw new Error(
      `providerHealthPolicy.ts must not depend on ${moduleName}; found ${refs.join(', ')}. ` +
        'Keep canonical health evidence/readiness policy provider-neutral.',
    );
  }
}

const contractRefs = specifiers.filter((specifier) => referencesModule(specifier, 'providerContracts'));
if (contractRefs.length !== 1) {
  throw new Error(
    `providerHealthPolicy.ts must have exactly one providerContracts dependency; found ${contractRefs.length}.`,
  );
}

if (!/import\s+\{[^}]*\bisProviderHealthStatus\b[^}]*\btype\s+ProviderHealth\b[^}]*\}\s+from\s+['"][^'"]*providerContracts(?:\.(?:ts|tsx|js|jsx|mjs|cjs))?(?:[?#][^'"]*)?['"]/.test(source)) {
  throw new Error(
    'providerHealthPolicy.ts must consume canonical isProviderHealthStatus and type-only ProviderHealth from providerContracts.',
  );
}

if (/\b(?:const|let|var)\s+PROVIDER_HEALTH_STATUSES\b/.test(source)) {
  throw new Error(
    'providerHealthPolicy.ts must not redeclare provider health status vocabulary; use providerContracts isProviderHealthStatus.',
  );
}

console.log(
  'provider health policy coupling smoke: PASS (canonical readiness policy consumes providerContracts type plus canonical runtime status guard)',
);
