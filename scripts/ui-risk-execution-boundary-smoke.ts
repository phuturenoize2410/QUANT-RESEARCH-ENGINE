import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const srcRoot = join(repoRoot, 'src');
const uiRoots = [join(srcRoot, 'App.tsx'), join(srcRoot, 'components')];

function collectTypeScriptFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return /\.(ts|tsx)$/.test(path) ? [path] : [];

  return readdirSync(path).flatMap(entry => collectTypeScriptFiles(join(path, entry)));
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
    .map(match => match[1]);
}

function isDirectRiskExecutionImport(specifier: string): boolean {
  const normalized = specifier.replaceAll('\\', '/');
  return /(?:^|\/)engine\/(?:risk|execution)[^/]*$/i.test(normalized);
}

const violations: string[] = [];

for (const file of uiRoots.flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(file, 'utf8');

  for (const specifier of importSpecifiers(source)) {
    if (isDirectRiskExecutionImport(specifier)) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; UI must consume Risk/Execution outputs through the application/pipeline boundary rather than executing policy directly.`,
      );
    }
  }
}

if (violations.length > 0) {
  throw new Error(`UI Risk/Execution boundary violations:\n- ${violations.join('\n- ')}`);
}

console.log(
  'UI Risk/Execution boundary smoke passed: React surfaces cannot directly import risk/execution engine modules and must consume their outputs through the application/pipeline boundary.',
);
