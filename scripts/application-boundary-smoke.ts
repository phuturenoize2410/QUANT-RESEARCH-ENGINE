import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const srcRoot = join(repoRoot, 'src');
const applicationRoot = join(srcRoot, 'application');

function collectTypeScriptFiles(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) return /\.(ts|tsx)$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap(entry => collectTypeScriptFiles(join(path, entry)));
}

function importSpecifiers(source: string): string[] {
  const staticSpecifiers = [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(match => match[1]);
  const dynamicSpecifiers = [...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
  const requireSpecifiers = [...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
  return [...new Set([...staticSpecifiers, ...dynamicSpecifiers, ...requireSpecifiers])];
}

const forbiddenBoundaries = [
  '/components/',
  '/data/',
];

const violations: string[] = [];
for (const file of collectTypeScriptFiles(applicationRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (
      forbiddenBoundaries.some(boundary => specifier.includes(boundary)) ||
      specifier.endsWith('/App') ||
      specifier.endsWith('/App.tsx')
    ) {
      violations.push(
        `${relative(repoRoot, file)} imports ${specifier}; application orchestration must remain presentation-neutral and cannot bypass DataProvider contracts by importing prototype/static data modules directly.`,
      );
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Application boundary violations:\n- ${violations.join('\n- ')}`);
}

console.log(
  `Application-boundary smoke passed: ${collectTypeScriptFiles(applicationRoot).length} application modules remain independent from React/UI and direct prototype/static data imports across static imports, dynamic imports and CommonJS require calls; provider-backed data must enter through engine provider contracts.`,
);
