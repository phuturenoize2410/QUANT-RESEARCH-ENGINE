import {
  captureProviderHealth,
  evaluateProviderReadiness,
  getProviderStatusSnapshot,
  normalizeProviderHealth,
  providerSupportsMarket,
  validateProviderMetadata,
} from '../src/engine/providerPolicy';
import { assertProviderReady, ProviderReadinessError } from '../src/engine/providerGate';
import {
  MockMarketDataProvider,
  type ProviderHealth,
  type ProviderMetadata,
} from '../src/engine/dataProviders';

const nowMs = Date.parse('2026-09-09T06:30:00.000Z');

function expectStatus(
  name: string,
  health: ProviderHealth,
  expectedStatus: ProviderHealth['status'],
  expectedMessageFragment?: string,
) {
  const normalized = normalizeProviderHealth(health, nowMs);
  if (normalized.status !== expectedStatus) {
    throw new Error(`${name}: expected ${expectedStatus}, got ${normalized.status}.`);
  }
  if (expectedMessageFragment && !normalized.message?.includes(expectedMessageFragment)) {
    throw new Error(`${name}: expected message containing "${expectedMessageFragment}".`);
  }
}

expectStatus('healthy payload', {
  status: 'HEALTHY',
  checkedAt: '2026-09-09T06:30:00.000Z',
  lastSuccessfulSyncAt: '2026-09-09T06:29:30.000Z',
  latencyMs: 120,
  staleAfterSeconds: 120,
}, 'HEALTHY');

expectStatus('stale payload', {
  status: 'HEALTHY',
  checkedAt: '2026-09-09T06:30:00.000Z',
  lastSuccessfulSyncAt: '2026-09-09T06:20:00.000Z',
  staleAfterSeconds: 120,
}, 'STALE', 'Freshness threshold exceeded.');

expectStatus('missing sync timestamp', {
  status: 'HEALTHY',
  checkedAt: '2026-09-09T06:30:00.000Z',
  staleAfterSeconds: 120,
}, 'DEGRADED', 'last successful sync time is unavailable');

expectStatus('invalid numeric metadata', {
  status: 'HEALTHY',
  checkedAt: '2026-09-09T06:30:00.000Z',
  latencyMs: Number.NaN,
  staleAfterSeconds: Number.POSITIVE_INFINITY,
}, 'DEGRADED', 'Invalid provider latency metadata ignored.');

expectStatus('future sync timestamp', {
  status: 'HEALTHY',
  checkedAt: '2026-09-09T06:30:00.000Z',
  lastSuccessfulSyncAt: '2026-09-09T07:00:00.000Z',
}, 'DEGRADED', 'unexpectedly in the future');

expectStatus('unavailable remains terminal', {
  status: 'UNAVAILABLE',
  checkedAt: 'invalid-date',
  latencyMs: Number.NaN,
}, 'UNAVAILABLE', 'health check timestamp is invalid');

const realtimeMetadata: ProviderMetadata = {
  id: 'realtime-smoke',
  name: 'Realtime Smoke Provider',
  source: 'IDX_FEED',
  mode: 'REALTIME',
  isPaid: false,
  supportedMarkets: ['IDX'],
  supportsHistorical: true,
  supportsIntraday: true,
  supportsRealtime: true,
};

const healthyLiveReadiness = evaluateProviderReadiness(realtimeMetadata, {
  status: 'HEALTHY',
  checkedAt: new Date().toISOString(),
  lastSuccessfulSyncAt: new Date().toISOString(),
}, 'LIVE_EXECUTION', 'IDX');

if (!healthyLiveReadiness.allowed) {
  throw new Error(`healthy realtime provider should be live-ready: ${healthyLiveReadiness.reasons.join(' ')}`);
}

const wrongMarketReadiness = evaluateProviderReadiness(realtimeMetadata, {
  status: 'HEALTHY',
  checkedAt: new Date().toISOString(),
  lastSuccessfulSyncAt: new Date().toISOString(),
}, 'EOD_RESEARCH', 'US');

if (wrongMarketReadiness.allowed) {
  throw new Error('IDX-only provider must not be eligible for a US research pipeline.');
}

if (!wrongMarketReadiness.reasons.some(reason => reason.includes('target market US'))) {
  throw new Error('market incompatibility must be explicit in provider readiness reasons.');
}

if (!providerSupportsMarket(realtimeMetadata, 'IDX') || providerSupportsMarket(realtimeMetadata, 'US')) {
  throw new Error('provider market capability helper must respect declared supported markets.');
}

const degradedLiveReadiness = evaluateProviderReadiness(realtimeMetadata, {
  status: 'DEGRADED',
  checkedAt: new Date().toISOString(),
  lastSuccessfulSyncAt: new Date().toISOString(),
  message: 'Upstream quote stream is partially degraded.',
}, 'LIVE_EXECUTION', 'IDX');

if (degradedLiveReadiness.allowed) {
  throw new Error('degraded realtime provider must not be eligible for live execution.');
}

if (!degradedLiveReadiness.reasons.some(reason => reason.includes('Degraded provider health'))) {
  throw new Error('degraded live readiness must explain the health gate.');
}

const contradictoryMetadata: ProviderMetadata = {
  ...realtimeMetadata,
  id: 'invalid-realtime-contract',
  supportsIntraday: false,
};

const metadataIssues = validateProviderMetadata(contradictoryMetadata);
if (!metadataIssues.some(issue => issue.includes('real-time support requires intraday support'))) {
  throw new Error('provider metadata validation must reject realtime support without intraday support.');
}

