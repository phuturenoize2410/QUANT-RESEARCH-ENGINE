import type { MarketId } from './market/marketAdapter';

/**
 * Provider-neutral evidence contracts shared across engine stages.
 *
 * Keep these declarations separate from concrete provider implementations so
 * Feature/Strategy/Risk layers can consume provenance and delivery semantics
 * without depending on adapter code. Future Google Finance, free API, paid IDX,
 * or broker adapters should implement these contracts at the DataProvider edge.
 */
export const MARKET_DATA_SOURCES = [
  'MOCK_ENGINE',
  'GOOGLE_FINANCE',
  'FREE_API',
  'IDX_FEED',
  'BROKER_API',
] as const;

export const PROVIDER_MODES = ['MOCK', 'DELAYED', 'EOD', 'REALTIME'] as const;
export const PROVIDER_HEALTH_STATUSES = ['HEALTHY', 'DEGRADED', 'STALE', 'UNAVAILABLE'] as const;

export type MarketDataSource = (typeof MARKET_DATA_SOURCES)[number];
export type ProviderMode = (typeof PROVIDER_MODES)[number];
export type ProviderHealthStatus = (typeof PROVIDER_HEALTH_STATUSES)[number];

/** Sources whose canonical contract is explicitly free/synthetic, never paid. */
export const INHERENTLY_FREE_MARKET_DATA_SOURCES = [
  'MOCK_ENGINE',
  'GOOGLE_FINANCE',
  'FREE_API',
] as const satisfies readonly MarketDataSource[];

/** Runtime guards share the same canonical vocabulary as the compile-time unions. */
export function isMarketDataSource(value: unknown): value is MarketDataSource {
  return typeof value === 'string' && MARKET_DATA_SOURCES.includes(value as MarketDataSource);
}

export function isProviderMode(value: unknown): value is ProviderMode {
  return typeof value === 'string' && PROVIDER_MODES.includes(value as ProviderMode);
}

export function isProviderHealthStatus(value: unknown): value is ProviderHealthStatus {
  return typeof value === 'string' && PROVIDER_HEALTH_STATUSES.includes(value as ProviderHealthStatus);
}

/**
 * Central cost-classification guard for provider metadata validation and status
 * boundaries. Keeping this next to the source vocabulary prevents adapters/UI
 * from inventing conflicting paid/free semantics as real providers are added.
 */
export function isInherentlyFreeMarketDataSource(value: unknown): value is (typeof INHERENTLY_FREE_MARKET_DATA_SOURCES)[number] {
  return isMarketDataSource(value)
    && INHERENTLY_FREE_MARKET_DATA_SOURCES.includes(value as (typeof INHERENTLY_FREE_MARKET_DATA_SOURCES)[number]);
}

export interface ProviderMetadata {
  readonly id: string;
  readonly name: string;
  readonly source: MarketDataSource;
  readonly mode: ProviderMode;
  readonly isPaid: boolean;
  readonly supportedMarkets: readonly MarketId[];
  readonly supportsHistorical: boolean;
  readonly supportsIntraday: boolean;
  readonly supportsRealtime: boolean;
  readonly notes?: string;
}

/** Health is immutable observation evidence, not mutable provider state. */
export interface ProviderHealth {
  readonly status: ProviderHealthStatus;
  readonly checkedAt: string;
  readonly lastSuccessfulSyncAt?: string;
  readonly latencyMs?: number;
  readonly staleAfterSeconds?: number;
  readonly message?: string;
}

export interface HealthCheckedProvider {
  readonly metadata: ProviderMetadata;
  getHealth(): Promise<ProviderHealth>;
}
