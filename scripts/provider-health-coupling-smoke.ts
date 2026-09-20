import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HEALTH_PATH = path.join(ROOT, 'src', 'engine', 'providerHealth.ts');
const source = fs.readFileSync(HEALTH_PATH, 'utf8');

// providerHealth is a vendor-neutral normalization/status boundary. Its provider
// vocabulary must come only from providerContracts, never concrete provider
// machinery. This debt is now closed; keep the ratchet at zero.
const CONCRETE_PROVIDER_MODULES = [
  'dataProviders',
  'providerPolicy',
  'providerHealthPolicy',
  'providerGate',
  'providerCache',
] as const;

function moduleRefs(moduleName: string): RegExpMatchArray[] {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const moduleSpecifier = `(?:\\./${escaped}|\\.\\./engine/${escaped}|@/engine/${escaped}|@engine/${escaped}|~/engine/${escaped}|src/engine/${escaped}|/src/engine/${escaped})(?:\\.(?:ts|tsx|js|jsx))?`;
  const pattern = new RegExp(
    `(?:from\\s+['\"]${moduleSpecifier}['\"]|import\\s+['\"]${moduleSpecifier}['\"]|import\\s*\\(\\s*['\"]${moduleSpecifier}['\"]\\s*\\)|require\\s*\\(\\s*['\"]${moduleSpecifier}['\"]\\s*\\))`,
    'g',
  );
  return [...source.matchAll(pattern)];
}

for (const moduleName of CONCRETE_PROVIDER_MODULES) {
  const refs = moduleRefs(moduleName);
  if (refs.length > 0) {
    throw new Error(
      `providerHealth.ts must not depend on concrete ${moduleName} machinery; found ${refs.length} reference(s). ` +
        'Keep health normalization provider-neutral and import shared vocabulary from providerContracts.',
    );
  }
}

if (!source.includes("from './providerContracts'")) {
  throw new Error(
    'providerHealth.ts must import provider vocabulary from the neutral providerContracts boundary.',
  );
}

console.log(
  'provider health coupling smoke: PASS (concrete provider coupling locked at zero; canonical vocabulary comes from providerContracts)',
);
