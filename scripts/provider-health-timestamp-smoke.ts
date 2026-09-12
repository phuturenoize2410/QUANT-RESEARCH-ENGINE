import { normalizeProviderHealth } from '../src/engine/providerHealth';
import type { ProviderHealth } from '../src/engine/dataProviders';

const nowMs = Date.parse('2026-09-09T06:30:00.000Z');

function normalize(health: ProviderHealth): ProviderHealth {
  return normalizeProviderHealth(health, nowMs);
}

const canonicalized = normalize({
  status: 'HEALTHY',
  checkedAt: '2026-09-09T13:30:00+07:00',
  lastSuccessfulSyncAt: '2026-09-09T13:29:30+07:00',
  staleAfterSeconds: 120,
});

if (canonicalized.checkedAt !== '2026-09-09T06:30:00.000Z') {
  throw new Error(`checkedAt must be canonical UTC ISO, got ${canonicalized.checkedAt}.`);
}
if (canonicalized.lastSuccessfulSyncAt !== '2026-09-09T06:29:30.000Z') {
  throw new Error(`lastSuccessfulSyncAt must be canonical UTC ISO, got ${canonicalized.lastSuccessfulSyncAt}.`);
}
if (canonicalized.status !== 'HEALTHY') {
  throw new Error('valid offset timestamps must not degrade provider health.');
}

const invalidCheckedAt = normalize({
  status: 'HEALTHY',
  checkedAt: 'not-a-date',
  lastSuccessfulSyncAt: '2026-09-09T06:29:30.000Z',
});

if (invalidCheckedAt.checkedAt !== undefined) {
  throw new Error('invalid checkedAt values must be removed from the canonical provider-health payload.');
}
if (invalidCheckedAt.status !== 'DEGRADED') {
  throw new Error('invalid checkedAt values must degrade provider health.');
}
if (!invalidCheckedAt.message?.includes('health check timestamp is invalid')) {
  throw new Error('invalid checkedAt values must expose an explicit diagnostic.');
}

const invalidLastSync = normalize({
  status: 'HEALTHY',
  checkedAt: '2026-09-09T06:30:00.000Z',
  lastSuccessfulSyncAt: 'broken-sync-time',
  staleAfterSeconds: 120,
});

if (invalidLastSync.lastSuccessfulSyncAt !== undefined) {
  throw new Error('invalid lastSuccessfulSyncAt values must be removed from the canonical provider-health payload.');
}
if (invalidLastSync.status !== 'DEGRADED') {
  throw new Error('invalid lastSuccessfulSyncAt values must degrade provider health.');
}
if (!invalidLastSync.message?.includes('Last successful sync timestamp is invalid')) {
  throw new Error('invalid lastSuccessfulSyncAt values must expose an explicit diagnostic.');
}

const unavailableInvalidTimestamp = normalize({
  status: 'UNAVAILABLE',
  checkedAt: 'invalid-date',
});

if (unavailableInvalidTimestamp.checkedAt !== undefined) {
  throw new Error('terminal UNAVAILABLE health must not retain malformed timestamps.');
}
if (unavailableInvalidTimestamp.status !== 'UNAVAILABLE') {
  throw new Error('canonicalization must preserve terminal UNAVAILABLE status.');
}

console.log('Provider health timestamp smoke passed: external timestamp payloads are canonicalized to UTC ISO and malformed values are stripped before downstream consumption.');
