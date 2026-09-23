import {
  canonicalProviderMarketId,
  isInherentlyFreeMarketDataSource,
  isMarketDataSource,
  isProviderMode,
  type HealthCheckedProvider,
  type ProviderHealth,
  type ProviderMetadata,
  type ProviderMode,
} from './providerContracts';
import type { MarketId } from './market/marketAdapter';
import {
  captureProviderHealth,
  getProviderHealthSnapshot,
  normalizeProviderHealth,
} from './providerHealth';

export { captureProviderHealth, normalizeProviderHealth } from './providerHealth';

export const RESEARCH_USE_CASES = [
  'HISTORICAL_BACKTEST',
  'EOD_RESEARCH',
  'PRECLOSE_SCREENING',
  'LIVE_EXECUTION',
] as const;

export type ResearchUseCase = (typeof RESEARCH_USE_CASES)[number];

export function isResearchUseCase(value: unknown): value is ResearchUseCase {
  return typeof value === 'string' && RESEARCH_USE_CASES.includes(value as ResearchUseCase);
}

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

const snapshotReadiness = (readiness: ProviderReadiness): ProviderReadiness => Object.freeze({
  useCase: readiness.useCase,
  allowed: readiness.allowed,
  reasons: Object.freeze([...readiness.reasons]) as unknown as string[],
  warnings: Object.freeze([...readiness.warnings]) as unknown as string[],
});

export function snapshotProviderStatus(status: ProviderStatusSnapshot): ProviderStatusSnapshot {
  const readiness = Object.fromEntries(
    RESEARCH_USE_CASES.map(useCase => [useCase, snapshotReadiness(status.readiness[useCase])]),
  ) as Record<ResearchUseCase, ProviderReadiness>;

  return Object.freeze({
    metadata: Object.freeze({
      ...status.metadata,
      supportedMarkets: Object.freeze([...status.metadata.supportedMarkets]),
    }),
    health: Object.freeze({ ...status.health }),
    readiness: Object.freeze(readiness),
    targetMarket: status.targetMarket,
    marketCompatible: status.marketCompatible,
    capturedAt: status.capturedAt,
  });
}

const MODE_RANK: Record<ProviderMode, number> = { MOCK: 0, EOD: 1, DELAYED: 2, REALTIME: 3 };

function pushUnique(target: string[], message: string): void { if (!target.includes(message)) target.push(message); }
function isNonEmptyString(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function isMetadataObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function providerSupportsMarket(metadata: ProviderMetadata, marketId: MarketId): boolean {
  if (!isMetadataObject(metadata) || !Array.isArray(metadata.supportedMarkets)) return false;
  const canonicalTargetMarket = canonicalProviderMarketId(marketId);
  if (!canonicalTargetMarket) return false;
  return metadata.supportedMarkets.some(market => canonicalProviderMarketId(market) === canonicalTargetMarket);
}

export function validateProviderMetadata(metadata: ProviderMetadata): string[] {
  if (!isMetadataObject(metadata)) {
    return ['Provider capability contract is invalid: metadata must be an object.'];
  }

  const runtimeMetadata = metadata as unknown as ProviderMetadata & {
    id?: unknown; name?: unknown; source?: unknown; mode?: unknown; isPaid?: unknown; notes?: unknown;
    supportedMarkets?: unknown; supportsHistorical?: unknown; supportsIntraday?: unknown; supportsRealtime?: unknown;
  };
  const issues: string[] = [];
  if (!isNonEmptyString(runtimeMetadata.id)) issues.push('Provider capability contract is invalid: provider id must be a non-empty string.');
  if (!isNonEmptyString(runtimeMetadata.name)) issues.push('Provider capability contract is invalid: provider name must be a non-empty string.');
  if (runtimeMetadata.notes !== undefined && !isNonEmptyString(runtimeMetadata.notes)) issues.push('Provider capability contract is invalid: notes must be a non-empty string when provided.');
  const hasValidSource = isMarketDataSource(runtimeMetadata.source);
  const hasValidMode = isProviderMode(runtimeMetadata.mode);
  const hasValidPaidFlag = typeof runtimeMetadata.isPaid === 'boolean';
  const hasValidHistoricalCapability = typeof runtimeMetadata.supportsHistorical === 'boolean';
  const hasValidIntradayCapability = typeof runtimeMetadata.supportsIntraday === 'boolean';
  const hasValidRealtimeCapability = typeof runtimeMetadata.supportsRealtime === 'boolean';
  if (!hasValidSource) issues.push('Provider capability contract is invalid: source is not recognized.');
  if (!hasValidMode) issues.push('Provider capability contract is invalid: mode is not recognized.');
  if (!hasValidPaidFlag) issues.push('Provider capability contract is invalid: isPaid must be boolean.');
  if (hasValidSource && hasValidPaidFlag && runtimeMetadata.isPaid && isInherentlyFreeMarketDataSource(runtimeMetadata.source)) issues.push(`Provider capability contract is invalid: ${runtimeMetadata.source} source cannot be marked as paid.`);
  if (!hasValidHistoricalCapability) issues.push('Provider capability contract is invalid: supportsHistorical must be boolean.');
  if (!hasValidIntradayCapability) issues.push('Provider capability contract is invalid: supportsIntraday must be boolean.');
  if (!hasValidRealtimeCapability) issues.push('Provider capability contract is invalid: supportsRealtime must be boolean.');
  const supportedMarkets = Array.isArray(runtimeMetadata.supportedMarkets) ? runtimeMetadata.supportedMarkets : [];
  if (!Array.isArray(runtimeMetadata.supportedMarkets)) issues.push('Provider capability contract is invalid: supportedMarkets must be an array.');
  if (supportedMarkets.length === 0) issues.push('Provider capability contract is invalid: at least one supported market must be declared.');
  const canonicalMarkets = supportedMarkets.map(canonicalProviderMarketId).filter((market): market is MarketId => Boolean(market));
  if (canonicalMarkets.length !== supportedMarkets.length) issues.push('Provider capability contract is invalid: supported market identifiers must be non-empty strings.');
  if (new Set(canonicalMarkets).size !== canonicalMarkets.length) issues.push('Provider capability contract is invalid: supported markets must not contain canonical duplicates.');
  if (hasValidRealtimeCapability && hasValidIntradayCapability && runtimeMetadata.supportsRealtime && !runtimeMetadata.supportsIntraday) issues.push('Provider capability contract is invalid: real-time support requires intraday support.');
  if (hasValidRealtimeCapability && hasValidMode && runtimeMetadata.supportsRealtime && runtimeMetadata.mode !== 'REALTIME') issues.push('Provider capability contract is invalid: real-time support requires REALTIME mode.');
  if (hasValidMode && hasValidRealtimeCapability && runtimeMetadata.mode === 'REALTIME' && !runtimeMetadata.supportsRealtime) issues.push('Provider capability contract is invalid: REALTIME mode requires real-time support.');
  if (hasValidMode && hasValidIntradayCapability && runtimeMetadata.mode === 'EOD' && runtimeMetadata.supportsIntraday) issues.push('Provider capability contract is invalid: EOD mode cannot declare intraday support.');
  if (hasValidMode && hasValidSource && runtimeMetadata.mode === 'MOCK' && runtimeMetadata.source !== 'MOCK_ENGINE') issues.push('Provider capability contract is invalid: MOCK mode requires MOCK_ENGINE source.');
  if (hasValidSource && hasValidMode && runtimeMetadata.source === 'MOCK_ENGINE' && runtimeMetadata.mode !== 'MOCK') issues.push('Provider capability contract is invalid: MOCK_ENGINE source requires MOCK mode.');
  return issues;
}

function evaluateNormalizedProviderReadiness(metadata: ProviderMetadata, normalizedHealth: ProviderHealth, useCase: ResearchUseCase, targetMarket?: MarketId): ProviderReadiness {
  const reasons: string[] = [...validateProviderMetadata(metadata)];
  const warnings: string[] = [];
  if (!isResearchUseCase(useCase)) {
    pushUnique(reasons, `Provider readiness contract is invalid: unknown research use case ${String(useCase)}.`);
    return { useCase, allowed: false, reasons, warnings };
  }
  if (!isMetadataObject(metadata)) {
    return { useCase, allowed: false, reasons, warnings };
  }
  if (targetMarket !== undefined && !providerSupportsMarket(metadata, targetMarket)) pushUnique(reasons, `Provider does not support target market ${targetMarket}.`);
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
      if (normalizedHealth.status === 'DEGRADED') pushUnique(reasons, 'Degraded provider health is not eligible for live execution decisions.');
      if (metadata.supportsIntraday !== true) pushUnique(reasons, 'Intraday market data capability is required for live execution decisions.');
      if (metadata.supportsRealtime !== true || metadata.mode !== 'REALTIME') pushUnique(reasons, 'Real-time market data is required for live execution decisions.');
      break;
  }
  return { useCase, allowed: reasons.length === 0, reasons, warnings };
}

