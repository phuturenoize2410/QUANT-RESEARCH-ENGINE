import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HEALTH_PATH = path.join(ROOT, 'src', 'engine', 'providerHealth.ts');
const source = fs.readFileSync(HEALTH_PATH, 'utf8');

// providerHealth is a vendor-neutral normalization/status boundary. It should
// ultimately depend only on providerContracts, not concrete provider machinery.
// One legacy import from dataProviders currently remains; freeze that debt so it
// cannot spread while the contract seam is migrated incrementally.
const CONCRETE_PROVIDER_MODULES = [
  'dataProviders',
  'providerPolicy',
  'providerHealthPolicy',
  'providerGate',
  'providerCache',
] as const;

function moduleRefs(moduleName: string): RegExpMatchArray[] {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(?:from\\s+['\"]\\./${escaped}['\"]|import\\s*\\(\\s*['\"]\\./${escaped}['\"]\\s*\\)|require\\s*\\(\\s*['\"]\\./${escaped}['\"]\\s*\\))`,
    'g',
  );
  return [...source.matchAll(pattern)];
}

const refsByModule = new Map(
  CONCRETE_PROVIDER_MODULES.map((moduleName) => [moduleName, moduleRefs(moduleName)]),
);
const dataProviderRefs = refsByModule.get('dataProviders') ?? [];
const LEGACY_DATA_PROVIDER_COUPLING_BUDGET = 1;

if (dataProviderRefs.length > LEGACY_DATA_PROVIDER_COUPLING_BUDGET) {
  throw new Error(
    `providerHealth.ts dataProviders coupling increased: ${dataProviderRefs.length} references ` +
      `(budget ${LEGACY_DATA_PROVIDER_COUPLING_BUDGET}). Provider health/status logic must not accumulate ` +
      'dependencies on concrete adapters.',
  );
}

if (dataProviderRefs.length < LEGACY_DATA_PROVIDER_COUPLING_BUDGET) {
  throw new Error(
    `providerHealth.ts dataProviders coupling debt fell to ${dataProviderRefs.length}; ` +
      'lower the legacy budget so the architecture ratchet cannot regress.',
  );
}

if (!source.includes("from './dataProviders'")) {
  throw new Error(
    'Expected the single documented legacy dataProviders import. If it was migrated, lower the debt budget to zero.',
  );
}

for (const moduleName of CONCRETE_PROVIDER_MODULES) {
  if (moduleName === 'dataProviders') continue;
  const refs = refsByModule.get(moduleName) ?? [];
  if (refs.length > 0) {
    throw new Error(
      `providerHealth.ts must not depend on concrete ${moduleName} machinery; found ${refs.length} reference(s). ` +
        'Keep health normalization provider-neutral and keep readiness/policy/cache behavior behind its owning boundary.',
    );
  }
}

console.log(
  'provider health coupling smoke: PASS (legacy dataProviders debt locked at 1; policy/readiness/gate/cache coupling forbidden)',
);
