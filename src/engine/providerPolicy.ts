import {
  MarketDataProvider,
  MarketDataSource,
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

const PROVIDER_MODES: readonly ProviderMode[] = ['MOCK', 'EOD', 'DELAYED', 'REALTIME'];
const MARKET_DATA_SOURCES: readonly MarketDataSource[] = [
  'MOCK_ENGINE',
  'GOOGLE_FINANCE',
  'FREE_API',
  'IDX_FEED',
  'BROKER_API',
];

function pushUnique(target: string[], message: string): void {
  if (!target.includes(message)) target.push(message);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isProviderMode(value: unknown): value is ProviderMode {
  return typeof value === 'string' && PROVIDER_MODES.includes(value as ProviderMode);
}

function isMarketDataSource(value: unknown): value is MarketDataSource {
  return typeof value === 'string' && MARKET_DATA_SOURCES.includes(value as MarketDataSource);
}

export function providerSupportsMarket(
  metadata: ProviderMetadata,
  marketId: MarketId,
): boolean {
  return Array.isArray(metadata.supportedMarkets) && metadata.supportedMarkets.includes(marketId);
}

/**
 * Validate capability declarations independently from any specific research
 * use case. Provider adapters are runtime contracts: TypeScript cannot protect
 * this boundary once metadata originates from JSON, a free feed, a paid adapter,
 * or another external system. Malformed scalar fields therefore fail closed here
 * before readiness can be inferred by strategy, backtest, execution, or UI code.
 */
export function validateProviderMetadata(metadata: ProviderMetadata): string[] {
  const runtimeMetadata = metadata as ProviderMetadata & {
    id?: unknown;
    name?: unknown;
    source?: unknown;
    mode?: unknown;
    isPaid?: unknown;
    supportedMarkets?: unknown;
    supportsHistorical?: unknown;
    supportsIntraday?: unknown;
    supportsRealtime?: unknown;
  };
  const issues: string[] = [];

  if (!isNonEmptyString(runtimeMetadata.id)) {
    issues.push('Provider capability contract is invalid: provider id must be a non-empty string.');
  }

  if (!isNonEmptyString(runtimeMetadata.name)) {
    issues.push('Provider capability contract is invalid: provider name must be a non-empty string.');
  }

  const hasValidSource = isMarketDataSource(runtimeMetadata.source);
  const hasValidMode = isProviderMode(runtimeMetadata.mode);
  const hasValidPaidFlag = typeof runtimeMetadata.isPaid === 'boolean';
  const hasValidHistoricalCapability = typeof runtimeMetadata.supportsHistorical === 'boolean';
  const hasValidIntradayCapability = typeof runtimeMetadata.supportsIntraday === 'boolean';
  const hasValidRealtimeCapability = typeof runtimeMetadata.supportsRealtime === 'boolean';

  if (!hasValidSource) {
    issues.push('Provider capability contract is invalid: source is not recognized.');
  }
  if (!hasValidMode) {
    issues.push('Provider capability contract is invalid: mode is not recognized.');
  }
  if (!hasValidPaidFlag) {
    issues.push('Provider capability contract is invalid: isPaid must be boolean.');
  }
  if (!hasValidHistoricalCapability) {
    issues.push('Provider capability contract is invalid: supportsHistorical must be boolean.');
  }
  if (!hasValidIntradayCapability) {
    issues.push('Provider capability contract is invalid: supportsIntraday must be boolean.');
  }
  if (!hasValidRealtimeCapability) {
    issues.push('Provider capability contract is invalid: supportsRealtime must be boolean.');
  }

  const supportedMarkets = Array.isArray(runtimeMetadata.supportedMarkets)
    ? runtimeMetadata.supportedMarkets
    : [];

  if (!Array.isArray(runtimeMetadata.supportedMarkets)) {
    issues.push('Provider capability contract is invalid: supportedMarkets must be an array.');
  }

  if (supportedMarkets.length === 0) {
    issues.push('Provider capability contract is invalid: at least one supported market must be declared.');
  }

  const normalizedMarkets = supportedMarkets
    .filter((market): market is string => typeof market === 'string')
    .map(market => market.trim())
    .filter(Boolean);
  if (normalizedMarkets.length !== supportedMarkets.length) {
    issues.push('Provider capability contract is invalid: supported market identifiers must be non-empty strings.');
  }

  if (new Set(normalizedMarkets).size !== normalizedMarkets.length) {
    issues.push('Provider capability contract is invalid: supported markets must not contain duplicates.');
  }

  if (
    hasValidRealtimeCapability &&
    hasValidIntradayCapability &&
    runtimeMetadata.supportsRealtime &&
    !runtimeMetadata.supportsIntraday
  ) {
    issues.push('Provider capability contract is invalid: real-time support requires intraday support.');
  }

  if (
    hasValidRealtimeCapability &&
    hasValidMode &&
    runtimeMetadata.supportsRealtime &&
    runtimeMetadata.mode !== 'REALTIME'
  ) {
    issues.push('Provider capability contract is invalid: real-time support requires REALTIME mode.');
  }

  if (
    hasValidMode &&
    hasValidRealtimeCapability &&
    runtimeMetadata.mode === 'REALTIME' &&
    !runtimeMetadata.supportsRealtime
  ) {
    issues.push('Provider capability contract is invalid: REALTIME mode requires real-time support.');
  }

  if (
    hasValidMode &&
    hasValidIntradayCapability &&
    runtimeMetadata.mode === 'EOD' &&
    runtimeMetadata.supportsIntraday
  ) {
    issues.push('Provider capability contract is invalid: EOD mode cannot declare intraday support.');
  }

  if (
    hasValidMode &&
    hasValidSource &&
    runtimeMetadata.mode === 'MOCK' &&
    runtimeMetadata.source !== 'MOCK_ENGINE'
  ) {
    issues.push('Provider capability contract is invalid: MOCK mode requires MOCK_ENGINE source.');
  }

  if (
    hasValidSource &&
    hasValidMode &&
    runtimeMetadata.source === 'MOCK_ENGINE' &&
    runtimeMetadata.mode !== 'MOCK'
  ) {
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
      if (metadata.supportsHistorical !== true) pushUnique(reasons, 'Historical data is not supported.');
      if (metadata.mode === 'MOCK') pushUnique(reasons, 'Synthetic history is not eligible for production backtest evidence.');
      break;

    case 'EOD_RESEARCH':
      if (metadata.supportsHistorical !== true) pushUnique(reasons, 'Historical/EOD data is not supported.');
      break;

    case 'PRECLOSE_SCREENING': {
      if (metadata.supportsIntraday !== true) pushUnique(reasons, 'Intraday data is required for pre-close screening.');
      const modeRank = isProviderMode(metadata.mode) ? MODE_RANK[metadata.mode] : -1;
      if (modeRank < MODE_RANK.DELAYED) pushUnique(reasons, 'EOD-only data is too stale for pre-close screening.');
      if (metadata.mode === 'DELAYED') warnings.push('Delayed data may not represent the executable pre-close market state.');
      break;
    }

    case 'LIVE_EXECUTION':
      if (normalizedHealth.status === 'DEGRADED') {
        pushUnique(reasons, 'Degraded provider health is not eligible for live execution decisions.');
      }
      if (metadata.supportsIntraday !== true) {
        pushUnique(reasons, 'Intraday market data capability is required for live execution decisions.');
      }
      if (metadata.supportsRealtime !== true || metadata.mode !== 'REALTIME') {
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
  // Always cross the same canonical provider-status boundary used by the full
  // status snapshot. This prevents callers of the matrix-only API from bypassing
  // runtime metadata normalization/fail-closed validation as new free or paid
  // provider adapters are introduced.
  const providerHealth = await getProviderHealthSnapshot(provider, healthSnapshot, nowMs);
  return buildReadinessMatrix(providerHealth.metadata, providerHealth.health, targetMarket);
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
