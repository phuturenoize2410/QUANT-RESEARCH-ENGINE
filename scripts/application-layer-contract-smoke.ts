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

/** Match an architecture-owned path segment even when it is the first segment. */
function hasPathSegment(specifier: string, segment: string): boolean {
  return specifier === segment
    || specifier.startsWith(`${segment}/`)
    || specifier.includes(`/${segment}/`)
    || specifier.endsWith(`/${segment}`);
}

function isPresentationDependency(specifier: string): boolean {
  const normalized = normalizeModuleSpecifier(specifier);
  return hasPathSegment(normalized, 'components')
    || hasPathSegment(normalized, 'pages')
    || hasPathSegment(normalized, 'views')
    || /(?:^|\/)App$/.test(normalized)
    || /(?:^|\/)main$/.test(normalized);
}

function isPrototypeDataDependency(specifier: string): boolean {
  return hasPathSegment(normalizeModuleSpecifier(specifier), 'data');
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

console.log('Application-layer contract smoke passed: application orchestration is independent from bootstrap/React presentation and direct prototype/static data modules across normalized static, re-export, dynamic and CommonJS imports, including bare/root aliases; provider-backed data must enter through engine provider contracts.');
