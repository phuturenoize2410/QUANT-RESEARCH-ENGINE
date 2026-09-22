import assert from 'node:assert/strict';
import {
  MARKET_DATA_SOURCES,
  PROVIDER_HEALTH_STATUSES,
  PROVIDER_MODES,
} from '../src/engine/providerContracts';

assert.deepEqual(
  MARKET_DATA_SOURCES,
  ['MOCK_ENGINE', 'GOOGLE_FINANCE', 'FREE_API', 'IDX_FEED', 'BROKER_API'],
  'Provider source vocabulary must remain centralized and explicit.',
);
assert.deepEqual(
  PROVIDER_MODES,
  ['MOCK', 'DELAYED', 'EOD', 'REALTIME'],
  'Provider mode vocabulary must remain centralized and explicit.',
);
assert.deepEqual(
  PROVIDER_HEALTH_STATUSES,
  ['HEALTHY', 'DEGRADED', 'STALE', 'UNAVAILABLE'],
  'Provider health vocabulary must remain centralized and explicit.',
);

for (const [label, values] of [
  ['market data sources', MARKET_DATA_SOURCES],
  ['provider modes', PROVIDER_MODES],
  ['provider health statuses', PROVIDER_HEALTH_STATUSES],
] as const) {
  assert.equal(
    new Set(values).size,
    values.length,
    `${label} must not contain duplicate canonical values.`,
  );
}

console.log('provider-vocabulary-smoke: ok');
