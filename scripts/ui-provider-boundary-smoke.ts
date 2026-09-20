import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const UI_ROOTS = [
  path.join(SRC, 'main.tsx'),
  path.join(SRC, 'App.tsx'),
  ...['components', 'pages', 'views'].map((name) => path.join(SRC, name)),
];

const FORBIDDEN_ENGINE_MODULES = [
  'dataProviders',
  'providerContracts',
  'providerHealth',
  'providerPolicy',
  'providerHealthPolicy',
  'providerGate',
  'providerCache',
] as const;

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

const uiFiles = UI_ROOTS.flatMap(sourceFiles);
const violations: string[] = [];

for (const file of uiFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const moduleName of FORBIDDEN_ENGINE_MODULES) {
    const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const moduleSpecifier = `(?:[^'\"]*/engine/${escaped}|@/engine/${escaped}|@engine/${escaped}|~/engine/${escaped}|src/engine/${escaped}|/src/engine/${escaped})(?:\\.(?:ts|tsx|js|jsx))?`;
    const pattern = new RegExp(
      `(?:from\\s+['\"]${moduleSpecifier}['\"]|import\\s+['\"]${moduleSpecifier}['\"]|import\\s*\\(\\s*['\"]${moduleSpecifier}['\"]\\s*\\)|require\\s*\\(\\s*['\"]${moduleSpecifier}['\"]\\s*\\))`,
      'g',
    );
    if (pattern.test(source)) {
      violations.push(`${path.relative(ROOT, file)} -> ${moduleName}`);
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
