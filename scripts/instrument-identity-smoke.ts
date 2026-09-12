import assert from 'node:assert/strict';
import {
  buildInstrumentId,
  createInstrumentRef,
  normalizeMarketId,
  normalizeSymbol,
} from '../src/engine/market/instrumentIdentity';

assert.equal(normalizeSymbol(' bbca '), 'BBCA');
assert.equal(normalizeMarketId(' idx '), 'IDX');
assert.equal(
  buildInstrumentId(' idx ', ' bbca '),
  'IDX:BBCA',
  'instrument ids must be stable across provider casing and whitespace differences',
);

const ref = createInstrumentRef(' idx ', ' bbca ');
assert.deepEqual(ref, {
  instrumentId: 'IDX:BBCA',
  symbol: 'BBCA',
  marketId: 'IDX',
});

const usRef = createInstrumentRef(' us ', ' aapl ');
assert.deepEqual(usRef, {
  instrumentId: 'US:AAPL',
  symbol: 'AAPL',
  marketId: 'US',
});

assert.equal(
  createInstrumentRef('IDX', 'BBCA').instrumentId,
  ref.instrumentId,
  'canonical identity must not depend on provider formatting',
);

console.log('Instrument identity smoke passed: market and symbol formatting are canonicalized before instrument keys enter provider/feature storage.');
