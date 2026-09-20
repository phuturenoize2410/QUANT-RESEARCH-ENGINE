import { MarketId } from './market/marketAdapter';

/**
 * Provider-neutral evidence contracts shared across engine stages.
 *
 * Keep these declarations separate from concrete provider implementations so
 * Feature/Strategy/Risk layers can consume provenance and delivery semantics
 * without depending on adapter code. Future Google Finance, free API, paid IDX,
 * or broker adapters should implement these contracts at the DataProvider edge.
 */
export type MarketDataSource =
  | 'MOCK_ENGINE'
  | 'GOOGLE_FINANCE'
  | 'FREE_API'
  | 'IDX_FEED'
  | 'BROKER_API';

export type ProviderMode = 'MOCK' | 'DELAYED' | 'EOD' | 'REALTIME';
export type ProviderHealthStatus = 'HEALTHY' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE';

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
