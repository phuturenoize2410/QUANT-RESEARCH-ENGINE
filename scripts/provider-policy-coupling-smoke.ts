import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const POLICY_PATH = path.join(ROOT, 'src', 'engine', 'providerPolicy.ts');
const source = fs.readFileSync(POLICY_PATH, 'utf8');

// providerPolicy owns provider-neutral readiness/status policy. Keep concrete
// acquisition, cache, quote/bar and adapter implementations below this seam so
// future Google Finance/free/paid providers can satisfy the same contracts.
const FORBIDDEN_MODULES = [
  'dataProviders',
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

for (const moduleName of FORBIDDEN_MODULES) {
  const refs = moduleRefs(moduleName);
  if (refs.length > 0) {
    throw new Error(
      `providerPolicy.ts must not depend on concrete ${moduleName} machinery; found ${refs.length} reference(s). ` +
        'Keep readiness/status policy provider-neutral and depend on providerContracts.',
    );
  }
}

if (!source.includes("from './providerContracts'")) {
  throw new Error(
    'providerPolicy.ts must import provider vocabulary from the neutral providerContracts boundary.',
  );
}

if (!/HealthCheckedProvider/.test(source)) {
  throw new Error(
    'providerPolicy.ts must accept the neutral HealthCheckedProvider contract for provider status/readiness operations.',
  );
}

console.log(
  'provider policy coupling smoke: PASS (concrete provider coupling locked at zero; readiness/status policy stays provider-neutral)',
);
