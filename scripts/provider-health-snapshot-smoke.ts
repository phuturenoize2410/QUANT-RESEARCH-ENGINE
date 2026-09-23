import {
  MockBrokerDataProvider,
  MockMarketDataProvider,
  type ProviderHealth,
} from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';

const nowMs = Date.parse('2026-09-11T12:00:00.000Z');

const injectedHealth = {
  status: 'HEALTHY',
  checkedAt: '2026-09-11T12:00:00.000Z',
  lastSuccessfulSyncAt: '2026-09-11T11:59:30.000Z',
  latencyMs: 25,
  staleAfterSeconds: 120,
} satisfies ProviderHealth;

const marketProvider = new MockMarketDataProvider();
const rawMarketHealth = await marketProvider.getHealth();
if (!Object.isFrozen(rawMarketHealth)) {
  throw new Error('market adapter getHealth() must return an immutable observation snapshot.');
}
const marketSnapshot = await getProviderHealthSnapshot(marketProvider, injectedHealth, nowMs);

if (marketSnapshot.metadata.id !== marketProvider.metadata.id) {
  throw new Error('shared provider health snapshot must preserve market-provider metadata.');
}
if (marketSnapshot.health.status !== 'HEALTHY') {
  throw new Error('shared provider health snapshot must preserve normalized healthy state.');
}
if (marketSnapshot.capturedAt !== '2026-09-11T12:00:00.000Z') {
  throw new Error('shared provider health snapshot must expose the canonical capture instant.');
}

const capturedProviderName = marketSnapshot.metadata.name;
marketProvider.metadata.name = 'Mutated adapter metadata';
if (marketSnapshot.metadata.name !== capturedProviderName) {
  throw new Error('provider health snapshots must retain point-in-time metadata instead of a live adapter reference.');
}
if (!Object.isFrozen(marketSnapshot.metadata) || !Object.isFrozen(marketSnapshot.metadata.supportedMarkets)) {
  throw new Error('provider health snapshot metadata and supported-market capability lists must be immutable.');
}

const capturedLatency = marketSnapshot.health.latencyMs;
injectedHealth.latencyMs = 999;
if (marketSnapshot.health.latencyMs !== capturedLatency) {
  throw new Error('provider health snapshots must retain point-in-time health instead of a caller-owned health reference.');
}
if (!Object.isFrozen(marketSnapshot.health) || !Object.isFrozen(marketSnapshot)) {
  throw new Error('provider health payloads and the snapshot envelope itself must be immutable.');
}

const brokerProvider = new MockBrokerDataProvider();
const rawBrokerHealth = await brokerProvider.getHealth();
if (!Object.isFrozen(rawBrokerHealth)) {
  throw new Error('broker adapter getHealth() must return an immutable observation snapshot.');
}
const brokerSnapshot = await getProviderHealthSnapshot(brokerProvider, injectedHealth, nowMs);

if (brokerSnapshot.metadata.id !== brokerProvider.metadata.id) {
  throw new Error('shared provider health snapshot must preserve broker-provider metadata.');
}
if (brokerSnapshot.health.status !== 'HEALTHY') {
  throw new Error('broker providers must use the same canonical health snapshot semantics as market providers.');
}

const malformedHealth: ProviderHealth = {
  status: 'HEALTHY',
  checkedAt: '2026-09-11T12:00:00.000Z',
  latencyMs: Number.NaN,
};
const normalizedSnapshot = await getProviderHealthSnapshot(brokerProvider, malformedHealth, nowMs);

if (normalizedSnapshot.health.status !== 'DEGRADED') {
  throw new Error('injected provider health must still pass through canonical normalization.');
}
if (!normalizedSnapshot.health.message?.includes('Invalid provider latency metadata ignored.')) {
  throw new Error('shared provider health snapshots must preserve canonical normalization context.');
}

const canonicalMetadataProvider = new MockMarketDataProvider();
const canonicalMetadata = canonicalMetadataProvider.metadata as unknown as {
  id: string;
  name: string;
  notes?: string;
  supportedMarkets: string[];
};
canonicalMetadata.id = '  future-idx-adapter  ';
canonicalMetadata.name = '  Future IDX Adapter  ';
canonicalMetadata.notes = '  Vendor-neutral test adapter  ';
canonicalMetadata.supportedMarkets = [' idx ', ' us '];
const canonicalMetadataSnapshot = await getProviderHealthSnapshot(
  canonicalMetadataProvider,
  {
    status: 'HEALTHY',
    checkedAt: '2026-09-11T12:00:00.000Z',
  },
  nowMs,
);

if (canonicalMetadataSnapshot.health.status !== 'HEALTHY') {
  throw new Error('valid provider metadata formatting differences must canonicalize without degrading health.');
}
if (canonicalMetadataSnapshot.metadata.id !== 'future-idx-adapter') {
  throw new Error('provider ids must be trimmed at the shared provider boundary.');
}
if (canonicalMetadataSnapshot.metadata.name !== 'Future IDX Adapter') {
  throw new Error('provider names must be trimmed at the shared provider boundary.');
}
if (canonicalMetadataSnapshot.metadata.notes !== 'Vendor-neutral test adapter') {
  throw new Error('provider notes must be trimmed before downstream status/UI consumption.');
}
if (canonicalMetadataSnapshot.metadata.supportedMarkets.join(',') !== 'IDX,US') {
  throw new Error('supported market identities must be trimmed and uppercased at the provider boundary.');
}

