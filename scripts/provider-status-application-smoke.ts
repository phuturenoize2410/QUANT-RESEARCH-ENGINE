import { buildProviderStatusReadModel } from '../src/application/providerStatusApplication';
import { MockMarketDataProvider, type HealthCheckedProvider } from '../src/engine/dataProviders';

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

if (readModel.dataDisclosure !== 'MOCK / SYNTHETIC DATA — NOT FOR LIVE TRADING' || readModel.dataReadiness !== 'RESEARCH_ONLY') {
  throw new Error('MOCK providers must remain explicitly synthetic and research-only regardless of health state.');
}

if (readModel.health.status !== 'DEGRADED') {
  throw new Error('Application provider status must preserve engine-normalized health state.');
}

if (readModel.isHealthy || !readModel.requiresAttention || readModel.isUnavailable || readModel.isStale) {
  throw new Error('Application provider status must interpret DEGRADED presentation state centrally and consistently.');
}

if (readModel.capturedAt !== '2026-09-17T00:00:00.000Z') {
  throw new Error('Application provider status must preserve the canonical capture timestamp.');
}

if (!Object.isFrozen(readModel) || !Object.isFrozen(readModel.provider) || !Object.isFrozen(readModel.health)) {
  throw new Error('Provider status presentation snapshots must remain immutable across the application boundary.');
}

const staleReadModel = await buildProviderStatusReadModel(provider, {
  status: 'STALE',
  checkedAt: '2026-09-17T00:00:00.000Z',
  lastSuccessfulSyncAt: '2026-09-16T23:00:00.000Z',
  staleAfterSeconds: 60,
}, nowMs);

if (!staleReadModel.isStale || !staleReadModel.requiresAttention || staleReadModel.isHealthy || staleReadModel.isUnavailable || staleReadModel.dataReadiness !== 'RESEARCH_ONLY') {
  throw new Error('Application provider status must expose STALE while preserving MOCK research-only provenance.');
}

const unavailableReadModel = await buildProviderStatusReadModel(provider, {
  status: 'UNAVAILABLE',
  checkedAt: '2026-09-17T00:00:00.000Z',
}, nowMs);

if (!unavailableReadModel.isUnavailable || !unavailableReadModel.requiresAttention || unavailableReadModel.isHealthy || unavailableReadModel.dataReadiness !== 'RESEARCH_ONLY') {
  throw new Error('MOCK provider readiness must never imply live usability, even when unavailable.');
}

const realProvider: HealthCheckedProvider = {
  metadata: Object.freeze({
    id: 'future-free-eod',
    name: 'Future Free EOD Adapter',
    source: 'FREE_API',
    mode: 'EOD',
    isPaid: false,
    supportedMarkets: Object.freeze(['IDX'] as const),
    supportsHistorical: true,
    supportsIntraday: false,
    supportsRealtime: false,
  }),
  async getHealth() {
    return Object.freeze({ status: 'HEALTHY' as const, checkedAt: '2026-09-17T00:00:00.000Z' });
  },
};

const readyReadModel = await buildProviderStatusReadModel(realProvider, undefined, nowMs);
if (readyReadModel.dataReadiness !== 'READY' || readyReadModel.isMock) {
  throw new Error('Healthy non-mock providers must surface as READY without being mislabeled as mock.');
}

const cautionReadModel = await buildProviderStatusReadModel(realProvider, {
  status: 'DEGRADED', checkedAt: '2026-09-17T00:00:00.000Z',
}, nowMs);
if (cautionReadModel.dataReadiness !== 'CAUTION') {
  throw new Error('Degraded non-mock providers must surface as CAUTION.');
}

const blockedReadModel = await buildProviderStatusReadModel(realProvider, {
  status: 'STALE', checkedAt: '2026-09-17T00:00:00.000Z',
}, nowMs);
if (blockedReadModel.dataReadiness !== 'BLOCKED') {
  throw new Error('Stale non-mock providers must fail closed as BLOCKED at the application boundary.');
}

console.log('Provider-status application smoke passed: provider provenance, health, disclosure and readiness reach UI through one immutable application read model.');
