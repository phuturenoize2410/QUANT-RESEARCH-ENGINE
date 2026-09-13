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
  return [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
    .map(match => match[1]);
}

/**
 * The application layer is the presentation-facing seam, not a second engine.
 * It may expose explicit use cases/DTOs from orchestration modules, but it must
 * not couple React to concrete providers, prototype/mock datasets, or UI code.
 *
 * Provider implementations remain behind the provider/research pipeline so a
 * future Google Finance, free API, paid IDX feed, or broker adapter can be
 * replaced without changing presentation contracts.
 */
const forbiddenApplicationImports = [
  '/components/',
  '../components/',
  '/App',
  '../App',
  '/data/mockStocks',
  '../data/mockStocks',
  '/data/prototype',
  '../data/prototype',
  '/engine/dataProviders',
  '../engine/dataProviders',
  '/engine/providerPolicy',
  '../engine/providerPolicy',
  '/engine/providerGate',
  '../engine/providerGate',
  '/engine/providerCache',
  '../engine/providerCache',
  '/engine/providerHealth',
  '../engine/providerHealth',
];

const violations: string[] = [];
const files = collectTypeScriptFiles(applicationRoot);

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const filePath = relative(repoRoot, file).replaceAll('\\', '/');

  if (/export\s*\*\s*from\s*['"]/m.test(source)) {
    violations.push(
      `${filePath} uses a wildcard re-export; application facades must expose explicit use cases and DTOs so new engine internals cannot silently become UI dependencies.`,
    );
  }

  for (const specifier of importSpecifiers(source)) {
    if (forbiddenApplicationImports.some(boundary => specifier.includes(boundary))) {
      violations.push(
        `${filePath} imports ${specifier}; application facades must stay independent from React, prototype/mock datasets, and concrete provider infrastructure.`,
      );
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Application facade boundary violations:\n- ${violations.join('\n- ')}`);
}

console.log(
  `Application-facade smoke passed: ${files.length} application module(s) use explicit exports and remain independent from React, prototype/mock datasets, and concrete provider infrastructure.`,
);
