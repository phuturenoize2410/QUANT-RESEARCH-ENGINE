import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const CANONICAL_POLICY = 'engine/scorePolicy.ts';
const canonicalPolicyPath = join(ROOT, ...CANONICAL_POLICY.split('/'));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

assert.ok(
  existsSync(canonicalPolicyPath),
  `Score policy ownership discovery regression: canonical policy missing at src/${CANONICAL_POLICY}`,
);

const sourceFiles = [...new Set(walk(ROOT).filter((path) => /\.(ts|tsx)$/.test(path)))].sort();
const consumerFiles = sourceFiles.filter((path) => {
  const repoPath = relative(ROOT, path).split(sep).join('/');
  return repoPath !== CANONICAL_POLICY;
});

assert.ok(
  consumerFiles.length > 0,
  'Score policy ownership discovery regression: no score-policy consumer surfaces were discovered',
);

const violations: string[] = [];

for (const path of consumerFiles) {
  const repoPath = relative(ROOT, path).split(sep).join('/');
  const source = readFileSync(path, 'utf8');

  // Score-domain ownership belongs to scorePolicy.ts. Domain consumers should use
  // semantic helpers instead of recreating clamp/round contracts locally. Keep the
  // patterns intentionally narrow so ordinary numeric UI layout/math is unaffected.
  // Numeric score boundaries accept decimal-equivalent literals (for example 100.0)
  // so formatting a hardcoded boundary cannot bypass canonical score ownership.
  const zero = '0(?:\\.0+)?';
  const one = '1(?:\\.0+)?';
  const five = '5(?:\\.0+)?';
  const ten = '10(?:\\.0+)?';
  const ninetyNine = '99(?:\\.0+)?';
  const hundred = '100(?:\\.0+)?';
  const clamp = (outer: string, inner: string) => [
    new RegExp(`Math\\.min\\(\\s*${outer}\\s*,\\s*Math\\.max\\(\\s*${inner}\\s*,`, 'g'),
    new RegExp(`Math\\.max\\(\\s*${inner}\\s*,\\s*Math\\.min\\(\\s*${outer}\\s*,`, 'g'),
  ];

  const forbiddenPatterns: Array<[RegExp, string]> = [
    [/\b(?:NORMALIZED|OVERNIGHT_EDGE|ESTABLISHED|RESEARCH_ROBUSTNESS)_SCORE_BOUNDS\s*=/g, 'score bounds declaration'],
    [/\b(?:SCORE_MIN|MIN_SCORE|SCORE_MAX|MAX_SCORE)\s*=/g, 'local score boundary constant'],
    ...clamp(hundred, zero).map((pattern): [RegExp, string] => [pattern, 'inline 0-100 score clamp']),
    ...clamp(ninetyNine, one).map((pattern): [RegExp, string] => [pattern, 'inline overnight score clamp']),
    ...clamp(hundred, five).map((pattern): [RegExp, string] => [pattern, 'inline established score clamp']),
    ...clamp(hundred, ten).map((pattern): [RegExp, string] => [pattern, 'inline research robustness score clamp']),
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
