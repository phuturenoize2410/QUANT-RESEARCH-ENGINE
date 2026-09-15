import assert from 'node:assert/strict';
import { buildUniverse } from '../src/data/mockStocks';
import { TickerFeatureVector } from '../src/engine/ml/types';
import {
  runFeatureGatedShortlistStrategy,
  ShortlistFeatureBoundaryError,
  ShortlistInputAuthorityError,
} from '../src/engine/strategy/featureDrivenShortlist';

const universe = buildUniverse();
const featureTimestamp = '2026-09-15T01:00:00.000Z';
const featuresByTicker = Object.fromEntries(
  universe.map(stock => [
    stock.ticker,
    { ticker: stock.ticker, timestamp: featureTimestamp } as TickerFeatureVector,
  ]),
);

const baseline = runFeatureGatedShortlistStrategy(universe, featuresByTicker);
assert.equal(baseline.evaluatedUniverseCount, universe.length);

for (const mode of ['DELAYED', 'EOD', 'REALTIME'] as const) {
  assert.throws(
    () => runFeatureGatedShortlistStrategy(universe, featuresByTicker, undefined, undefined, mode),
    (error: unknown) => {
      assert.ok(error instanceof ShortlistInputAuthorityError);
      assert.equal(error.providerMode, mode);
      return true;
    },
  );
}

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
    assert.deepEqual(error.invalidTimestampTickers, []);
    assert.deepEqual(error.inconsistentTimestampTickers, []);
    assert.deepEqual(error.duplicateUniverseTickers, []);
    return true;
  },
);

const mismatchedTicker = universe[1].ticker;
const mismatchedFeatures = {
  ...featuresByTicker,
  [mismatchedTicker]: { ...featuresByTicker[mismatchedTicker], ticker: 'WRONG' },
};
assert.throws(
  () => runFeatureGatedShortlistStrategy(universe, mismatchedFeatures),
  (error: unknown) => {
    assert.ok(error instanceof ShortlistFeatureBoundaryError);
    assert.deepEqual(error.missingTickers, []);
    assert.deepEqual(error.mismatchedTickers, [`${mismatchedTicker}->WRONG`]);
    assert.deepEqual(error.unexpectedTickers, []);
    assert.deepEqual(error.invalidTimestampTickers, []);
    assert.deepEqual(error.inconsistentTimestampTickers, []);
    assert.deepEqual(error.duplicateUniverseTickers, []);
    return true;
  },
);

const unexpectedFeatures = {
  ...featuresByTicker,
  STALE: { ticker: 'STALE', timestamp: featureTimestamp } as TickerFeatureVector,
};
assert.throws(
  () => runFeatureGatedShortlistStrategy(universe, unexpectedFeatures),
  (error: unknown) => {
    assert.ok(error instanceof ShortlistFeatureBoundaryError);
    assert.deepEqual(error.missingTickers, []);
    assert.deepEqual(error.mismatchedTickers, []);
    assert.deepEqual(error.unexpectedTickers, ['STALE']);
    assert.deepEqual(error.invalidTimestampTickers, []);
    assert.deepEqual(error.inconsistentTimestampTickers, []);
    assert.deepEqual(error.duplicateUniverseTickers, []);
    return true;
  },
);

const invalidTimestampTicker = universe[2].ticker;
for (const timestamp of ['', 'not-a-date']) {
  const invalidTimestampFeatures = {
    ...featuresByTicker,
    [invalidTimestampTicker]: {
      ...featuresByTicker[invalidTimestampTicker],
      timestamp,
    },
  };
  assert.throws(
    () => runFeatureGatedShortlistStrategy(universe, invalidTimestampFeatures),
    (error: unknown) => {
      assert.ok(error instanceof ShortlistFeatureBoundaryError);
      assert.deepEqual(error.missingTickers, []);
      assert.deepEqual(error.mismatchedTickers, []);
      assert.deepEqual(error.unexpectedTickers, []);
      assert.deepEqual(error.invalidTimestampTickers, [invalidTimestampTicker]);
      assert.deepEqual(error.inconsistentTimestampTickers, []);
      assert.deepEqual(error.duplicateUniverseTickers, []);
      return true;
    },
  );
}

const crossSnapshotTicker = universe[3].ticker;
const crossSnapshotFeatures = {
  ...featuresByTicker,
  [crossSnapshotTicker]: {
    ...featuresByTicker[crossSnapshotTicker],
    timestamp: '2026-09-15T01:05:00.000Z',
  },
};
assert.throws(
  () => runFeatureGatedShortlistStrategy(universe, crossSnapshotFeatures),
  (error: unknown) => {
    assert.ok(error instanceof ShortlistFeatureBoundaryError);
    assert.deepEqual(error.missingTickers, []);
    assert.deepEqual(error.mismatchedTickers, []);
    assert.deepEqual(error.unexpectedTickers, []);
    assert.deepEqual(error.invalidTimestampTickers, []);
    assert.deepEqual(error.inconsistentTimestampTickers, [crossSnapshotTicker]);
    assert.deepEqual(error.duplicateUniverseTickers, []);
    return true;
  },
);

const equivalentInstantTicker = universe[4].ticker;
const equivalentInstantFeatures = {
  ...featuresByTicker,
  [equivalentInstantTicker]: {
    ...featuresByTicker[equivalentInstantTicker],
    timestamp: '2026-09-15T08:00:00.000+07:00',
  },
};
const equivalentInstantResult = runFeatureGatedShortlistStrategy(universe, equivalentInstantFeatures);
assert.equal(equivalentInstantResult.evaluatedUniverseCount, universe.length);

const duplicateTicker = universe[0].ticker;
const duplicateUniverse = [...universe, { ...universe[0] }];
assert.throws(
  () => runFeatureGatedShortlistStrategy(duplicateUniverse, featuresByTicker),
  (error: unknown) => {
    assert.ok(error instanceof ShortlistFeatureBoundaryError);
    assert.deepEqual(error.missingTickers, []);
    assert.deepEqual(error.mismatchedTickers, []);
    assert.deepEqual(error.unexpectedTickers, []);
    assert.deepEqual(error.invalidTimestampTickers, []);
    assert.deepEqual(error.inconsistentTimestampTickers, []);
    assert.deepEqual(error.duplicateUniverseTickers, [duplicateTicker]);
    return true;
  },
);

console.log('feature-gated shortlist strategy smoke passed');
