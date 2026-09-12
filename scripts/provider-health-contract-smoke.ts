import { normalizeProviderHealth } from '../src/engine/providerHealth';
import type { ProviderHealth } from '../src/engine/dataProviders';

const nowMs = Date.parse('2026-09-12T00:00:00.000Z');

const malformedRuntimePayload = {
  status: 'OK',
  checkedAt: '2026-09-12T00:00:00.000Z',
  lastSuccessfulSyncAt: '2026-09-11T23:59:30.000Z',
  latencyMs: 80,
} as unknown as ProviderHealth;

const normalized = normalizeProviderHealth(malformedRuntimePayload, nowMs);

if (normalized.status !== 'UNAVAILABLE') {
  throw new Error('Unknown runtime provider status values must fail closed as UNAVAILABLE.');
}

if (!normalized.message?.includes('Invalid provider health status')) {
  throw new Error('Unknown runtime provider status values must expose an explicit normalization reason.');
}

const valid = normalizeProviderHealth({
  status: 'HEALTHY',
  checkedAt: '2026-09-12T00:00:00.000Z',
  lastSuccessfulSyncAt: '2026-09-11T23:59:30.000Z',
  latencyMs: 80,
}, nowMs);

if (valid.status !== 'HEALTHY') {
  throw new Error('Valid provider health status values must remain unchanged by runtime normalization.');
}

console.log('Provider-health contract smoke passed: unknown runtime status values fail closed before downstream research layers consume them.');
