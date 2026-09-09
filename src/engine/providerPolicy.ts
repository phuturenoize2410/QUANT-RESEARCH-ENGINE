import {
  MarketDataProvider,
  ProviderHealth,
  ProviderMetadata,
  ProviderMode,
} from './dataProviders';

export type ResearchUseCase =
  | 'HISTORICAL_BACKTEST'
  | 'EOD_RESEARCH'
  | 'PRECLOSE_SCREENING'
  | 'LIVE_EXECUTION';

export interface ProviderReadiness {
  useCase: ResearchUseCase;
  allowed: boolean;
  reasons: string[];
  warnings: string[];
}

const MODE_RANK: Record<ProviderMode, number> = {
  MOCK: 0,
  EOD: 1,
  DELAYED: 2,
  REALTIME: 3,
};

function parseTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Converts provider-reported health into one canonical health snapshot.
 *
 * Providers remain responsible for connectivity/capability checks, while the
 * engine owns freshness semantics. If a provider declares `staleAfterSeconds`
 * and its last successful sync exceeds that threshold, the engine upgrades the
 * status to STALE even when an adapter forgot to do so itself.
 */
export function normalizeProviderHealth(
  health: ProviderHealth,
  nowMs: number = Date.now(),
): ProviderHealth {
  const normalized: ProviderHealth = {
    ...health,
    latencyMs: health.latencyMs === undefined
      ? undefined
      : Math.max(0, health.latencyMs),
    staleAfterSeconds: health.staleAfterSeconds === undefined
      ? undefined
      : Math.max(0, health.staleAfterSeconds),
  };

  if (normalized.status === 'UNAVAILABLE') return normalized;

  const lastSuccessfulSyncMs = parseTimestamp(normalized.lastSuccessfulSyncAt);
  const staleAfterSeconds = normalized.staleAfterSeconds;

  if (
    lastSuccessfulSyncMs !== undefined &&
    staleAfterSeconds !== undefined &&
    nowMs - lastSuccessfulSyncMs > staleAfterSeconds * 1000
  ) {
    return {
      ...normalized,
      status: 'STALE',
      message: normalized.message
        ? `${normalized.message} Freshness threshold exceeded.`
        : 'Freshness threshold exceeded.',
    };
  }

  return normalized;
}

/**
 * Central policy gate for deciding whether a provider is suitable for a research
 * or execution use case. Strategy/UI code must not infer suitability from a
 * vendor name (Google Finance, broker API, etc.). It should depend only on
 * declared capabilities, freshness and health.
 */
export function evaluateProviderReadiness(
  metadata: ProviderMetadata,
  health: ProviderHealth,
  useCase: ResearchUseCase,
): ProviderReadiness {
  const normalizedHealth = normalizeProviderHealth(health);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (normalizedHealth.status === 'UNAVAILABLE') reasons.push('Provider is unavailable.');
  if (normalizedHealth.status === 'STALE') reasons.push('Provider data is stale.');
  if (normalizedHealth.status === 'DEGRADED') warnings.push('Provider health is degraded.');
  if (metadata.mode === 'MOCK') warnings.push('Data is simulated and cannot validate a real trading edge.');

  switch (useCase) {
    case 'HISTORICAL_BACKTEST':
      if (!metadata.supportsHistorical) reasons.push('Historical data is not supported.');
      if (metadata.mode === 'MOCK') reasons.push('Synthetic history is not eligible for production backtest evidence.');
      break;

    case 'EOD_RESEARCH':
      if (!metadata.supportsHistorical) reasons.push('Historical/EOD data is not supported.');
      break;

    case 'PRECLOSE_SCREENING':
      if (!metadata.supportsIntraday) reasons.push('Intraday data is required for pre-close screening.');
      if (MODE_RANK[metadata.mode] < MODE_RANK.DELAYED) reasons.push('EOD-only data is too stale for pre-close screening.');
      if (metadata.mode === 'DELAYED') warnings.push('Delayed data may not represent the executable 15:30–15:45 market state.');
      break;

    case 'LIVE_EXECUTION':
      if (!metadata.supportsRealtime || metadata.mode !== 'REALTIME') {
        reasons.push('Real-time market data is required for live execution decisions.');
      }
      break;
  }

  return {
    useCase,
    allowed: reasons.length === 0,
    reasons,
    warnings,
  };
}

export async function getProviderReadinessMatrix(
  provider: MarketDataProvider,
  healthSnapshot?: ProviderHealth,
): Promise<Record<ResearchUseCase, ProviderReadiness>> {
  const health = normalizeProviderHealth(healthSnapshot ?? await provider.getHealth());
  const useCases: ResearchUseCase[] = [
    'HISTORICAL_BACKTEST',
    'EOD_RESEARCH',
    'PRECLOSE_SCREENING',
    'LIVE_EXECUTION',
  ];

  return Object.fromEntries(
    useCases.map(useCase => [
      useCase,
      evaluateProviderReadiness(provider.metadata, health, useCase),
    ]),
  ) as Record<ResearchUseCase, ProviderReadiness>;
}
