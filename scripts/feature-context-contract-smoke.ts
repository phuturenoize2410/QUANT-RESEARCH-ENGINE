import assert from 'node:assert/strict';
import {
  FeatureContext,
  FeatureContextCoverageError,
  getFundamentalSnapshot,
} from '../src/engine/featureContext';

const baseMarket = {
  marketRegime: 'BULLISH',
  marketBreadthPctAboveMa20: 60,
  marketVolatilityIndex: 15,
  sectorRelativeStrength: {},
  sectorMomentumRank: {},
};

function makeContext(
  mode: FeatureContext['mode'],
  fundamentalsByTicker: FeatureContext['fundamentalsByTicker'],
): FeatureContext {
  return {
    asOfTimestamp: '2026-09-15T15:45:00+07:00',
    mode,
    isSimulated: mode === 'MOCK',
    market: baseMarket,
    fundamentalsByTicker,
    sources: {
      market: mode === 'MOCK' ? 'SIMULATED' : 'MARKET_PROVIDER',
      sector: mode === 'MOCK' ? 'SIMULATED' : 'DERIVED',
      broker: mode === 'MOCK' ? 'SIMULATED' : 'BROKER_PROVIDER',
      fundamental: mode === 'MOCK' ? 'SIMULATED' : 'FUNDAMENTAL_PROVIDER',
    },
  };
}

const mockFallback = getFundamentalSnapshot(makeContext('MOCK', {}), 'TEST');
assert.equal(mockFallback.peRatio, 8.5, 'MOCK mode must preserve explicit prototype fallback behavior');

const realSnapshot = {
  revenueGrowthYoy: 10,
  netMarginPct: 12,
  roePct: 15,
  pbvRatio: 1.4,
  peRatio: 9.2,
};
assert.deepEqual(
  getFundamentalSnapshot(makeContext('EOD', { BBCA: realSnapshot }), 'BBCA'),
  realSnapshot,
  'non-MOCK context should return provider-supplied ticker fundamentals',
);

assert.throws(
  () => getFundamentalSnapshot(makeContext('EOD', {}), 'BBCA'),
  (error: unknown) => {
    assert.ok(error instanceof FeatureContextCoverageError);
    assert.equal(error.ticker, 'BBCA');
    assert.deepEqual(error.invalidFields, ['fundamentalsByTicker']);
    return true;
  },
  'non-MOCK mode must fail closed when ticker-level fundamental coverage is missing',
);

assert.throws(
  () =>
    getFundamentalSnapshot(
      makeContext('EOD', {
        BBCA: { ...realSnapshot, roePct: Number.NaN },
      }),
      'BBCA',
    ),
  (error: unknown) => {
    assert.ok(error instanceof FeatureContextCoverageError);
    assert.deepEqual(error.invalidFields, ['fundamentalsByTicker.BBCA.roePct']);
    return true;
  },
  'malformed provider fundamentals must not reach feature calculation',
);

for (const malformedRoot of [null, [], 'invalid-root', 42]) {
  const context = makeContext('EOD', {}) as unknown as Record<string, unknown>;
  context.fundamentalsByTicker = malformedRoot;

  assert.throws(
    () => getFundamentalSnapshot(context as unknown as FeatureContext, 'BBCA'),
    (error: unknown) => {
      assert.ok(error instanceof FeatureContextCoverageError);
      assert.deepEqual(error.invalidFields, ['fundamentalsByTicker(root)']);
      return true;
    },
    'malformed fundamentals root must fail through the feature-context contract',
  );
}

for (const malformedSnapshot of [null, [], 'invalid-snapshot', 42]) {
  const context = makeContext('EOD', {}) as unknown as Record<string, unknown>;
  context.fundamentalsByTicker = { BBCA: malformedSnapshot };

  assert.throws(
    () => getFundamentalSnapshot(context as unknown as FeatureContext, 'BBCA'),
    (error: unknown) => {
      assert.ok(error instanceof FeatureContextCoverageError);
      assert.deepEqual(error.invalidFields, ['fundamentalsByTicker.BBCA(root)']);
      return true;
    },
    'malformed ticker fundamental snapshot must fail through the feature-context contract',
  );
}

console.log('feature context contract smoke passed');
