import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const applicationRoot = join(repoRoot, 'src', 'application');

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

/**
 * Normalize module spelling before classifying architecture ownership.
 *
 * Boundary enforcement must not depend on one relative-path spelling: aliases,
 * explicit TS/TSX extensions, Windows separators, or Vite query/hash suffixes
 * must not create an accidental route from application orchestration back into
 * React or prototype/static datasets.
 */
function normalizeModuleSpecifier(specifier: string): string {
  return specifier
    .replaceAll('\\', '/')
    .replace(/[?#].*$/, '')
    .replace(/\.(?:ts|tsx|js|jsx)$/, '');
}

function isPresentationDependency(specifier: string): boolean {
  const normalized = normalizeModuleSpecifier(specifier);
  return normalized.includes('/components/')
    || normalized.endsWith('/components')
    || normalized.includes('/pages/')
    || normalized.endsWith('/pages')
    || normalized.includes('/views/')
    || normalized.endsWith('/views')
    || /(?:^|\/)App$/.test(normalized)
    || /(?:^|\/)main$/.test(normalized);
}

function isPrototypeDataDependency(specifier: string): boolean {
  const normalized = normalizeModuleSpecifier(specifier);
  return normalized.includes('/data/') || normalized.endsWith('/data');
}

const violations: string[] = [];

for (const file of collectTypeScriptFiles(applicationRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (isPresentationDependency(specifier)) {
      violations.push(`${relative(repoRoot, file)} imports ${specifier}; application orchestration must remain presentation-independent and cannot depend on bootstrap, App, component, page, or view modules.`);
    }
    if (isPrototypeDataDependency(specifier)) {
      violations.push(`${relative(repoRoot, file)} imports ${specifier}; application orchestration cannot bypass DataProvider contracts by reaching into prototype/static data modules directly.`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Application-layer contract violations:\n- ${violations.join('\n- ')}`);
}

console.log('Application-layer contract smoke passed: application orchestration is independent from bootstrap/React presentation and direct prototype/static data modules across normalized static, re-export, dynamic and CommonJS imports; provider-backed data must enter through engine provider contracts.');
