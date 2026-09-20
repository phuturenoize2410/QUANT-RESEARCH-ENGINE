import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HEALTH_PATH = path.join(ROOT, 'src', 'engine', 'providerHealth.ts');
const source = fs.readFileSync(HEALTH_PATH, 'utf8');

// providerHealth is a vendor-neutral normalization/status boundary. It should
// ultimately depend only on providerContracts, not concrete market-data adapters.
// One legacy import from dataProviders currently remains; freeze that debt so it
// cannot spread while the contract seam is migrated incrementally.
const concreteProviderRefs = [
  ...source.matchAll(/(?:from\s+['"]\.\/dataProviders['"]|import\s*\(\s*['"]\.\/dataProviders['"]\s*\)|require\s*\(\s*['"]\.\/dataProviders['"]\s*\))/g),
];

const LEGACY_COUPLING_BUDGET = 1;
if (concreteProviderRefs.length > LEGACY_COUPLING_BUDGET) {
  throw new Error(
    `providerHealth.ts concrete-provider coupling increased: ${concreteProviderRefs.length} references (budget ${LEGACY_COUPLING_BUDGET}). ` +
      'Provider health/status logic must not accumulate dependencies on concrete adapters.',
  );
}

if (concreteProviderRefs.length < LEGACY_COUPLING_BUDGET) {
  throw new Error(
    `providerHealth.ts concrete-provider coupling debt fell to ${concreteProviderRefs.length}; ` +
      'remove or lower LEGACY_COUPLING_BUDGET so the architecture ratchet cannot regress.',
  );
}

if (!source.includes("from './dataProviders'")) {
  throw new Error(
    'Expected the single documented legacy dataProviders import. If it was migrated, lower the debt budget to zero.',
  );
}

console.log('provider health coupling smoke: PASS (legacy concrete-provider debt locked at 1)');
