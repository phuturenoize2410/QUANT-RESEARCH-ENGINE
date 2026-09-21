import { readFileSync } from 'node:fs';

const target = 'src/application/providerStatusApplication.ts';
const source = readFileSync(target, 'utf8');
const imports = [...source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map((match) => match[1]);

function normalizedSegments(specifier: string): string[] {
  return specifier
    .split(/[?#]/, 1)[0]
    .replace(/\\/g, '/')
    .replace(/\.(?:[cm]?[jt]sx?)$/i, '')
    .split('/')
    .filter(Boolean);
}

const forbiddenProviderMachinery = new Set([
  'dataProviders',
  'providerBars',
  'providerCache',
  'providerGate',
  'providerPolicy',
  'providerQuote',
]);

for (const specifier of imports) {
  const segments = normalizedSegments(specifier);
  const forbidden = segments.find((segment) => forbiddenProviderMachinery.has(segment));
  if (forbidden) {
    throw new Error(`${target} must not depend on concrete/provider-acquisition machinery (${forbidden}) via ${specifier}. Consume neutral provider contracts plus canonical health evidence instead.`);
  }
}

const contractImport = source.match(/import\s+type\s*\{([^}]+)\}\s+from\s+['"]\.\.\/engine\/providerContracts['"]/s);
if (!contractImport || !contractImport[1].includes('HealthCheckedProvider') || !contractImport[1].includes('ProviderHealth')) {
  throw new Error(`${target} must consume HealthCheckedProvider and ProviderHealth as type-only neutral provider contracts.`);
}

if (!imports.some((specifier) => normalizedSegments(specifier).at(-1) === 'providerHealth')) {
  throw new Error(`${target} must delegate provider-health snapshot normalization to the canonical providerHealth module.`);
}
if (!imports.some((specifier) => normalizedSegments(specifier).at(-1) === 'providerHealthPolicy')) {
  throw new Error(`${target} must delegate health-evidence trust semantics to the canonical providerHealthPolicy module.`);
}

console.log('Provider-status boundary smoke passed: application status consumes neutral contracts and canonical health policy without concrete provider/acquisition coupling.');
