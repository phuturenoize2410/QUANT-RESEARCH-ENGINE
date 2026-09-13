import assert from 'node:assert/strict';
import {
  ESTABLISHED_SCORE_BOUNDS,
  NORMALIZED_SCORE_BOUNDS,
  OVERNIGHT_EDGE_SCORE_BOUNDS,
  RESEARCH_ROBUSTNESS_SCORE_BOUNDS,
  clampNormalizedScore,
  clampScore,
  normalizeScoreBounds,
  roundEstablishedScore,
  roundNormalizedScore,
  roundOvernightEdgeScore,
  roundResearchRobustnessScore,
  roundScore,
} from '../src/engine/scorePolicy';

assert.equal(clampScore(-10), NORMALIZED_SCORE_BOUNDS.min);
assert.equal(clampScore(140), NORMALIZED_SCORE_BOUNDS.max);
assert.equal(clampScore(55.5), 55.5);
assert.equal(roundScore(55.5), 56);

assert.equal(roundScore(-20, OVERNIGHT_EDGE_SCORE_BOUNDS), 1);
assert.equal(roundScore(150, OVERNIGHT_EDGE_SCORE_BOUNDS), 99);
assert.equal(roundScore(-1, ESTABLISHED_SCORE_BOUNDS), 5);
assert.equal(roundScore(101, ESTABLISHED_SCORE_BOUNDS), 100);
assert.equal(roundScore(-1, RESEARCH_ROBUSTNESS_SCORE_BOUNDS), 10);
assert.equal(roundScore(101, RESEARCH_ROBUSTNESS_SCORE_BOUNDS), 100);

assert.equal(clampScore(Number.NaN, OVERNIGHT_EDGE_SCORE_BOUNDS), 1);
assert.equal(clampScore(Number.POSITIVE_INFINITY, ESTABLISHED_SCORE_BOUNDS), 5);
assert.equal(clampScore(Number.NaN, RESEARCH_ROBUSTNESS_SCORE_BOUNDS), 10);

assert.deepEqual(normalizeScoreBounds({ min: 100, max: 0 }), { min: 0, max: 100 });
assert.deepEqual(normalizeScoreBounds({ min: Number.NaN, max: 80 }), { min: 0, max: 80 });
assert.deepEqual(normalizeScoreBounds({ min: 20, max: Number.POSITIVE_INFINITY }), { min: 20, max: 100 });
assert.equal(clampScore(120, { min: Number.NaN, max: 80 }), 80);
assert.equal(clampScore(Number.NaN, { min: Number.NaN, max: Number.POSITIVE_INFINITY }), 0);
assert.equal(roundScore(72.6, { min: Number.NaN, max: Number.POSITIVE_INFINITY }), 73);

// Runtime score metadata can come from external configuration despite compile-time
// typing. Malformed shapes must fail closed to the canonical 0-100 contract.
assert.deepEqual(normalizeScoreBounds(null), NORMALIZED_SCORE_BOUNDS);
assert.deepEqual(normalizeScoreBounds(['0', '100']), NORMALIZED_SCORE_BOUNDS);
assert.deepEqual(normalizeScoreBounds({ min: '10', max: '90' }), NORMALIZED_SCORE_BOUNDS);
assert.deepEqual(normalizeScoreBounds({ min: 10, max: '90' }), { min: 10, max: 100 });
assert.deepEqual(normalizeScoreBounds({ min: -20, max: 80 }), { min: -20, max: 80 });
assert.equal(clampScore(150, null as unknown as { min: number; max: number }), 100);
assert.equal(roundScore(Number.NaN, ['bad'] as unknown as { min: number; max: number }), 0);

assert.equal(clampNormalizedScore(-5), 0);
assert.equal(clampNormalizedScore(101), 100);
assert.equal(roundNormalizedScore(72.6), 73);
assert.equal(roundOvernightEdgeScore(0), 1);
assert.equal(roundOvernightEdgeScore(100), 99);
assert.equal(roundEstablishedScore(0), 5);
assert.equal(roundEstablishedScore(100.4), 100);
assert.equal(roundResearchRobustnessScore(9.4), 10);
assert.equal(roundResearchRobustnessScore(72.6), 73);
assert.equal(roundResearchRobustnessScore(120), 100);

console.log('score policy smoke passed');
