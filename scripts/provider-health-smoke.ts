import { evaluateProviderReadiness, normalizeProviderHealth } from '../src/engine/providerPolicy';
import type { ProviderHealth, ProviderMetadata } from '../src/engine/dataProviders';

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
  supportsHistorical: true,
  supportsIntraday: true,
  supportsRealtime: true,
};

const healthyLiveReadiness = evaluateProviderReadiness(realtimeMetadata, {
  status: 'HEALTHY',
  checkedAt: new Date().toISOString(),
  lastSuccessfulSyncAt: new Date().toISOString(),
}, 'LIVE_EXECUTION');

if (!healthyLiveReadiness.allowed) {
  throw new Error(`healthy realtime provider should be live-ready: ${healthyLiveReadiness.reasons.join(' ')}`);
}

const degradedLiveReadiness = evaluateProviderReadiness(realtimeMetadata, {
  status: 'DEGRADED',
  checkedAt: new Date().toISOString(),
  lastSuccessfulSyncAt: new Date().toISOString(),
  message: 'Upstream quote stream is partially degraded.',
}, 'LIVE_EXECUTION');

if (degradedLiveReadiness.allowed) {
  throw new Error('degraded realtime provider must not be eligible for live execution.');
}

if (!degradedLiveReadiness.reasons.some(reason => reason.includes('Degraded provider health'))) {
  throw new Error('degraded live readiness must explain the health gate.');
}

console.log('Provider-health smoke passed: malformed health is degraded and degraded realtime feeds are blocked from live execution.');
