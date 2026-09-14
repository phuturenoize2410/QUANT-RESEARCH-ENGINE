import assert from 'node:assert/strict';
import { buildUniverse } from '../src/data/mockStocks';
import { TickerFeatureVector } from '../src/engine/ml/types';
import {
  runFeatureGatedShortlistStrategy,
  ShortlistFeatureBoundaryError,
} from '../src/engine/strategy/featureDrivenShortlist';

const universe = buildUniverse();
const featuresByTicker = Object.fromEntries(
  universe.map(stock => [
    stock.ticker,
    { ticker: stock.ticker } as TickerFeatureVector,
  ]),
);

const baseline = runFeatureGatedShortlistStrategy(universe, featuresByTicker);
assert.equal(baseline.evaluatedUniverseCount, universe.length);

const missingTicker = universe[0].ticker;
const missingFeatures = { ...featuresByTicker };
delete missingFeatures[missingTicker];
assert.throws(
  () => runFeatureGatedShortlistStrategy(universe, missingFeatures),
  (error: unknown) => {
    assert.ok(error instanceof ShortlistFeatureBoundaryError);
    assert.deepEqual(error.missingTickers, [missingTicker]);
    assert.deepEqual(error.mismatchedTickers, []);
    assert.deepEqual(error.unexpectedTickers, []);
    return true;
  },
);

const mismatchedTicker = universe[1].ticker;
const mismatchedFeatures = {
  ...featuresByTicker,
  [mismatchedTicker]: {
    ...featuresByTicker[mismatchedTicker],
    ticker: 'WRONG',
  },
};
assert.throws(
  () => runFeatureGatedShortlistStrategy(universe, mismatchedFeatures),
  (error: unknown) => {
    assert.ok(error instanceof ShortlistFeatureBoundaryError);
    assert.deepEqual(error.missingTickers, []);
    assert.deepEqual(error.mismatchedTickers, [`${mismatchedTicker}->WRONG`]);
    assert.deepEqual(error.unexpectedTickers, []);
    return true;
  },
);

const unexpectedFeatures = {
  ...featuresByTicker,
  STALE: { ticker: 'STALE' } as TickerFeatureVector,
};
assert.throws(
  () => runFeatureGatedShortlistStrategy(universe, unexpectedFeatures),
  (error: unknown) => {
    assert.ok(error instanceof ShortlistFeatureBoundaryError);
    assert.deepEqual(error.missingTickers, []);
    assert.deepEqual(error.mismatchedTickers, []);
    assert.deepEqual(error.unexpectedTickers, ['STALE']);
    return true;
  },
);

console.log('feature-gated shortlist strategy smoke passed');
