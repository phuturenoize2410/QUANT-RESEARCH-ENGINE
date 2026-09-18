import { buildProviderStatusReadModel } from '../src/application/providerStatusApplication';
import type { HealthCheckedProvider } from '../src/engine/dataProviders';

const nowMs = Date.parse('2026-09-17T00:00:00.000Z');
const provider: HealthCheckedProvider = {
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
    return Object.freeze({
      status: 'HEALTHY' as const,
      checkedAt: '2026-09-17T00:00:00.000Z',
      message: 'All systems healthy and ready for trading.',
    });
  },
};

const readModel = await buildProviderStatusReadModel(provider, undefined, nowMs, 'IDX');
if (readModel.dataReadiness !== 'BLOCKED' || readModel.canServeHistoricalResearch || readModel.historicalBlockReason !== 'HEALTH_BLOCKED') {
  throw new Error('Untrusted provider evidence must remain fail-closed even when adapter prose claims readiness.');
}
if (!readModel.statusMessage.includes('Provider health evidence is not trustworthy') || !readModel.statusMessage.includes('no lastSuccessfulSyncAt evidence')) {
  throw new Error('Engine-owned trust failure must dominate adapter-supplied health prose at the UI boundary.');
}
if (readModel.statusMessage.includes('All systems healthy and ready for trading.')) {
  throw new Error('Untrusted adapter prose must never override canonical application safety messaging.');
}

console.log('Provider status trust-message smoke passed: canonical trust failures dominate adapter prose before UI presentation.');
