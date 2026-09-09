import assert from 'node:assert/strict';
import {
  ESTABLISHED_SCORE_BOUNDS,
  NORMALIZED_SCORE_BOUNDS,
  OVERNIGHT_EDGE_SCORE_BOUNDS,
  clampScore,
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

assert.equal(clampScore(Number.NaN, OVERNIGHT_EDGE_SCORE_BOUNDS), 1);
assert.equal(clampScore(Number.POSITIVE_INFINITY, ESTABLISHED_SCORE_BOUNDS), 5);

console.log('score policy smoke passed');
