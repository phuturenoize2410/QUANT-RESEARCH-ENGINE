import {
  MockBrokerDataProvider,
  MockMarketDataProvider,
  type ProviderHealth,
} from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';

const nowMs = Date.parse('2026-09-11T12:00:00.000Z');

const injectedHealth: ProviderHealth = {
  status: 'HEALTHY',
  checkedAt: '2026-09-11T12:00:00.000Z',
  lastSuccessfulSyncAt: '2026-09-11T11:59:30.000Z',
  latencyMs: 25,
  staleAfterSeconds: 120,
};

const marketProvider = new MockMarketDataProvider();
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

const brokerProvider = new MockBrokerDataProvider();
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

console.log('Provider-health snapshot smoke passed: market and broker adapters share one vendor-neutral metadata/health/capture envelope, injected payloads are normalized, and adapter failures are contained as canonical UNAVAILABLE state.');
