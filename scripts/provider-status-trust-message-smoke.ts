import { buildProviderStatusReadModel } from '../src/application/providerStatusApplication';
import type { HealthCheckedProvider, ProviderHealthStatus } from '../src/engine/dataProviders';

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

function providerWithStatus(status: ProviderHealthStatus): HealthCheckedProvider {
  return {
    ...provider,
    async getHealth() {
      return Object.freeze({
        status,
        checkedAt: '2026-09-17T00:00:00.000Z',
        lastSuccessfulSyncAt: '2026-09-17T00:00:00.000Z',
        staleAfterSeconds: 3600,
        message: 'All systems healthy and ready for trading.',
      });
    },
  };
}

for (const [status, expectedFragment] of [
  ['DEGRADED', 'Provider is degraded'],
  ['STALE', 'Provider data is stale'],
  ['UNAVAILABLE', 'Provider is unavailable'],
] as const) {
  const unsafeReadModel = await buildProviderStatusReadModel(providerWithStatus(status), undefined, nowMs, 'IDX');
  if (unsafeReadModel.statusMessage.includes('All systems healthy and ready for trading.')) {
    throw new Error(`${status} provider prose must not override canonical application status messaging.`);
  }
  if (!unsafeReadModel.statusMessage.includes(expectedFragment)) {
    throw new Error(`${status} provider must expose canonical status messaging to presentation.`);
  }
}

console.log('Provider status trust-message smoke passed: canonical trust failures and non-ready health states dominate adapter prose before UI presentation.');
