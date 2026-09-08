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
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (health.status === 'UNAVAILABLE') reasons.push('Provider is unavailable.');
  if (health.status === 'STALE') reasons.push('Provider data is stale.');
  if (health.status === 'DEGRADED') warnings.push('Provider health is degraded.');
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
): Promise<Record<ResearchUseCase, ProviderReadiness>> {
  const health = await provider.getHealth();
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
