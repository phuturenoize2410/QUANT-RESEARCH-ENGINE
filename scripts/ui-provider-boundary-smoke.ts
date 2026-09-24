import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const UI_ROOTS = [
  path.join(SRC, 'main.tsx'),
  path.join(SRC, 'App.tsx'),
  ...['components', 'pages', 'views'].map((name) => path.join(SRC, name)),
];

const FORBIDDEN_ENGINE_MODULES = new Set([
  'dataProviders',
  'providerContracts',
  'providerHealth',
  'providerPolicy',
  'providerHealthPolicy',
  'providerGate',
  'providerCache',
]);

function sourceFiles(target: string): string[] {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return /\.(?:ts|tsx|js|jsx)$/.test(target) ? [target] : [];

  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

function importSpecifiers(source: string): string[] {
  const staticSpecifiers = [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
  const dynamicSpecifiers = [...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
    (match) => match[1],
  );
  const requireSpecifiers = [...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
    (match) => match[1],
  );
  return [...new Set([...staticSpecifiers, ...dynamicSpecifiers, ...requireSpecifiers])];
}

function forbiddenProviderModule(specifier: string): string | null {
  const cleanSpecifier = specifier.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  const withoutExtension = cleanSpecifier.replace(/\.(?:ts|tsx|js|jsx)$/, '');
  const segments = withoutExtension.split('/').filter(Boolean);
  const engineIndex = segments.lastIndexOf('engine');
  if (engineIndex < 0 || engineIndex === segments.length - 1) return null;

  const moduleName = segments[engineIndex + 1];
  if (moduleName === 'provider') return 'provider/*';
  return FORBIDDEN_ENGINE_MODULES.has(moduleName) ? moduleName : null;
}

const uiFiles = [...new Set(UI_ROOTS.flatMap(sourceFiles))].sort();

if (uiFiles.length === 0) {
  throw new Error(
    'UI provider boundary smoke discovered zero UI source files. Fail closed so a future layout/refactor cannot silently disable DataProvider -> Feature -> Strategy -> Risk/Execution -> UI enforcement.',
  );
}

const violations: string[] = [];

for (const file of uiFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    const moduleName = forbiddenProviderModule(specifier);
    if (moduleName) {
      violations.push(`${path.relative(ROOT, file)} -> ${specifier} (${moduleName})`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    'UI must not consume concrete provider/health machinery directly. Route provider state through the application facade so DataProvider -> Feature -> Strategy -> Risk/Execution -> UI remains enforceable. Violations:\n' +
      violations.map((item) => `- ${item}`).join('\n'),
  );
}

console.log(
  `UI provider boundary smoke: PASS (${uiFiles.length} UI source files including bootstrap/application shells; no direct concrete provider/health imports)`,
);
