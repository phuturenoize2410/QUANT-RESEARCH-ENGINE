import { buildProviderStatusReadModel } from '../src/application/providerStatusApplication';
import { MockMarketDataProvider } from '../src/engine/dataProviders';

const nowMs = Date.parse('2026-09-17T00:00:00.000Z');
const provider = new MockMarketDataProvider();
const readModel = await buildProviderStatusReadModel(provider, {
  status: 'DEGRADED',
  checkedAt: '2026-09-17T00:00:00.000Z',
  message: 'Mock provider has no simulated universe loaded.',
}, nowMs);

if (readModel.provider.id !== 'mock-market-v1' || !readModel.isMock) {
  throw new Error('Application provider status must preserve canonical provider identity and explicit MOCK provenance.');
}

if (readModel.isPaid || readModel.isRealTime) {
  throw new Error('Mock provider status must not be presented as paid or real-time data.');
}

if (readModel.health.status !== 'DEGRADED') {
  throw new Error('Application provider status must preserve engine-normalized health state.');
}

if (readModel.capturedAt !== '2026-09-17T00:00:00.000Z') {
  throw new Error('Application provider status must preserve the canonical capture timestamp.');
}

if (!Object.isFrozen(readModel) || !Object.isFrozen(readModel.provider) || !Object.isFrozen(readModel.health)) {
  throw new Error('Provider status presentation snapshots must remain immutable across the application boundary.');
}

console.log('Provider-status application smoke passed: canonical provider health/provenance reaches presentation through an immutable application read model.');
