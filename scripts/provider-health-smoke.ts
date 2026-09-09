import { normalizeProviderHealth } from '../src/engine/providerPolicy';
import type { ProviderHealth } from '../src/engine/dataProviders';

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

console.log('Provider-health smoke passed: malformed freshness metadata is safely degraded or rejected.');
