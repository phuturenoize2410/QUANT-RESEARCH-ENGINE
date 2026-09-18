import { buildProviderStatusReadModel } from '../src/application/providerStatusApplication';
import { MockMarketDataProvider, type HealthCheckedProvider } from '../src/engine/dataProviders';

const nowMs = Date.parse('2026-09-17T00:00:00.000Z');
const provider = new MockMarketDataProvider();
const readModel = await buildProviderStatusReadModel(provider, {
  status: 'DEGRADED',
  checkedAt: '2026-09-17T00:00:00.000Z',
  message: 'Mock provider has no simulated universe loaded.',
}, nowMs, 'IDX');

if (readModel.provider.id !== 'mock-market-v1' || !readModel.isMock) throw new Error('Application provider status must preserve canonical provider identity and explicit MOCK provenance.');
if (readModel.requestedMarket !== 'IDX' || !readModel.supportsRequestedMarket || readModel.marketBlockReason !== null) throw new Error('Application provider status must preserve explicit market compatibility for supported markets.');
if (readModel.isPaid || readModel.isRealTime || readModel.canServeRealtime) throw new Error('Mock provider status must never be presented as paid or live-capable.');
if (readModel.dataDisclosure !== 'MOCK / SYNTHETIC DATA — NOT FOR LIVE TRADING' || readModel.dataReadiness !== 'RESEARCH_ONLY') throw new Error('MOCK providers must remain explicitly synthetic and research-only regardless of health state.');
if (readModel.statusMessage !== 'Mock provider has no simulated universe loaded.') throw new Error('Provider-supplied health evidence must reach presentation through the application status message.');
if (!readModel.canServeHistoricalResearch || readModel.historicalBlockReason !== null) throw new Error('Healthy/degraded mock historical capability must remain usable for research without implying live readiness.');
if (readModel.realtimeBlockReason !== 'RESEARCH_ONLY') throw new Error('Mock realtime denial must preserve research-only provenance rather than appearing as a generic provider failure.');
if (readModel.health.status !== 'DEGRADED') throw new Error('Application provider status must preserve engine-normalized health state.');
if (readModel.isHealthy || !readModel.requiresAttention || readModel.isUnavailable || readModel.isStale) throw new Error('Application provider status must interpret DEGRADED presentation state centrally and consistently.');
if (readModel.capturedAt !== '2026-09-17T00:00:00.000Z') throw new Error('Application provider status must preserve the canonical capture timestamp.');
if (!Object.isFrozen(readModel) || !Object.isFrozen(readModel.provider) || !Object.isFrozen(readModel.health)) throw new Error('Provider status presentation snapshots must remain immutable across the application boundary.');

const staleReadModel = await buildProviderStatusReadModel(provider, {
  status: 'STALE', checkedAt: '2026-09-17T00:00:00.000Z', lastSuccessfulSyncAt: '2026-09-16T23:00:00.000Z', staleAfterSeconds: 60,
}, nowMs, 'IDX');
if (!staleReadModel.isStale || !staleReadModel.requiresAttention || staleReadModel.isHealthy || staleReadModel.isUnavailable || staleReadModel.dataReadiness !== 'RESEARCH_ONLY' || staleReadModel.canServeHistoricalResearch || staleReadModel.historicalBlockReason !== 'HEALTH_BLOCKED') throw new Error('STALE providers must fail closed for capability use while preserving an explicit health-block reason.');
if (staleReadModel.statusMessage !== 'Synthetic provider available for research only. Not for live trading.') throw new Error('Mock fallback status messaging must preserve research-only provenance even when health is stale.');

const unavailableReadModel = await buildProviderStatusReadModel(provider, { status: 'UNAVAILABLE', checkedAt: '2026-09-17T00:00:00.000Z' }, nowMs, 'IDX');
if (!unavailableReadModel.isUnavailable || !unavailableReadModel.requiresAttention || unavailableReadModel.isHealthy || unavailableReadModel.dataReadiness !== 'RESEARCH_ONLY' || unavailableReadModel.canServeHistoricalResearch || unavailableReadModel.historicalBlockReason !== 'HEALTH_BLOCKED') throw new Error('Unavailable providers must fail closed for capability use with an explicit health-block reason.');

const realProvider: HealthCheckedProvider = {
  metadata: Object.freeze({ id: 'future-free-eod', name: 'Future Free EOD Adapter', source: 'FREE_API', mode: 'EOD', isPaid: false, supportedMarkets: Object.freeze(['IDX'] as const), supportsHistorical: true, supportsIntraday: false, supportsRealtime: false }),
  async getHealth() { return Object.freeze({ status: 'HEALTHY' as const, checkedAt: '2026-09-17T00:00:00.000Z', lastSuccessfulSyncAt: '2026-09-17T00:00:00.000Z', staleAfterSeconds: 300 }); },
};
const readyReadModel = await buildProviderStatusReadModel(realProvider, undefined, nowMs, 'IDX');
if (readyReadModel.dataReadiness !== 'READY' || readyReadModel.isMock || !readyReadModel.canServeHistoricalResearch || readyReadModel.historicalBlockReason !== null || readyReadModel.canServeIntradayResearch || readyReadModel.intradayBlockReason !== 'UNSUPPORTED' || readyReadModel.canServeRealtime || readyReadModel.realtimeBlockReason !== 'UNSUPPORTED') throw new Error('Healthy EOD providers with trustworthy sync evidence must expose supported capabilities and explicit unsupported reasons without UI inference.');
if (readyReadModel.statusMessage !== 'Provider is healthy and available for its declared capabilities.') throw new Error('Healthy provider fallback messaging must be centralized in the application seam.');

