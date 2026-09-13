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

const nonStringCheckedAt = normalizeProviderHealth({
  status: 'HEALTHY',
  checkedAt: nowMs,
} as unknown as ProviderHealth, nowMs);

if (nonStringCheckedAt.status !== 'UNAVAILABLE') {
  throw new Error('Non-string provider health timestamps must fail closed as UNAVAILABLE.');
}

if (!nonStringCheckedAt.message?.includes('health check timestamp is invalid')) {
  throw new Error('Malformed provider health timestamps must expose an explicit fail-closed reason.');
}

const malformedOptionalFields = normalizeProviderHealth({
  status: 'HEALTHY',
  checkedAt: '2026-09-12T00:00:00.000Z',
  lastSuccessfulSyncAt: 123,
  latencyMs: 'fast',
  staleAfterSeconds: '300',
  message: { text: 'healthy' },
} as unknown as ProviderHealth, nowMs);

if (malformedOptionalFields.status !== 'DEGRADED') {
  throw new Error('Malformed optional provider health fields must degrade an otherwise valid health snapshot.');
}

if (
  typeof malformedOptionalFields.message !== 'string' ||
  !malformedOptionalFields.message.includes('Invalid provider health message ignored.') ||
  !malformedOptionalFields.message.includes('Invalid provider latency metadata ignored.') ||
  !malformedOptionalFields.message.includes('Invalid freshness threshold ignored.') ||
  !malformedOptionalFields.message.includes('Last successful sync timestamp is invalid.')
) {
  throw new Error('Malformed optional provider health fields must be sanitized with explicit normalization reasons.');
}

if (
  malformedOptionalFields.lastSuccessfulSyncAt !== undefined ||
  malformedOptionalFields.latencyMs !== undefined ||
  malformedOptionalFields.staleAfterSeconds !== undefined
) {
  throw new Error('Malformed optional provider health values must not escape the provider boundary.');
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

console.log('Provider-health contract smoke passed: malformed runtime health payloads are sanitized or fail closed before downstream research layers consume them.');
