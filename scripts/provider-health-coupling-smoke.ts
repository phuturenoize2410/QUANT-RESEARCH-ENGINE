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

const CANONICAL_GUARDS = [
  'isMarketDataSource',
  'isProviderHealthStatus',
  'isProviderMode',
] as const;

for (const guard of CANONICAL_GUARDS) {
  if (!source.includes(guard)) {
    throw new Error(
      `providerHealth.ts must consume canonical ${guard} from providerContracts; do not recreate provider vocabulary locally.`,
    );
  }

  const localDeclaration = new RegExp(
    `(?:function\\s+${guard}\\s*\\(|(?:const|let|var)\\s+${guard}\\s*=)`,
  );
  if (localDeclaration.test(source)) {
    throw new Error(
      `providerHealth.ts redeclares ${guard}; provider vocabulary guards must remain owned by providerContracts.`,
    );
  }
}

const LOCAL_VOCABULARY_ARRAYS = [
  'PROVIDER_HEALTH_STATUSES',
  'MARKET_DATA_SOURCES',
  'PROVIDER_MODES',
] as const;
for (const symbol of LOCAL_VOCABULARY_ARRAYS) {
  if (new RegExp(`(?:const|let|var)\\s+${symbol}\\b`).test(source)) {
    throw new Error(
      `providerHealth.ts redeclares ${symbol}; canonical provider vocabulary must remain single-source in providerContracts.`,
    );
  }
}

console.log(
  'provider health coupling smoke: PASS (concrete provider coupling and local vocabulary guards locked at zero; canonical guards come from providerContracts)',
);
