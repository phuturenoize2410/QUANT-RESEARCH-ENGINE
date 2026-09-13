import {
  MarketDataProvider,
  ProviderHealth,
  ProviderMetadata,
  ProviderMode,
} from './dataProviders';
import { MarketId } from './market/marketAdapter';
import {
  captureProviderHealth,
  getProviderHealthSnapshot,
  normalizeProviderHealth,
} from './providerHealth';

// Backward-compatible exports for existing callers. Health normalization and
// capture are implemented in providerHealth so non-market providers do not need
// to depend on market-data research readiness policy.
export { captureProviderHealth, normalizeProviderHealth } from './providerHealth';

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

export interface ProviderStatusSnapshot {
  metadata: ProviderMetadata;
  health: ProviderHealth;
  readiness: Record<ResearchUseCase, ProviderReadiness>;
  targetMarket?: MarketId;
  marketCompatible: boolean;
  capturedAt: string;
}

const MODE_RANK: Record<ProviderMode, number> = {
  MOCK: 0,
  EOD: 1,
  DELAYED: 2,
  REALTIME: 3,
};

function pushUnique(target: string[], message: string): void {
  if (!target.includes(message)) target.push(message);
}

export function providerSupportsMarket(
  metadata: ProviderMetadata,
  marketId: MarketId,
): boolean {
  return metadata.supportedMarkets.includes(marketId);
}

/**
 * Validate capability declarations independently from any specific research
 * use case. Provider adapters are contracts: contradictory metadata should be
 * rejected at the policy boundary rather than interpreted differently by UI,
 * strategy, backtest or execution consumers.
 */
export function validateProviderMetadata(metadata: ProviderMetadata): string[] {
  const issues: string[] = [];

  if (metadata.supportedMarkets.length === 0) {
    issues.push('Provider capability contract is invalid: at least one supported market must be declared.');
  }

  const normalizedMarkets = metadata.supportedMarkets.map(market => market.trim()).filter(Boolean);
  if (normalizedMarkets.length !== metadata.supportedMarkets.length) {
    issues.push('Provider capability contract is invalid: supported market identifiers must be non-empty.');
  }

  if (new Set(normalizedMarkets).size !== normalizedMarkets.length) {
    issues.push('Provider capability contract is invalid: supported markets must not contain duplicates.');
  }

  if (metadata.supportsRealtime && !metadata.supportsIntraday) {
    issues.push('Provider capability contract is invalid: real-time support requires intraday support.');
  }

  if (metadata.supportsRealtime && metadata.mode !== 'REALTIME') {
    issues.push('Provider capability contract is invalid: real-time support requires REALTIME mode.');
  }

  if (metadata.mode === 'REALTIME' && !metadata.supportsRealtime) {
    issues.push('Provider capability contract is invalid: REALTIME mode requires real-time support.');
  }

  if (metadata.mode === 'EOD' && metadata.supportsIntraday) {
    issues.push('Provider capability contract is invalid: EOD mode cannot declare intraday support.');
  }

  if (metadata.mode === 'MOCK' && metadata.source !== 'MOCK_ENGINE') {
    issues.push('Provider capability contract is invalid: MOCK mode requires MOCK_ENGINE source.');
  }

  if (metadata.source === 'MOCK_ENGINE' && metadata.mode !== 'MOCK') {
    issues.push('Provider capability contract is invalid: MOCK_ENGINE source requires MOCK mode.');
  }

  return issues;
}

