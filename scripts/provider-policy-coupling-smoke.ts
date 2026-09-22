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

for (const guard of ['isMarketDataSource', 'isProviderMode'] as const) {
  if (!new RegExp(`\\b${guard}\\b`).test(source)) {
    throw new Error(
      `providerPolicy.ts must consume canonical ${guard} from providerContracts instead of owning provider vocabulary validation.`,
    );
  }
}

const FORBIDDEN_LOCAL_VOCABULARY = [
  /const\s+PROVIDER_MODES\b/,
  /const\s+MARKET_DATA_SOURCES\b/,
  /function\s+isProviderMode\s*\(/,
  /function\s+isMarketDataSource\s*\(/,
] as const;

for (const pattern of FORBIDDEN_LOCAL_VOCABULARY) {
  if (pattern.test(source)) {
    throw new Error(
      'providerPolicy.ts must not redeclare provider source/mode vocabulary or guards; use providerContracts as the single source of truth.',
    );
  }
}

const researchUseCaseMatch = source.match(/export\s+const\s+RESEARCH_USE_CASES\s*=\s*\[([\s\S]*?)\]\s+as\s+const\s*;/);
if (!researchUseCaseMatch) {
  throw new Error(
    'providerPolicy.ts must expose RESEARCH_USE_CASES as the canonical readonly policy vocabulary.',
  );
}

const researchUseCases = [...researchUseCaseMatch[1].matchAll(/['\"]([^'\"]+)['\"]/g)].map(match => match[1]);
if (researchUseCases.length === 0) {
  throw new Error('RESEARCH_USE_CASES must contain at least one canonical research use case.');
}
if (new Set(researchUseCases).size !== researchUseCases.length) {
  throw new Error('RESEARCH_USE_CASES must not contain duplicate policy vocabulary entries.');
}

const requiredResearchUseCases = [
  'HISTORICAL_BACKTEST',
  'EOD_RESEARCH',
  'PRECLOSE_SCREENING',
  'LIVE_EXECUTION',
] as const;
for (const useCase of requiredResearchUseCases) {
  if (!researchUseCases.includes(useCase)) {
    throw new Error(`RESEARCH_USE_CASES must retain ${useCase}; provider readiness must cover the full research-to-execution lifecycle.`);
  }
}

if (!/export\s+type\s+ResearchUseCase\s*=\s*\(typeof\s+RESEARCH_USE_CASES\)\[number\]\s*;/.test(source)) {
  throw new Error(
    'ResearchUseCase must be derived from RESEARCH_USE_CASES so compile-time and runtime policy vocabulary cannot drift.',
  );
}

if (!/export\s+function\s+isResearchUseCase\s*\(\s*value\s*:\s*unknown\s*\)\s*:\s*value\s+is\s+ResearchUseCase/.test(source)) {
  throw new Error(
    'providerPolicy.ts must export isResearchUseCase as the canonical runtime guard for research lifecycle vocabulary.',
  );
}

const researchUseCaseGuardMatch = source.match(/export\s+function\s+isResearchUseCase[\s\S]*?\{([\s\S]*?)\n\}/);
if (!researchUseCaseGuardMatch || !/RESEARCH_USE_CASES\.includes\s*\(/.test(researchUseCaseGuardMatch[1])) {
  throw new Error(
    'isResearchUseCase must validate against canonical RESEARCH_USE_CASES rather than redeclaring lifecycle vocabulary.',
  );
}

console.log(
  'provider policy coupling smoke: PASS (concrete coupling locked at zero; canonical provider guards and research use-case lifecycle vocabulary/guard enforced)',
);
