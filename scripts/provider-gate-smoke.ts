import { strict as assert } from 'node:assert';
import {
  assertProviderReady,
  getProviderReadiness,
  ProviderReadinessError,
} from '../src/engine/providerGate';
import { ProviderStatusSnapshot } from '../src/engine/providerPolicy';

const baseStatus: ProviderStatusSnapshot = {
  metadata: {
    id: 'TEST',
    name: 'Test Provider',
    source: 'MOCK_ENGINE',
    mode: 'MOCK',
    isPaid: false,
    supportsHistorical: true,
    supportsIntraday: true,
    supportsRealtime: false,
    supportedMarkets: ['IDX'],
  },
  health: {
    status: 'HEALTHY',
    checkedAt: '2026-09-12T09:00:00.000Z',
    message: 'test',
  },
  readiness: {
    HISTORICAL_BACKTEST: { useCase: 'HISTORICAL_BACKTEST', allowed: false, reasons: ['mock'], warnings: [] },
    EOD_RESEARCH: { useCase: 'EOD_RESEARCH', allowed: true, reasons: [], warnings: ['mock'] },
    PRECLOSE_SCREENING: { useCase: 'PRECLOSE_SCREENING', allowed: false, reasons: ['mock'], warnings: [] },
    LIVE_EXECUTION: { useCase: 'LIVE_EXECUTION', allowed: false, reasons: ['mock'], warnings: [] },
  },
  targetMarket: 'IDX',
  marketCompatible: true,
  capturedAt: '2026-09-12T09:00:00.000Z',
};

const gatedReadiness = getProviderReadiness(baseStatus, 'EOD_RESEARCH');
assert.equal(gatedReadiness.allowed, true);
assert.notEqual(gatedReadiness, baseStatus.readiness.EOD_RESEARCH, 'gate must return a defensive snapshot');
assert.equal(Object.isFrozen(gatedReadiness), true, 'gated readiness must be immutable');
assert.equal(Object.isFrozen(gatedReadiness.reasons), true, 'gated reasons must be immutable');
assert.equal(Object.isFrozen(gatedReadiness.warnings), true, 'gated warnings must be immutable');
baseStatus.readiness.EOD_RESEARCH.warnings.push('late mutation');
assert.deepEqual(gatedReadiness.warnings, ['mock'], 'post-gate source mutation must not alter enforced diagnostics');
baseStatus.readiness.EOD_RESEARCH.warnings.pop();

const rejectedStatus: ProviderStatusSnapshot = {
  ...baseStatus,
  metadata: { ...baseStatus.metadata, supportedMarkets: [...baseStatus.metadata.supportedMarkets] },
};
let rejectedError: ProviderReadinessError | undefined;
try {
  assertProviderReady(rejectedStatus, 'LIVE_EXECUTION');
} catch (error) {
  assert.ok(error instanceof ProviderReadinessError);
  rejectedError = error;
}
assert.ok(rejectedError);
assert.notEqual(rejectedError.provider, rejectedStatus.metadata, 'error must snapshot provider metadata');
assert.equal(Object.isFrozen(rejectedError.provider), true, 'rejected provider metadata must be immutable');
assert.equal(Object.isFrozen(rejectedError.provider.supportedMarkets), true, 'rejected provider markets must be immutable');
rejectedStatus.metadata.name = 'Mutated Provider';
assert.equal(rejectedError.provider.name, 'Test Provider', 'post-gate metadata mutation must not alter rejected provider identity');

for (const malformed of [
  { useCase: 'EOD_RESEARCH', allowed: 'yes', reasons: [], warnings: [] },
  { useCase: 'LIVE_EXECUTION', allowed: true, reasons: [], warnings: [] },
  { useCase: 'EOD_RESEARCH', allowed: true, reasons: 'none', warnings: [] },
  { useCase: 'EOD_RESEARCH', allowed: true, reasons: [], warnings: [42] },
  { useCase: 'EOD_RESEARCH', allowed: true, reasons: ['blocking reason'], warnings: [] },
  { useCase: 'EOD_RESEARCH', allowed: false, reasons: [], warnings: [] },
  { useCase: 'EOD_RESEARCH', allowed: false, reasons: ['   '], warnings: [] },
  { useCase: 'EOD_RESEARCH', allowed: true, reasons: [], warnings: ['   '] },
  null,
]) {
  const status = {
    ...baseStatus,
    readiness: {
      ...baseStatus.readiness,
      EOD_RESEARCH: malformed,
    },
  } as unknown as ProviderStatusSnapshot;

  const readiness = getProviderReadiness(status, 'EOD_RESEARCH');
  assert.equal(readiness.allowed, false, 'malformed readiness must fail closed');
  assert.equal(Object.isFrozen(readiness), true, 'fail-closed readiness must also be immutable');
  assert.match(readiness.reasons[0], /missing or malformed/i);
  assert.throws(
    () => assertProviderReady(status, 'EOD_RESEARCH'),
    (error: unknown) => error instanceof ProviderReadinessError,
  );
}

console.log('Provider gate smoke passed: readiness and rejected provider identity are immutable snapshots; contradictory, unexplained, and malformed runtime decisions fail closed before data ingestion.');
