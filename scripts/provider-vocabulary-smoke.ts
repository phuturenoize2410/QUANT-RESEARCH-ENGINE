import assert from 'node:assert/strict';
import {
  MARKET_DATA_SOURCES,
  PROVIDER_HEALTH_STATUSES,
  PROVIDER_MODES,
  isMarketDataSource,
  isProviderHealthStatus,
  isProviderMode,
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

for (const source of MARKET_DATA_SOURCES) {
  assert.equal(isMarketDataSource(source), true, `Canonical provider source ${source} must pass its runtime guard.`);
}
for (const mode of PROVIDER_MODES) {
  assert.equal(isProviderMode(mode), true, `Canonical provider mode ${mode} must pass its runtime guard.`);
}
for (const status of PROVIDER_HEALTH_STATUSES) {
  assert.equal(isProviderHealthStatus(status), true, `Canonical provider health status ${status} must pass its runtime guard.`);
}

for (const value of ['GOOGLE', 'MOCK_ENGINE ', '', null, undefined, 1]) {
  assert.equal(isMarketDataSource(value), false, `Non-canonical provider source ${String(value)} must fail closed.`);
}
for (const value of ['LIVE', 'REALTIME ', '', null, undefined, 1]) {
  assert.equal(isProviderMode(value), false, `Non-canonical provider mode ${String(value)} must fail closed.`);
}
for (const value of ['OK', 'HEALTHY ', '', null, undefined, 1]) {
  assert.equal(isProviderHealthStatus(value), false, `Non-canonical provider health status ${String(value)} must fail closed.`);
}

console.log('provider-vocabulary-smoke: ok');
