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

const forbidden = ['/components/', '../components/', '/data/mockStocks', '../data/mockStocks', '/App', '../App'];
const violations: string[] = [];

for (const file of collectTypeScriptFiles(applicationRoot)) {
  const source = readFileSync(file, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    if (forbidden.some(boundary => specifier.includes(boundary))) {
      violations.push(`${relative(repoRoot, file)} imports ${specifier}; application orchestration must remain presentation-independent and cannot reach into React or the mock-universe implementation.`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Application-layer contract violations:\n- ${violations.join('\n- ')}`);
}

console.log('Application-layer contract smoke passed: application orchestration is independent from React/App and mock-universe implementations across static, dynamic and CommonJS imports.');
