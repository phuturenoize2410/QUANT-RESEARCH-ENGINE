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

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function parseTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeNonNegativeFinite(value?: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

function appendMessage(base: string | undefined, detail: string): string {
  return base ? `${base} ${detail}` : detail;
}

function degradeHealth(
  health: ProviderHealth,
  detail: string,
): ProviderHealth {
  if (health.status === 'UNAVAILABLE' || health.status === 'STALE') {
    return {
      ...health,
      message: appendMessage(health.message, detail),
    };
  }

  return {
    ...health,
    status: 'DEGRADED',
    message: appendMessage(health.message, detail),
  };
}

/**
 * Converts provider-reported health into one canonical health snapshot.
 *
 * Providers remain responsible for connectivity/capability checks, while the
 * engine owns timestamp, numeric and freshness semantics. This prevents future
 * Google Finance/free API/broker adapters from accidentally reporting HEALTHY
 * when their health payload is malformed or freshness cannot be established.
 */
export function normalizeProviderHealth(
  health: ProviderHealth,
  nowMs: number = Date.now(),
): ProviderHealth {
  let normalized: ProviderHealth = {
    ...health,
    latencyMs: normalizeNonNegativeFinite(health.latencyMs),
    staleAfterSeconds: normalizeNonNegativeFinite(health.staleAfterSeconds),
  };

  if (health.latencyMs !== undefined && normalized.latencyMs === undefined) {
    normalized = degradeHealth(normalized, 'Invalid provider latency metadata ignored.');
  }

  if (health.staleAfterSeconds !== undefined && normalized.staleAfterSeconds === undefined) {
    normalized = degradeHealth(normalized, 'Invalid freshness threshold ignored.');
  }

  const checkedAtMs = parseTimestamp(normalized.checkedAt);
  if (checkedAtMs === undefined) {
    normalized = degradeHealth(normalized, 'Provider health check timestamp is invalid.');
  } else if (checkedAtMs > nowMs + MAX_CLOCK_SKEW_MS) {
    normalized = degradeHealth(normalized, 'Provider health check timestamp is unexpectedly in the future.');
  }

  if (normalized.status === 'UNAVAILABLE') return normalized;

  const lastSuccessfulSyncMs = parseTimestamp(normalized.lastSuccessfulSyncAt);
  const staleAfterSeconds = normalized.staleAfterSeconds;

  if (normalized.lastSuccessfulSyncAt && lastSuccessfulSyncMs === undefined) {
    normalized = degradeHealth(normalized, 'Last successful sync timestamp is invalid.');
  }

  if (lastSuccessfulSyncMs !== undefined && lastSuccessfulSyncMs > nowMs + MAX_CLOCK_SKEW_MS) {
    normalized = degradeHealth(normalized, 'Last successful sync timestamp is unexpectedly in the future.');
  }

  if (staleAfterSeconds !== undefined && lastSuccessfulSyncMs === undefined) {
    normalized = degradeHealth(
      normalized,
      'Freshness threshold is declared but last successful sync time is unavailable.',
    );
  }

  if (
    lastSuccessfulSyncMs !== undefined &&
    staleAfterSeconds !== undefined &&
    nowMs - lastSuccessfulSyncMs > staleAfterSeconds * 1000
  ) {
    return {
      ...normalized,
      status: 'STALE',
      message: appendMessage(normalized.message, 'Freshness threshold exceeded.'),
    };
  }

  return normalized;
}

function evaluateNormalizedProviderReadiness(
  metadata: ProviderMetadata,
  normalizedHealth: ProviderHealth,
  useCase: ResearchUseCase,
): ProviderReadiness {
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
      if (normalizedHealth.status === 'DEGRADED') {
        reasons.push('Degraded provider health is not eligible for live execution decisions.');
      }
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
  return evaluateNormalizedProviderReadiness(
    metadata,
    normalizeProviderHealth(health),
    useCase,
  );
}

export async function getProviderReadinessMatrix(
  provider: MarketDataProvider,
  healthSnapshot?: ProviderHealth,
): Promise<Record<ResearchUseCase, ProviderReadiness>> {
  // Normalize exactly once so every use-case decision in this matrix is derived
  // from the same canonical health/freshness snapshot. This avoids a provider
  // crossing its stale threshold between sequential policy evaluations and
  // producing internally inconsistent readiness states within one refresh.
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
      evaluateNormalizedProviderReadiness(provider.metadata, health, useCase),
    ]),
  ) as Record<ResearchUseCase, ProviderReadiness>;
}
