import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const CANONICAL_POLICY = 'engine/scorePolicy.ts';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sourceFiles = walk(ROOT).filter((path) => /\.(ts|tsx)$/.test(path));
const violations: string[] = [];

for (const path of sourceFiles) {
  const repoPath = relative(ROOT, path).split(sep).join('/');
  if (repoPath === CANONICAL_POLICY) continue;

  const source = readFileSync(path, 'utf8');

  // Score-domain ownership belongs to scorePolicy.ts. Domain consumers should use
  // semantic helpers instead of recreating clamp/round contracts locally. Keep the
  // patterns intentionally narrow so ordinary numeric UI layout/math is unaffected.
  const forbiddenPatterns: Array<[RegExp, string]> = [
    [/\b(?:NORMALIZED|OVERNIGHT_EDGE|ESTABLISHED|RESEARCH_ROBUSTNESS)_SCORE_BOUNDS\s*=/g, 'score bounds declaration'],
    [/\b(?:SCORE_MIN|MIN_SCORE|SCORE_MAX|MAX_SCORE)\s*=/g, 'local score boundary constant'],
    [/Math\.min\(\s*100\s*,\s*Math\.max\(\s*0\s*,/g, 'inline 0-100 score clamp'],
    [/Math\.max\(\s*0\s*,\s*Math\.min\(\s*100\s*,/g, 'inline 0-100 score clamp'],
    [/Math\.min\(\s*99\s*,\s*Math\.max\(\s*1\s*,/g, 'inline overnight score clamp'],
    [/Math\.max\(\s*1\s*,\s*Math\.min\(\s*99\s*,/g, 'inline overnight score clamp'],
  ];

  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(source)) violations.push(`${repoPath}: ${label}`);
  }
}

assert.deepEqual(
  violations,
  [],
  `Score policy ownership regression. Use src/engine/scorePolicy.ts semantic helpers instead:\n${violations.join('\n')}`,
);

console.log('score policy ownership smoke passed');