const missingEvidenceReadModel = await buildProviderStatusReadModel(realProvider, { status: 'HEALTHY', checkedAt: '2026-09-17T00:00:00.000Z' }, nowMs, 'IDX');
if (missingEvidenceReadModel.dataReadiness !== 'BLOCKED' || missingEvidenceReadModel.isHealthy || !missingEvidenceReadModel.requiresAttention || missingEvidenceReadModel.canServeHistoricalResearch || missingEvidenceReadModel.historicalBlockReason !== 'HEALTH_BLOCKED') throw new Error('Non-mock providers must fail closed in application status when canonical sync provenance is missing, even if the adapter labels itself HEALTHY.');
if (!missingEvidenceReadModel.statusMessage.includes('no lastSuccessfulSyncAt evidence')) throw new Error('Application status must surface the engine-owned provider health evidence failure without recreating freshness logic in UI.');

const unsupportedMarketReadModel = await buildProviderStatusReadModel(realProvider, undefined, nowMs, 'US');
if (unsupportedMarketReadModel.supportsRequestedMarket || unsupportedMarketReadModel.marketBlockReason !== 'MARKET_UNSUPPORTED') throw new Error('Provider application status must fail closed when the requested market is not declared by the adapter.');
if (unsupportedMarketReadModel.dataReadiness !== 'BLOCKED' || !unsupportedMarketReadModel.requiresAttention) throw new Error('Market incompatibility must dominate overall provider readiness instead of presenting an unusable provider as READY.');
if (unsupportedMarketReadModel.statusMessage !== 'Provider does not support requested market US. Capability use is blocked.') throw new Error('Market incompatibility messaging must be centralized so UI does not reinterpret provider routing failures.');
if (unsupportedMarketReadModel.canServeHistoricalResearch || unsupportedMarketReadModel.historicalBlockReason !== 'MARKET_UNSUPPORTED' || unsupportedMarketReadModel.canServeIntradayResearch || unsupportedMarketReadModel.intradayBlockReason !== 'MARKET_UNSUPPORTED' || unsupportedMarketReadModel.canServeRealtime || unsupportedMarketReadModel.realtimeBlockReason !== 'MARKET_UNSUPPORTED') throw new Error('Market incompatibility must dominate capability gates so future multi-market UI cannot route an IDX-only provider into US research.');

const unsupportedMockMarketReadModel = await buildProviderStatusReadModel(provider, undefined, nowMs, 'US');
if (unsupportedMockMarketReadModel.dataReadiness !== 'BLOCKED' || unsupportedMockMarketReadModel.historicalBlockReason !== 'MARKET_UNSUPPORTED' || unsupportedMockMarketReadModel.dataDisclosure !== 'MOCK / SYNTHETIC DATA — NOT FOR LIVE TRADING') throw new Error('Unsupported-market MOCK providers must fail closed while preserving explicit synthetic-data provenance.');

const cautionReadModel = await buildProviderStatusReadModel(realProvider, { status: 'DEGRADED', checkedAt: '2026-09-17T00:00:00.000Z', lastSuccessfulSyncAt: '2026-09-17T00:00:00.000Z', staleAfterSeconds: 300 }, nowMs, 'IDX');
if (cautionReadModel.dataReadiness !== 'CAUTION' || !cautionReadModel.canServeHistoricalResearch || cautionReadModel.historicalBlockReason !== null) throw new Error('Degraded non-mock providers with trustworthy evidence may remain research-capable while surfacing CAUTION.');
if (cautionReadModel.statusMessage !== 'Provider is degraded. Research may continue only within declared capabilities.') throw new Error('Degraded provider fallback messaging must not be reinterpreted by UI components.');

const blockedReadModel = await buildProviderStatusReadModel(realProvider, { status: 'STALE', checkedAt: '2026-09-17T00:00:00.000Z', lastSuccessfulSyncAt: '2026-09-16T23:59:00.000Z', staleAfterSeconds: 60 }, nowMs, 'IDX');
if (blockedReadModel.dataReadiness !== 'BLOCKED' || blockedReadModel.canServeHistoricalResearch || blockedReadModel.historicalBlockReason !== 'HEALTH_BLOCKED') throw new Error('Stale non-mock providers must fail closed as BLOCKED with explicit health evidence.');
if (blockedReadModel.statusMessage !== 'Provider data is stale. Capability use is blocked until freshness recovers.') throw new Error('Stale provider fallback messaging must communicate the fail-closed state without UI inference.');

console.log('Provider-status application smoke passed: provenance, canonical health evidence, market compatibility, readiness, messaging, capability gates and block reasons reach UI through one immutable application read model.');