function buildReadinessMatrix(
  metadata: ProviderMetadata,
  normalizedHealth: ProviderHealth,
  targetMarket?: MarketId,
  rawContractIssues: readonly string[] = [],
): Record<ResearchUseCase, ProviderReadiness> {
  return Object.fromEntries(RESEARCH_USE_CASES.map(useCase => {
    const readiness = evaluateNormalizedProviderReadiness(metadata, normalizedHealth, useCase, targetMarket);
    rawContractIssues.forEach(issue => pushUnique(readiness.reasons, issue));
    return [useCase, { ...readiness, allowed: readiness.reasons.length === 0 }];
  })) as Record<ResearchUseCase, ProviderReadiness>;
}

export function evaluateProviderReadiness(metadata: ProviderMetadata, health: ProviderHealth, useCase: ResearchUseCase, targetMarket?: MarketId): ProviderReadiness {
  return evaluateNormalizedProviderReadiness(metadata, normalizeProviderHealth(health), useCase, targetMarket);
}

export async function getProviderReadinessMatrix(provider: HealthCheckedProvider, healthSnapshot?: ProviderHealth, nowMs: number = Date.now(), targetMarket?: MarketId): Promise<Record<ResearchUseCase, ProviderReadiness>> {
  const rawContractIssues = validateProviderMetadata(provider.metadata);
  const providerHealth = await getProviderHealthSnapshot(provider, healthSnapshot, nowMs);
  return buildReadinessMatrix(providerHealth.metadata, providerHealth.health, targetMarket, rawContractIssues);
}

export async function getProviderStatusSnapshot(provider: HealthCheckedProvider, healthSnapshot?: ProviderHealth, nowMs: number = Date.now(), targetMarket?: MarketId): Promise<ProviderStatusSnapshot> {
  const rawContractIssues = validateProviderMetadata(provider.metadata);
  const providerHealth = await getProviderHealthSnapshot(provider, healthSnapshot, nowMs);
  return snapshotProviderStatus({
    ...providerHealth,
    readiness: buildReadinessMatrix(providerHealth.metadata, providerHealth.health, targetMarket, rawContractIssues),
    targetMarket,
    marketCompatible: targetMarket !== undefined ? providerSupportsMarket(providerHealth.metadata, targetMarket) : true,
  });
}
