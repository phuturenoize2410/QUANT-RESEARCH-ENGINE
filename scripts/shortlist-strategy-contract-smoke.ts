import assert from 'node:assert/strict';
import { buildUniverse } from '../src/data/mockStocks';
import {
  runShortlistStrategy,
  runShortlistStrategyCandidates,
  ShortlistStrategyCandidate,
  ShortlistStrategyInputError,
} from '../src/engine/strategy/shortlistStrategy';

const baseline = buildUniverse();
const baselineResult = runShortlistStrategy(baseline);
assert.equal(baselineResult.evaluatedUniverseCount, baseline.length);

const strategyCandidates: ShortlistStrategyCandidate[] = baseline.map(stock => ({
  ticker: stock.ticker,
  stock,
  prefilterPassed: stock.prefilterPassed,
  overnightEdgeScore: stock.overnightEdgeScore,
}));
const dtoResult = runShortlistStrategyCandidates(strategyCandidates);
assert.deepEqual(
  dtoResult.candidates.map(stock => stock.ticker),
  baselineResult.candidates.map(stock => stock.ticker),
);
assert.deepEqual(dtoResult.policy, baselineResult.policy);

const mismatchedCandidate = strategyCandidates.map(candidate => ({ ...candidate }));
mismatchedCandidate[0].ticker = 'WRONG';
assert.throws(
  () => runShortlistStrategyCandidates(mismatchedCandidate),
  (error: unknown) => {
    assert.ok(error instanceof ShortlistStrategyInputError);
    assert.deepEqual(error.invalidTickers, ['WRONG']);
    return true;
  },
);

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
