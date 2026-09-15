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

assert.equal(getProviderReadiness(baseStatus, 'EOD_RESEARCH').allowed, true);

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
  assert.match(readiness.reasons[0], /missing or malformed/i);
  assert.throws(
    () => assertProviderReady(status, 'EOD_RESEARCH'),
    (error: unknown) => error instanceof ProviderReadinessError,
  );
}

console.log('Provider gate smoke passed: valid readiness survives; contradictory, unexplained, and malformed runtime decisions fail closed before data ingestion.');
