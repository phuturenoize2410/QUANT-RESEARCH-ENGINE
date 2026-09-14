import assert from 'node:assert/strict';
import { buildUniverse } from '../src/data/mockStocks';
import {
  runShortlistStrategy,
  ShortlistStrategyInputError,
} from '../src/engine/strategy/shortlistStrategy';

const baseline = buildUniverse();
const baselineResult = runShortlistStrategy(baseline);
assert.equal(baselineResult.evaluatedUniverseCount, baseline.length);

function expectRejected(
  mutate: (stock: Record<string, unknown>) => void,
  expectedTicker: string,
): void {
  const universe = buildUniverse();
  const target = universe[0] as unknown as Record<string, unknown>;
  mutate(target);

  assert.throws(
    () => runShortlistStrategy(universe),
    (error: unknown) => {
      assert.ok(error instanceof ShortlistStrategyInputError);
      assert.deepEqual(error.invalidTickers, [expectedTicker]);
      return true;
    },
  );
}

const firstTicker = baseline[0].ticker;
expectRejected(stock => { stock.prefilterPassed = 'true'; }, firstTicker);
expectRejected(stock => { stock.overnightEdgeScore = Number.NaN; }, firstTicker);
expectRejected(stock => { stock.overnightEdgeScore = Number.POSITIVE_INFINITY; }, firstTicker);
expectRejected(stock => { stock.overnightEdgeScore = -1; }, firstTicker);
expectRejected(stock => { stock.overnightEdgeScore = 101; }, firstTicker);

console.log('shortlist strategy input contract smoke passed');