function evaluateNormalizedProviderReadiness(
  metadata: ProviderMetadata,
  normalizedHealth: ProviderHealth,
  useCase: ResearchUseCase,
  targetMarket?: MarketId,
): ProviderReadiness {
  const reasons: string[] = [...validateProviderMetadata(metadata)];
  const warnings: string[] = [];

  if (targetMarket && !providerSupportsMarket(metadata, targetMarket)) {
    pushUnique(reasons, `Provider does not support target market ${targetMarket}.`);
  }

  if (normalizedHealth.status === 'UNAVAILABLE') pushUnique(reasons, 'Provider is unavailable.');
  if (normalizedHealth.status === 'STALE') pushUnique(reasons, 'Provider data is stale.');
  if (normalizedHealth.status === 'DEGRADED') warnings.push('Provider health is degraded.');
  if (metadata.mode === 'MOCK') warnings.push('Data is simulated and cannot validate a real trading edge.');

  switch (useCase) {
    case 'HISTORICAL_BACKTEST':
      if (!metadata.supportsHistorical) pushUnique(reasons, 'Historical data is not supported.');
      if (metadata.mode === 'MOCK') pushUnique(reasons, 'Synthetic history is not eligible for production backtest evidence.');
      break;

    case 'EOD_RESEARCH':
      if (!metadata.supportsHistorical) pushUnique(reasons, 'Historical/EOD data is not supported.');
      break;

    case 'PRECLOSE_SCREENING':
      if (!metadata.supportsIntraday) pushUnique(reasons, 'Intraday data is required for pre-close screening.');
      if (MODE_RANK[metadata.mode] < MODE_RANK.DELAYED) pushUnique(reasons, 'EOD-only data is too stale for pre-close screening.');
      if (metadata.mode === 'DELAYED') warnings.push('Delayed data may not represent the executable pre-close market state.');
      break;

    case 'LIVE_EXECUTION':
      if (normalizedHealth.status === 'DEGRADED') {
        pushUnique(reasons, 'Degraded provider health is not eligible for live execution decisions.');
      }
      if (!metadata.supportsIntraday) {
        pushUnique(reasons, 'Intraday market data capability is required for live execution decisions.');
      }
      if (!metadata.supportsRealtime || metadata.mode !== 'REALTIME') {
        pushUnique(reasons, 'Real-time market data is required for live execution decisions.');
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

function buildReadinessMatrix(
  metadata: ProviderMetadata,
  normalizedHealth: ProviderHealth,
  targetMarket?: MarketId,
): Record<ResearchUseCase, ProviderReadiness> {
  const useCases: ResearchUseCase[] = [
    'HISTORICAL_BACKTEST',
    'EOD_RESEARCH',
    'PRECLOSE_SCREENING',
    'LIVE_EXECUTION',
  ];

  return Object.fromEntries(
    useCases.map(useCase => [
      useCase,
      evaluateNormalizedProviderReadiness(metadata, normalizedHealth, useCase, targetMarket),
    ]),
  ) as Record<ResearchUseCase, ProviderReadiness>;
}

/**
 * Central policy gate for deciding whether a provider is suitable for a research
 * or execution use case. Strategy/UI code must not infer suitability from a
 * vendor name (Google Finance, broker API, etc.). It should depend only on
 * declared capabilities, target-market compatibility, freshness and health.
 */
export function evaluateProviderReadiness(
  metadata: ProviderMetadata,
  health: ProviderHealth,
  useCase: ResearchUseCase,
  targetMarket?: MarketId,
): ProviderReadiness {
  return evaluateNormalizedProviderReadiness(
    metadata,
    normalizeProviderHealth(health),
    useCase,
    targetMarket,
  );
}

export async function getProviderReadinessMatrix(
  provider: MarketDataProvider,
  healthSnapshot?: ProviderHealth,
  nowMs: number = Date.now(),
  targetMarket?: MarketId,
): Promise<Record<ResearchUseCase, ProviderReadiness>> {
  const health = healthSnapshot
    ? normalizeProviderHealth(healthSnapshot, nowMs)
    : await captureProviderHealth(provider, nowMs);
  return buildReadinessMatrix(provider.metadata, health, targetMarket);
}

/**
 * Canonical provider-status boundary. Consumers receive metadata, normalized
 * health and all readiness decisions from the same capture instant instead of
 * independently interpreting adapter state. This keeps future free/paid market
 * providers interchangeable and prevents UI or orchestration code from owning
 * freshness, market-compatibility or capability business rules.
 */
export async function getProviderStatusSnapshot(
  provider: MarketDataProvider,
  healthSnapshot?: ProviderHealth,
  nowMs: number = Date.now(),
  targetMarket?: MarketId,
): Promise<ProviderStatusSnapshot> {
  const providerHealth = await getProviderHealthSnapshot(provider, healthSnapshot, nowMs);

  return {
    ...providerHealth,
    readiness: buildReadinessMatrix(providerHealth.metadata, providerHealth.health, targetMarket),
    targetMarket,
    marketCompatible: targetMarket ? providerSupportsMarket(providerHealth.metadata, targetMarket) : true,
  };
}
