import assert from 'node:assert/strict';
import { ProviderQuoteError, normalizeProviderQuote } from '../src/engine/providerQuote';

const validQuote = {
  ticker: ' bbca ',
  price: 101,
  open: 100,
  high: 103,
  low: 99,
  close: 101,
  change: 1,
  changePct: 1,
  volume: 1_000,
  turnover: 101_000,
  timestamp: '2026-09-16T08:30:00.000Z',
} as const;

const normalized = normalizeProviderQuote('free-idx-adapter', 'FREE_API', validQuote);
assert.equal(normalized.ticker, 'BBCA');
assert.equal(normalized.source, 'FREE_API');
assert.ok(Object.isFrozen(normalized), 'Canonical provider quote must be immutable after validation.');

assert.throws(
  () => normalizeProviderQuote('google-finance-adapter', 'GOOGLE_FINANCE', { ...validQuote, source: 'IDX_FEED' }),
  (error: unknown) => error instanceof ProviderQuoteError && error.providerId === 'google-finance-adapter',
  'Provider/source provenance mismatch must fail closed.',
);

for (const invalid of [
  { ...validQuote, price: Number.NaN },
  { ...validQuote, volume: -1 },
  { ...validQuote, high: 98 },
  { ...validQuote, timestamp: 'not-a-timestamp' },
]) {
  assert.throws(
    () => normalizeProviderQuote('future-adapter', 'FREE_API', invalid),
    ProviderQuoteError,
    'Malformed provider quotes must fail before reaching feature consumers.',
  );
}

console.log('provider quote contract smoke: ok');
