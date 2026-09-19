import assert from 'node:assert/strict';
import { ProviderBarsError, normalizeProviderBars } from '../src/engine/providerBars';

const validBars = [
  {
    date: '2026-09-15',
    open: 100,
    high: 105,
    low: 99,
    close: 103,
    volume: 1_000,
    turnover: 103_000,
    nextOpen: 104,
    nextHigh: 108,
    nextLow: 102,
    nextClose: 107,
  },
  {
    date: '2026-09-16',
    open: 104,
    high: 108,
    low: 102,
    close: 107,
    volume: 1_200,
    turnover: 128_400,
  },
] as const;

const normalized = normalizeProviderBars('free-idx-history-adapter', validBars);
assert.deepEqual(normalized, validBars, 'Canonical history boundary must preserve valid observations.');
assert.notEqual(normalized, validBars, 'Canonical history boundary must detach the returned collection from adapter input.');
assert.notEqual(normalized[0], validBars[0], 'Canonical history boundary must detach each returned observation from adapter input.');
assert.ok(Object.isFrozen(normalized), 'Canonical history collection must be immutable after validation.');
assert.ok(Object.isFrozen(normalized[0]), 'Canonical history observations must be immutable after validation.');
assert.throws(
  () => normalized.push({ ...validBars[1], date: '2026-09-17' }),
  TypeError,
  'Feature consumers must not be able to append observations after provider validation.',
);
assert.throws(
  () => { normalized[0].close = 999; },
  TypeError,
  'Feature consumers must not be able to mutate validated provider evidence.',
);

const vendorExtendedBar = { ...validBars[0], vendorSequence: 17, transportDebug: 'adapter-only' };
const projected = normalizeProviderBars('vendor-schema-adapter', [vendorExtendedBar] as unknown as typeof validBars);
assert.deepEqual(
  Object.keys(projected[0]).sort(),
  Object.keys(validBars[0]).sort(),
  'Provider-only transport fields must not leak through the canonical DailyBar boundary.',
);
assert.equal('vendorSequence' in projected[0], false, 'Vendor-specific fields must remain behind the DataProvider adapter.');
assert.equal('transportDebug' in projected[0], false, 'Transport metadata must not become Feature Engine evidence implicitly.');

for (const invalidProviderId of ['', '   ']) {
  assert.throws(
    () => normalizeProviderBars(invalidProviderId, validBars),
    (error: unknown) => error instanceof ProviderBarsError && error.index === -1,
    'Historical provider evidence without a usable provider identity must fail closed before reaching feature consumers.',
  );
}

for (const controlCharacterProviderId of ['provider\nshadow', 'provider\tshadow', `provider${String.fromCharCode(0)}shadow`]) {
  assert.throws(
    () => normalizeProviderBars(controlCharacterProviderId, validBars),
    (error: unknown) => error instanceof ProviderBarsError && error.index === -1,
    'Historical provider identity control characters must fail closed before health/status or feature consumers see the identity.',
  );
}

for (const malformedPayload of [null, undefined, {}, 'not-bars']) {
  assert.throws(
    () => normalizeProviderBars('runtime-payload-adapter', malformedPayload as unknown as typeof validBars),
    (error: unknown) => error instanceof ProviderBarsError && error.providerId === 'runtime-payload-adapter' && error.index === -1,
    'Malformed historical payload containers must fail at the provider boundary with attributable diagnostics.',
  );
}

for (const malformedEntry of [null, undefined, 'not-a-bar', 42, []]) {
  assert.throws(
    () => normalizeProviderBars('runtime-entry-adapter', [malformedEntry] as unknown as typeof validBars),
    (error: unknown) => error instanceof ProviderBarsError && error.providerId === 'runtime-entry-adapter' && error.index === 0,
    'Malformed historical array members must fail at the provider boundary with attributable diagnostics.',
  );
}

for (const malformedDate of [20260915, ['2026-09-15'], { toString: () => '2026-09-15' }]) {
  const bar = { ...validBars[0], date: malformedDate };
  assert.throws(
    () => normalizeProviderBars('runtime-date-adapter', [bar] as unknown as typeof validBars),
    (error: unknown) => error instanceof ProviderBarsError && error.providerId === 'runtime-date-adapter' && error.index === 0,
    'Coercible non-string dates must fail inside the provider boundary rather than leaking native runtime errors.',
  );
}

for (const invalid of [
  [{ ...validBars[0], date: 'not-a-date' }],
  [{ ...validBars[0], date: '2026-02-30' }],
  [{ ...validBars[0], date: '2025-02-29' }],
  [{ ...validBars[0], date: '2026-13-01' }],
  [{ ...validBars[0], close: Number.NaN }],
  [{ ...validBars[0], volume: -1 }],
  [{ ...validBars[0], high: 98 }],
  [{ ...validBars[0], nextLow: 109 }],
  [validBars[1], validBars[0]],
  [validBars[0], validBars[0]],
]) {
  assert.throws(
    () => normalizeProviderBars('future-history-adapter', invalid),
    ProviderBarsError,
    'Malformed provider history must fail before reaching feature consumers.',
  );
}

for (const requiredField of ['open', 'high', 'low', 'close', 'volume', 'turnover'] as const) {
  const malformed = { ...validBars[0] } as Record<string, unknown>;
  delete malformed[requiredField];
  assert.throws(
    () => normalizeProviderBars('runtime-schema-drift-adapter', [malformed as unknown as (typeof validBars)[number]]),
    ProviderBarsError,
    `Missing required ${requiredField} must fail closed before reaching feature consumers.`,
  );
}

assert.doesNotThrow(
  () => normalizeProviderBars('zero-activity-history-adapter', [{ ...validBars[0], volume: 0, turnover: 0 }]),
  'Zero volume/turnover are legitimate observations and must not be confused with missing provider evidence.',
);

assert.doesNotThrow(
  () => normalizeProviderBars('leap-year-history-adapter', [{ ...validBars[0], date: '2024-02-29' }]),
  'Canonical history boundary must preserve legitimate leap-day observations.',
);

assert.throws(
  () => normalizeProviderBars('identified-history-adapter', [{ ...validBars[0], volume: -1 }]),
  (error: unknown) => error instanceof ProviderBarsError && error.providerId === 'identified-history-adapter' && error.index === 0,
  'Historical validation failures must retain provider and observation identity for health/status diagnostics.',
);

assert.throws(
  () => normalizeProviderBars('  future-history-adapter  ', [{ ...validBars[0], volume: -1 }]),
  (error: unknown) => error instanceof ProviderBarsError && error.providerId === 'future-history-adapter' && error.index === 0,
  'Historical diagnostics must use one canonical provider identity even when adapter configuration contains boundary whitespace.',
);

console.log('provider bars contract smoke: ok');
