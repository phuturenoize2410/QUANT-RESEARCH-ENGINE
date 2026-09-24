import { strict as assert } from 'node:assert';
import type { HealthCheckedProvider, ProviderMetadata } from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';

const now = Date.parse('2026-09-24T10:00:00.000Z');
const longNotes = ` vendor diagnostics\n${'x'.repeat(400)} `;
const provider: HealthCheckedProvider = {
  metadata: {
    id: '  future-idx-provider\n',
    name: ' Future\tIDX Provider ',
    source: 'FREE_API',
    mode: 'EOD',
    isPaid: false,
    supportedMarkets: ['IDX'],
    supportsHistorical: true,
    supportsIntraday: false,
    supportsRealtime: false,
    notes: longNotes,
    vendorSecret: 'must-not-cross-boundary',
  } as ProviderMetadata & { vendorSecret: string },
  async getHealth() {
    return {
      status: 'HEALTHY' as const,
      checkedAt: new Date(now).toISOString(),
      lastSuccessfulSyncAt: new Date(now - 60_000).toISOString(),
    };
  },
};

const snapshot = await getProviderHealthSnapshot(provider, undefined, now);
assert.equal(snapshot.health.status, 'HEALTHY');
assert.equal(snapshot.metadata.id, 'future-idx-provider', 'provider id must be canonicalized');
assert.equal(snapshot.metadata.name, 'Future IDX Provider', 'provider name must be canonicalized');
assert.ok(snapshot.metadata.notes && snapshot.metadata.notes.length <= 240, 'provider notes must remain bounded');
assert.ok(!snapshot.metadata.notes?.includes('\n'), 'provider notes must be single-line canonical text');
assert.equal('vendorSecret' in snapshot.metadata, false, 'vendor-specific metadata must not cross the canonical boundary');
assert.equal(Object.isFrozen(snapshot.metadata), true, 'canonical metadata snapshot must be immutable');
assert.equal(Object.isFrozen(snapshot.metadata.supportedMarkets), true, 'canonical market coverage must be immutable');

const blankIdentityProvider: HealthCheckedProvider = {
  ...provider,
  metadata: { ...provider.metadata, id: '\n\t ' },
};
const blankIdentitySnapshot = await getProviderHealthSnapshot(blankIdentityProvider, undefined, now);
assert.equal(blankIdentitySnapshot.health.status, 'UNAVAILABLE', 'blank canonical provider identity must fail closed');
assert.ok(blankIdentitySnapshot.health.message?.includes('id'), 'failed metadata identity must retain bounded diagnostic context');
assert.equal(blankIdentitySnapshot.metadata.source, 'MOCK_ENGINE', 'malformed metadata must fall back to explicit mock-safe source');
assert.equal(blankIdentitySnapshot.metadata.mode, 'MOCK', 'malformed metadata must fall back to explicit mock-safe mode');
assert.equal(blankIdentitySnapshot.metadata.isPaid, false, 'malformed metadata must never imply paid access');

console.log('Provider metadata snapshot smoke checks passed.');
