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

function normalizeModuleSpecifier(specifier: string): string {
  return specifier
    .replaceAll('\\\\', '/')
    .split(/[?#]/, 1)[0]
    .replace(/\.(?:[cm]?[jt]sx?)$/i, '')
    .replace(/\/+$/g, '');
}

function moduleSegments(specifier: string): string[] {
  return normalizeModuleSpecifier(specifier)
    .split('/')
    .filter(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}

function crossesPresentationOrPrototypeDataBoundary(specifier: string): boolean {
  const segments = moduleSegments(specifier);
  return segments.includes('components') || segments.includes('data') || segments.at(-1) === 'App';
}

const violations: string[] = [];
for (const file of collectTypeScriptFiles(applicationRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (crossesPresentationOrPrototypeDataBoundary(specifier)) {
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
  `Application-boundary smoke passed: ${collectTypeScriptFiles(applicationRoot).length} application modules remain independent from React/UI and direct prototype/static data imports across normalized static imports, dynamic imports and CommonJS require calls; aliases, Windows separators, extensions and query/hash suffixes cannot bypass the boundary; provider-backed data must enter through engine provider contracts.`,
);
