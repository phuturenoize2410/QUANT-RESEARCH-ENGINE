import assert from 'node:assert/strict';
import { IDX_MARKET_ADAPTER } from '../src/engine/market/idxMarketAdapter';
import { formatMarketTimeLabel, normalizeSharesPerLot } from '../src/engine/market/marketAdapter';

assert.equal(Object.isFrozen(IDX_MARKET_ADAPTER), true, 'market adapter must be frozen');
assert.equal(Object.isFrozen(IDX_MARKET_ADAPTER.identity), true, 'market identity must be frozen');
assert.equal(Object.isFrozen(IDX_MARKET_ADAPTER.microstructure), true, 'market microstructure must be frozen');

assert.equal(IDX_MARKET_ADAPTER.identity.marketId, 'IDX');
assert.equal(IDX_MARKET_ADAPTER.identity.currency, 'IDR');
assert.equal(IDX_MARKET_ADAPTER.identity.timezone, 'Asia/Jakarta');
assert.equal(IDX_MARKET_ADAPTER.identity.timezoneLabel, 'WIB');
assert.equal(IDX_MARKET_ADAPTER.microstructure.sharesPerLot(), 100);

assert.equal(normalizeSharesPerLot(Number.NaN), 1, 'invalid lot size must fail closed');
assert.equal(normalizeSharesPerLot(0), 1, 'zero lot size must fail closed');
assert.equal(normalizeSharesPerLot(-100), 1, 'negative lot size must fail closed');
assert.equal(normalizeSharesPerLot(100.9), 100, 'lot size must normalize to whole shares');
assert.equal(formatMarketTimeLabel(IDX_MARKET_ADAPTER, '15:30', 'Today'), 'Today 15:30 WIB');

assert.throws(() => {
  (IDX_MARKET_ADAPTER.identity as { marketId: string }).marketId = 'US';
}, TypeError, 'runtime consumers must not be able to rewrite market identity');

assert.throws(() => {
  (IDX_MARKET_ADAPTER.microstructure as { sharesPerLot: () => number }).sharesPerLot = () => 1;
}, TypeError, 'runtime consumers must not be able to rewrite market microstructure');

console.log('market-adapter-smoke: PASS');
