import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const srcRoot = join(repoRoot, 'src');
const uiRoots = [
  join(srcRoot, 'main.tsx'),
  join(srcRoot, 'App.tsx'),
  join(srcRoot, 'components'),
  join(srcRoot, 'pages'),
  join(srcRoot, 'views'),
].filter(existsSync);

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

function normalizedModuleSegments(specifier: string): string[] {
  return specifier
    .replaceAll('\\', '/')
    .split(/[?#]/, 1)[0]
    .replace(/\.(?:[cm]?[jt]sx?)$/i, '')
    .split('/')
    .filter(segment => segment.length > 0 && segment !== '.' && segment !== '..' && segment !== '@');
}

function reachesForbiddenPresentationDependency(specifier: string): boolean {
  const segments = normalizedModuleSegments(specifier);
  return segments.includes('engine') || segments.includes('data');
}

// Temporary debt mirrors architecture-boundary-smoke.ts exactly. This gate is
// deliberately independent so alias/bare/module-extension formatting cannot turn
// a forbidden UI dependency into an unrecognized spelling. Do not add entries;
// migrate them through src/application and shrink both gates together.
const legacyExceptions = new Map<string, Set<string>>([
  ['src/components/MLLabView.tsx', new Set([
    '../engine/ml/featureStore',
    '../engine/ml/models',
    '../engine/ml/ensembleRouter',
    '../engine/ml/modelRegistry',
  ])],
]);

const violations: string[] = [];

for (const file of uiRoots.flatMap(collectTypeScriptFiles)) {
  const source = readFileSync(file, 'utf8');
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');
  const exceptions = legacyExceptions.get(filePath) ?? new Set<string>();

  for (const specifier of importSpecifiers(source)) {
    if (!reachesForbiddenPresentationDependency(specifier)) continue;
    if (exceptions.has(specifier)) continue;
    violations.push(`${filePath} imports ${specifier}; presentation imports are normalized by module segment, so engine/data aliases, bare specifiers, extensions, query strings, hashes, and Windows separators cannot bypass the application boundary.`);
  }
}

if (violations.length > 0) {
  throw new Error(`Normalized UI boundary violations:\n- ${violations.join('\n- ')}`);
}

console.log('Normalized UI boundary smoke passed: presentation cannot bypass src/application by changing engine/data import spelling; the only tolerated dependencies are the four pinned ML Lab migration exceptions already tracked by the architecture debt ratchet.');