const duplicateMarketProvider = new MockMarketDataProvider();
const duplicateMarketMetadata = duplicateMarketProvider.metadata as unknown as { supportedMarkets: string[] };
duplicateMarketMetadata.supportedMarkets = [' idx ', 'IDX', ' us '];
const duplicateMarketSnapshot = await getProviderHealthSnapshot(
  duplicateMarketProvider,
  {
    status: 'HEALTHY',
    checkedAt: '2026-09-11T12:00:00.000Z',
  },
  nowMs,
);
if (duplicateMarketSnapshot.health.status !== 'UNAVAILABLE') {
  throw new Error('canonical duplicate market identities must fail closed at the shared provider-health boundary.');
}
if (!duplicateMarketSnapshot.health.message?.includes('supportedMarkets')) {
  throw new Error('duplicate supported-market failures must preserve actionable metadata context.');
}

const malformedMetadataProvider = new MockMarketDataProvider();
const malformedMetadata = malformedMetadataProvider.metadata as unknown as {
  source: unknown;
  supportedMarkets: unknown;
};
malformedMetadata.source = 'UNKNOWN_FEED';
malformedMetadata.supportedMarkets = undefined;
const malformedMetadataSnapshot = await getProviderHealthSnapshot(
  malformedMetadataProvider,
  {
    status: 'HEALTHY',
    checkedAt: '2026-09-11T12:00:00.000Z',
  },
  nowMs,
);

if (malformedMetadataSnapshot.health.status !== 'UNAVAILABLE') {
  throw new Error('malformed provider metadata must fail closed before downstream research layers use the adapter.');
}
if (
  !malformedMetadataSnapshot.health.message?.includes('source') ||
  !malformedMetadataSnapshot.health.message?.includes('supportedMarkets')
) {
  throw new Error('metadata validation failures must preserve actionable invalid-field context.');
}
if (malformedMetadataSnapshot.metadata.supportedMarkets.length !== 0) {
  throw new Error('invalid supported-market payloads must be sanitized to an empty capability list.');
}
if (!Object.isFrozen(malformedMetadataSnapshot.metadata.supportedMarkets)) {
  throw new Error('sanitized provider capability lists must remain immutable.');
}

const contradictoryRealtimeProvider = new MockMarketDataProvider();
const contradictoryRealtimeMetadata = contradictoryRealtimeProvider.metadata as unknown as {
  source: 'FREE_API';
  mode: 'EOD';
  supportsRealtime: boolean;
};
contradictoryRealtimeMetadata.source = 'FREE_API';
contradictoryRealtimeMetadata.mode = 'EOD';
contradictoryRealtimeMetadata.supportsRealtime = true;
const contradictoryRealtimeSnapshot = await getProviderHealthSnapshot(
  contradictoryRealtimeProvider,
  {
    status: 'HEALTHY',
    checkedAt: '2026-09-11T12:00:00.000Z',
  },
  nowMs,
);

if (contradictoryRealtimeSnapshot.health.status !== 'UNAVAILABLE') {
  throw new Error('provider metadata must fail closed when EOD/delayed capability claims contradict supportsRealtime.');
}
if (!contradictoryRealtimeSnapshot.health.message?.includes('mode/supportsRealtime')) {
  throw new Error('contradictory realtime capability failures must expose actionable metadata context.');
}

const contradictoryMockProvider = new MockMarketDataProvider();
const contradictoryMockMetadata = contradictoryMockProvider.metadata as unknown as {
  source: 'MOCK_ENGINE';
  mode: 'REALTIME';
  supportsRealtime: boolean;
};
contradictoryMockMetadata.source = 'MOCK_ENGINE';
contradictoryMockMetadata.mode = 'REALTIME';
contradictoryMockMetadata.supportsRealtime = true;
const contradictoryMockSnapshot = await getProviderHealthSnapshot(
  contradictoryMockProvider,
  {
    status: 'HEALTHY',
    checkedAt: '2026-09-11T12:00:00.000Z',
  },
  nowMs,
);

if (contradictoryMockSnapshot.health.status !== 'UNAVAILABLE') {
  throw new Error('MOCK_ENGINE adapters must not claim a non-MOCK delivery mode.');
}
if (!contradictoryMockSnapshot.health.message?.includes('source/mode')) {
  throw new Error('mock/source mode contradictions must expose actionable metadata context.');
}

class ThrowingBrokerProvider extends MockBrokerDataProvider {
  override async getHealth(): Promise<ProviderHealth> {
    throw new Error('broker status endpoint unavailable');
  }
}

const failedSnapshot = await getProviderHealthSnapshot(new ThrowingBrokerProvider(), undefined, nowMs);
if (failedSnapshot.health.status !== 'UNAVAILABLE') {
  throw new Error('shared provider health snapshot must contain provider health exceptions as UNAVAILABLE.');
}
if (!failedSnapshot.health.message?.includes('broker status endpoint unavailable')) {
  throw new Error('shared provider health snapshot must preserve useful adapter failure context.');
}
if (failedSnapshot.capturedAt !== '2026-09-11T12:00:00.000Z') {
  throw new Error('failed health captures must retain the same canonical capture instant.');
}

console.log('Provider-health snapshot smoke passed: market and broker adapters emit immutable raw health observations and share one immutable point-in-time metadata/health/capture envelope, provider identity/capabilities are canonicalized before downstream use, canonical duplicate market identities and contradictory capability claims fail closed, malformed metadata fails closed, and adapter failures are contained as canonical UNAVAILABLE state.');