const contradictoryHistoricalReadiness = evaluateProviderReadiness(contradictoryMetadata, {
  status: 'HEALTHY',
  checkedAt: new Date().toISOString(),
  lastSuccessfulSyncAt: new Date().toISOString(),
}, 'HISTORICAL_BACKTEST', 'IDX');

if (contradictoryHistoricalReadiness.allowed) {
  throw new Error('contradictory provider metadata must be rejected before any use-case consumes it.');
}

const realtimeModeWithoutRealtimeSupport: ProviderMetadata = {
  ...realtimeMetadata,
  id: 'invalid-realtime-mode',
  supportsRealtime: false,
};

if (!validateProviderMetadata(realtimeModeWithoutRealtimeSupport)
  .some(issue => issue.includes('REALTIME mode requires real-time support'))) {
  throw new Error('provider metadata validation must reject REALTIME mode without realtime capability.');
}

const missingMarketMetadata: ProviderMetadata = {
  ...realtimeMetadata,
  id: 'missing-market-contract',
  supportedMarkets: [],
};

if (!validateProviderMetadata(missingMarketMetadata)
  .some(issue => issue.includes('at least one supported market'))) {
  throw new Error('provider metadata validation must require at least one supported market.');
}

const duplicateMarketMetadata: ProviderMetadata = {
  ...realtimeMetadata,
  id: 'duplicate-market-contract',
  supportedMarkets: ['IDX', 'IDX'],
};

if (!validateProviderMetadata(duplicateMarketMetadata)
  .some(issue => issue.includes('must not contain duplicates'))) {
  throw new Error('provider metadata validation must reject duplicate supported markets.');
}

const mockProvider = new MockMarketDataProvider();
const mockHealth: ProviderHealth = {
  status: 'HEALTHY',
  checkedAt: '2026-09-09T06:30:00.000Z',
  lastSuccessfulSyncAt: '2026-09-09T06:29:30.000Z',
};
const statusSnapshot = await getProviderStatusSnapshot(mockProvider, mockHealth, nowMs, 'IDX');

if (statusSnapshot.capturedAt !== '2026-09-09T06:30:00.000Z') {
  throw new Error('provider status snapshot must expose the canonical capture instant.');
}

if (statusSnapshot.health.status !== 'HEALTHY') {
  throw new Error('provider status snapshot must preserve normalized health.');
}

if (!statusSnapshot.marketCompatible || statusSnapshot.targetMarket !== 'IDX') {
  throw new Error('provider status snapshot must expose target-market compatibility.');
}

if (statusSnapshot.readiness.HISTORICAL_BACKTEST.allowed) {
  throw new Error('mock provider status snapshot must reject synthetic history as production backtest evidence.');
}

if (!statusSnapshot.readiness.EOD_RESEARCH.warnings.some(warning => warning.includes('simulated'))) {
  throw new Error('provider status snapshot must keep mock-data warnings visible to downstream consumers.');
}

class ThrowingHealthProvider extends MockMarketDataProvider {
  override async getHealth(): Promise<ProviderHealth> {
    throw new Error('upstream adapter timeout');
  }
}

const throwingProvider = new ThrowingHealthProvider();
const failedHealth = await captureProviderHealth(throwingProvider, nowMs);
if (failedHealth.status !== 'UNAVAILABLE') {
  throw new Error('provider health exceptions must become canonical UNAVAILABLE health.');
}
if (failedHealth.checkedAt !== '2026-09-09T06:30:00.000Z') {
  throw new Error('failed provider health capture must use the canonical capture instant.');
}
if (!failedHealth.message?.includes('upstream adapter timeout')) {
  throw new Error('failed provider health capture must preserve useful adapter failure context.');
}

const failedStatusSnapshot = await getProviderStatusSnapshot(throwingProvider, undefined, nowMs, 'IDX');
if (failedStatusSnapshot.health.status !== 'UNAVAILABLE') {
  throw new Error('provider status snapshot must contain health-probe failures instead of throwing generic errors.');
}
if (failedStatusSnapshot.readiness.EOD_RESEARCH.allowed) {
  throw new Error('an unavailable provider must be rejected before EOD data ingestion.');
}
if (!failedStatusSnapshot.readiness.EOD_RESEARCH.reasons.includes('Provider is unavailable.')) {
  throw new Error('health-probe failure must flow through canonical readiness reasons.');
}

let readinessError: ProviderReadinessError | undefined;
try {
  assertProviderReady(failedStatusSnapshot, 'EOD_RESEARCH');
} catch (error) {
  if (error instanceof ProviderReadinessError) {
    readinessError = error;
  } else {
    throw error;
  }
}

if (!readinessError) {
  throw new Error('provider readiness gate must throw a typed error for rejected providers.');
}
if (readinessError.status !== failedStatusSnapshot) {
  throw new Error('provider readiness error must preserve the exact canonical status snapshot that caused rejection.');
}
if (readinessError.status.health.status !== 'UNAVAILABLE'
  || readinessError.status.targetMarket !== 'IDX'
  || readinessError.status.capturedAt !== '2026-09-09T06:30:00.000Z') {
  throw new Error('provider readiness error must expose health, target market and canonical capture time for downstream status surfaces.');
}

console.log('Provider-health smoke passed: canonical status snapshots contain adapter health failures, survive readiness rejection, and enforce capability, health and target-market compatibility together.');
