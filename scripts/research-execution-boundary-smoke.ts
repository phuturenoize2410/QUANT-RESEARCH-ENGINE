import { readFileSync } from 'node:fs';

const target = 'src/application/researchExecutionBoundary.ts';
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

const forbiddenSegments = new Set([
  'components',
  'data',
  'dataProviders',
  'providerBars',
  'providerCache',
  'providerGate',
  'providerPolicy',
  'providerQuote',
  'strategies',
  'strategy',
]);

for (const specifier of imports) {
  const segments = normalizedSegments(specifier);
  const forbidden = segments.find((segment) => forbiddenSegments.has(segment));
  if (forbidden) {
    throw new Error(`${target} must remain a stage-transition seam and must not depend on ${forbidden} via ${specifier}. Strategy/provider/UI machinery belongs outside this application boundary.`);
  }
}

const stagePolicyImports = imports.filter(
  (specifier) => normalizedSegments(specifier).at(-1) === 'researchPipelineStagePolicy',
);
if (stagePolicyImports.length !== 2) {
  throw new Error(`${target} must use exactly one type-only and one runtime import from the canonical researchPipelineStagePolicy.`);
}

const eligibilityTypeImport = /import\s+type\s*\{\s*ResearchExecutionEligibility\s*\}\s*from\s*['"][^'"]*researchPipelineStagePolicy(?:\.[cm]?[jt]sx?)?(?:[?#][^'"]*)?['"]/;
if (!eligibilityTypeImport.test(source)) {
  throw new Error(`${target} must import ResearchExecutionEligibility as a type-only contract so presentation envelopes do not create an unnecessary runtime dependency.`);
}

const runtimeStagePolicyImport = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*researchPipelineStagePolicy(?:\.[cm]?[jt]sx?)?(?:[?#][^'"]*)?['"]/s;
const runtimeMatch = source.match(runtimeStagePolicyImport);
if (!runtimeMatch) {
  throw new Error(`${target} must retain a runtime import from researchPipelineStagePolicy for canonical transition and fail-closed factories.`);
}
if (/\bResearchExecutionEligibility\b/.test(runtimeMatch[1])) {
  throw new Error(`${target} must not import ResearchExecutionEligibility through the runtime import.`);
}
for (const requiredRuntimeSymbol of ['assertNextResearchPipelineStage', 'createUnevaluatedExecutionEligibility']) {
  if (!new RegExp(`\\b${requiredRuntimeSymbol}\\b`).test(runtimeMatch[1])) {
    throw new Error(`${target} must delegate ${requiredRuntimeSymbol} to the canonical researchPipelineStagePolicy runtime.`);
  }
}

if (!source.includes("assertNextResearchPipelineStage('STRATEGY_ENGINE', 'RISK_EXECUTION')")) {
  throw new Error(`${target} must explicitly enforce STRATEGY_ENGINE -> RISK_EXECUTION.`);
}
if (!source.includes("assertNextResearchPipelineStage('RISK_EXECUTION', 'APPLICATION_UI')")) {
  throw new Error(`${target} must explicitly enforce RISK_EXECUTION -> APPLICATION_UI.`);
}
if (!source.includes('createUnevaluatedExecutionEligibility()')) {
  throw new Error(`${target} must keep presentation exposure fail-closed until canonical Risk/Execution evaluation occurs.`);
}

console.log('Research execution boundary smoke passed: application transition seam preserves Strategy -> Risk/Execution -> UI order, type-only eligibility, and no concrete provider/strategy/UI coupling.');
