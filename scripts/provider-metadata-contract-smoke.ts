import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HealthCheckedProvider, ProviderMetadata } from '../src/engine/dataProviders';
import { MockBrokerDataProvider, MockMarketDataProvider } from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';
import {
  evaluateProviderReadiness,
  providerSupportsMarket,
  validateProviderMetadata,
} from '../src/engine/providerPolicy';

const baseMetadata: ProviderMetadata = {
  id: 'provider-contract-smoke', name: 'Provider Contract Smoke', source: 'FREE_API', mode: 'EOD',
  isPaid: false, supportedMarkets: ['IDX'], supportsHistorical: true, supportsIntraday: false,
  supportsRealtime: false,
};

function expectMetadataIssue(metadata: ProviderMetadata, expectedFragment: string): void {
  const issues = validateProviderMetadata(metadata);
  assert.ok(issues.some(issue => issue.includes(expectedFragment)), `expected metadata issue containing "${expectedFragment}", got: ${issues.join(' | ')}`);
  const readiness = evaluateProviderReadiness(metadata, {
    status: 'HEALTHY', checkedAt: '2026-09-13T02:00:00.000Z', lastSuccessfulSyncAt: '2026-09-13T01:59:00.000Z',
  }, 'EOD_RESEARCH', 'IDX');
  assert.equal(readiness.allowed, false, 'contradictory provider metadata must fail closed');
}

expectMetadataIssue({ ...baseMetadata, id: 'eod-with-intraday', supportsIntraday: true }, 'EOD mode cannot declare intraday support');
expectMetadataIssue({ ...baseMetadata, id: 'delayed-with-realtime', mode: 'DELAYED', supportsIntraday: true, supportsRealtime: true }, 'real-time support requires REALTIME mode');
expectMetadataIssue({ ...baseMetadata, id: 'realtime-without-intraday', mode: 'REALTIME', supportsRealtime: true }, 'real-time support requires intraday support');
expectMetadataIssue({ ...baseMetadata, id: 'mock-mode-non-mock-source', mode: 'MOCK' }, 'MOCK mode requires MOCK_ENGINE source');
expectMetadataIssue({ ...baseMetadata, id: 'mock-source-non-mock-mode', source: 'MOCK_ENGINE' }, 'MOCK_ENGINE source requires MOCK mode');
expectMetadataIssue({ ...baseMetadata, id: 'canonical-market-duplicate', supportedMarkets: ['IDX', ' idx '] as unknown as readonly ['IDX'] }, 'canonical duplicates');

assert.deepEqual(validateProviderMetadata({ ...baseMetadata, id: 'valid-delayed', mode: 'DELAYED', supportsIntraday: true }), []);
assert.deepEqual(validateProviderMetadata({ ...baseMetadata, id: 'valid-mock', source: 'MOCK_ENGINE', mode: 'MOCK', supportsIntraday: true }), []);

const mixedCaseMarketMetadata = { ...baseMetadata, supportedMarkets: [' idx '] } as unknown as ProviderMetadata;
assert.equal(providerSupportsMarket(mixedCaseMarketMetadata, 'IDX'), true, 'market compatibility must normalize provider market casing');

const malformedRuntimeMetadata = {
  ...baseMetadata, source: 'UNTRUSTED_VENDOR', mode: 'STREAMING', supportsHistorical: 'yes',
  supportsIntraday: 1, supportsRealtime: 'false', isPaid: 'no', supportedMarkets: 'IDX',
} as unknown as ProviderMetadata;
const malformedIssues = validateProviderMetadata(malformedRuntimeMetadata);
assert.ok(malformedIssues.some(issue => issue.includes('source is not recognized')));
assert.ok(malformedIssues.some(issue => issue.includes('mode is not recognized')));
assert.ok(malformedIssues.some(issue => issue.includes('supportsHistorical must be boolean')));
assert.ok(malformedIssues.some(issue => issue.includes('supportedMarkets must be an array')));
assert.equal(evaluateProviderReadiness(malformedRuntimeMetadata, {
  status: 'HEALTHY', checkedAt: '2026-09-13T02:00:00.000Z', lastSuccessfulSyncAt: '2026-09-13T01:59:00.000Z',
}, 'EOD_RESEARCH', 'IDX').allowed, false, 'malformed runtime metadata must fail closed');

for (const provider of [new MockMarketDataProvider(), new MockBrokerDataProvider()]) {
  assert.equal(Object.isFrozen(provider.metadata), true, 'adapter metadata must be a frozen point-in-time configuration snapshot');
  assert.equal(Object.isFrozen(provider.metadata.supportedMarkets), true, 'nested supportedMarkets must also be frozen');
  assert.throws(() => {
    (provider.metadata as unknown as { source: string }).source = 'FREE_API';
  }, TypeError, 'downstream code must not rewrite adapter source identity');
  assert.throws(() => {
    (provider.metadata.supportedMarkets as unknown as string[]).push('US');
  }, TypeError, 'downstream code must not rewrite adapter market coverage');
}

async function expectHealthBoundaryFailure(metadata: ProviderMetadata, expectedFragment: string): Promise<void> {
  const provider: HealthCheckedProvider = {
    metadata,
    async getHealth() {
      return Object.freeze({ status: 'HEALTHY' as const, checkedAt: '2026-09-13T02:00:00.000Z' });
    },
  };
  const snapshot = await getProviderHealthSnapshot(provider, await provider.getHealth(), Date.parse('2026-09-13T02:00:00.000Z'));
  assert.equal(snapshot.health.status, 'UNAVAILABLE', 'contradictory capabilities must fail closed at shared health boundary');
  assert.ok(snapshot.health.message?.includes(expectedFragment), `expected health metadata context containing "${expectedFragment}"`);
}

await expectHealthBoundaryFailure({ ...baseMetadata, id: 'bad-eod', supportsIntraday: true }, 'mode/supportsIntraday');
await expectHealthBoundaryFailure({ ...baseMetadata, id: 'bad-realtime', mode: 'REALTIME', supportsRealtime: true, supportsIntraday: false }, 'supportsRealtime/supportsIntraday');

const researchPipelineSource = readFileSync(resolve(process.cwd(), 'src/engine/researchPipeline.ts'), 'utf8');
assert.ok(researchPipelineSource.includes('buildFeatureProvenance(vector, featureContext, providerStatus.metadata)'), 'feature provenance must use canonical metadata captured by provider status');
assert.ok(!researchPipelineSource.includes('buildFeatureProvenance(vector, featureContext, this.provider.metadata)'), 'feature provenance must not re-read raw provider metadata after readiness boundary');

console.log('Provider metadata contract smoke checks passed.');
