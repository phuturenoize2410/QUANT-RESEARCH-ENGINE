import { buildUniverse } from '../data/mockStocks';
import { StrategySettings, StockData } from '../types';
import {
  createPrototypeFeatureContext,
  FeatureContext,
} from './featureContext';
import {
  buildFeatureProvenance,
  FeatureProvenanceSnapshot,
} from './featureProvenance';
import { FeatureStore } from './ml/featureStore';
import { TickerFeatureVector } from './ml/types';
import {
  MarketDataProvider,
  MockMarketDataProvider,
  ProviderHealth,
  ProviderMetadata,
} from './dataProviders';
import {
  CacheAwareMarketDataProvider,
  ProviderCacheSnapshot,
} from './providerCache';
import {
  getProviderStatusSnapshot,
  ProviderReadiness,
  ResearchUseCase,
} from './providerPolicy';
import { assertProviderReady } from './providerGate';
import { IDX_MARKET_ADAPTER } from './market/idxMarketAdapter';
import { MarketAdapter, MarketId } from './market/marketAdapter';
import { normalizeSymbol } from './market/instrumentIdentity';
import {
  DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  DEFAULT_SHORTLIST_LIMIT,
  runShortlistStrategy,
  selectShortlistCandidates,
  ShortlistStrategyResult,
} from './strategy/shortlistStrategy';
import { runFeatureGatedShortlistStrategy } from './strategy/featureDrivenShortlist';

export {
  DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  DEFAULT_SHORTLIST_LIMIT,
  runShortlistStrategy,
  selectShortlistCandidates,
} from './strategy/shortlistStrategy';
export { runFeatureGatedShortlistStrategy } from './strategy/featureDrivenShortlist';

export interface ResearchPipelineSummary {
  universeCount: number;
  prefilterPassedCount: number;
  shortlistCandidatesCount: number;
  shortlistEligibleCountBeforeLimit: number;
  shortlistEdgeThreshold: number;
  shortlistLimit: number;
}

export interface ResearchPipelineSnapshot {
  universe: StockData[];
  shortlistCandidates: StockData[];
  shortlistStrategy: ShortlistStrategyResult;
  featuresByTicker: Record<string, TickerFeatureVector>;
  featureProvenanceByTicker: Record<string, FeatureProvenanceSnapshot>;
  featureContext: FeatureContext;
  marketId: MarketId;
  provider: ProviderMetadata;
  providerHealth: ProviderHealth;
  providerReadiness: Record<ResearchUseCase, ProviderReadiness>;
  providerCache?: ProviderCacheSnapshot;
  summary: ResearchPipelineSummary;
  generatedAt: string;
}

export interface ResearchPipeline {
  refresh(settings: StrategySettings): Promise<ResearchPipelineSnapshot>;
  getProvider(): MarketDataProvider;
  getMarket(): MarketAdapter;
}

export type FeatureContextFactory = (
  universe: StockData[],
  provider: MarketDataProvider,
  market: MarketAdapter,
) => Promise<FeatureContext> | FeatureContext;

const MARKET_DATA_PROVIDER_METHODS = [
  'getHealth',
  'getUniverse',
  'getQuote',
  'getDailyBars',
  'getCurrentRegime',
] as const;

export class MarketDataProviderContractError extends Error {
  readonly providerName: string;
  readonly missingMethods: readonly string[];

  constructor(providerName: string, missingMethods: readonly string[]) {
    super(
      `Provider ${providerName} does not satisfy the MarketDataProvider runtime contract: ` +
      `missing callable method(s): ${missingMethods.join(', ')}.`,
    );
    this.name = 'MarketDataProviderContractError';
    this.providerName = providerName;
    this.missingMethods = Object.freeze([...missingMethods]);
  }
}

export function assertMarketDataProviderRuntimeContract(
  provider: MarketDataProvider,
  providerName: string,
): void {
  const candidate = provider as unknown as Record<string, unknown>;
  const missingMethods = MARKET_DATA_PROVIDER_METHODS.filter(
    method => typeof candidate[method] !== 'function',
  );

  if (missingMethods.length > 0) {
    throw new MarketDataProviderContractError(providerName, missingMethods);
  }
}

export class ProviderUniverseContractError extends Error {
  readonly providerName: string;
  readonly receivedType: string;
  readonly invalidEntries: readonly string[];

  constructor(
    providerName: string,
    receivedType: string,
    invalidEntries: readonly string[] = [],
  ) {
    const entryDetail = invalidEntries.length > 0 ? ` Invalid entries: ${invalidEntries.join('; ')}.` : '';
    super(
      `Provider ${providerName} returned an invalid universe payload: ` +
      `expected an array of uniquely identified stocks, received ${receivedType}.` + entryDetail,
    );
    this.name = 'ProviderUniverseContractError';
    this.providerName = providerName;
    this.receivedType = receivedType;
    this.invalidEntries = Object.freeze([...invalidEntries]);
  }
}

function describeRuntimeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function assertProviderUniverseRuntimeContract(
  universe: unknown,
  providerName: string,
): asserts universe is StockData[] {
  if (!Array.isArray(universe)) {
    throw new ProviderUniverseContractError(providerName, describeRuntimeType(universe));
  }

  const invalidEntries: string[] = [];
  const seenTickers = new Set<string>();

  universe.forEach((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      invalidEntries.push(`index ${index}: expected stock object`);
      return;
    }
    const ticker = (entry as Record<string, unknown>).ticker;
    if (typeof ticker !== 'string' || ticker.trim().length === 0) {
      invalidEntries.push(`index ${index}: ticker must be a non-empty string`);
      return;
    }
    const canonicalTicker = normalizeSymbol(ticker);
    if (ticker !== canonicalTicker) {
      invalidEntries.push(`index ${index}: ticker ${JSON.stringify(ticker)} must be canonical ${canonicalTicker}`);
      return;
    }
    if (seenTickers.has(canonicalTicker)) {
      invalidEntries.push(`index ${index}: duplicate ticker ${canonicalTicker}`);
      return;
    }
    seenTickers.add(canonicalTicker);
  });

  if (invalidEntries.length > 0) {
    throw new ProviderUniverseContractError(providerName, 'array with invalid stock identities', invalidEntries);
  }
}

function isCacheAwareProvider(provider: MarketDataProvider): provider is CacheAwareMarketDataProvider {
  const candidate = provider as Partial<CacheAwareMarketDataProvider>;
  return typeof candidate.getCacheSnapshot === 'function';
}

export function buildResearchPipelineSummary(
  universe: StockData[],
  shortlistStrategy: ShortlistStrategyResult = runShortlistStrategy(universe),
): ResearchPipelineSummary {
  return {
    universeCount: universe.length,
    prefilterPassedCount: universe.filter(stock => stock.prefilterPassed).length,
    shortlistCandidatesCount: shortlistStrategy.candidates.length,
    shortlistEligibleCountBeforeLimit: shortlistStrategy.eligibleCountBeforeLimit,
    shortlistEdgeThreshold: shortlistStrategy.policy.edgeThreshold,
    shortlistLimit: shortlistStrategy.policy.limit,
  };
}

/** Provider-driven orchestration boundary: DataProvider -> Feature Engine -> Strategy -> Risk/Execution -> UI. */
export class DefaultResearchPipeline implements ResearchPipeline {
  constructor(
    private readonly provider: MarketDataProvider,
    private readonly seedUniverse?: (settings: StrategySettings) => StockData[],
    private readonly featureContextFactory?: FeatureContextFactory,
    private readonly market: MarketAdapter = IDX_MARKET_ADAPTER,
  ) {}

  getProvider(): MarketDataProvider { return this.provider; }
  getMarket(): MarketAdapter { return this.market; }

  async refresh(settings: StrategySettings): Promise<ResearchPipelineSnapshot> {
    if (this.provider instanceof MockMarketDataProvider && this.seedUniverse) {
      this.provider.setUniverse(this.seedUniverse(settings));
    }

    const providerIdentity = this.provider as unknown as { metadata?: { name?: unknown } };
    const runtimeProviderName = typeof providerIdentity.metadata?.name === 'string'
      ? providerIdentity.metadata.name
      : 'unknown-market-data-provider';
    assertMarketDataProviderRuntimeContract(this.provider, runtimeProviderName);

    const providerStatus = await getProviderStatusSnapshot(
      this.provider, undefined, Date.now(), this.market.identity.marketId,
    );
    assertProviderReady(providerStatus, 'EOD_RESEARCH');

    const providerMode = providerStatus.metadata.mode;
    const providerName = providerStatus.metadata.name;
    const universePayload: unknown = await this.provider.getUniverse();
    assertProviderUniverseRuntimeContract(universePayload, providerName);
    const universe = universePayload;

    if (providerMode !== 'MOCK' && !this.featureContextFactory) {
      throw new Error(
        `Provider ${providerName} requires a point-in-time FeatureContextFactory. ` +
        'Refusing to combine real market data with simulated contextual features.',
      );
    }

    const featureContext = this.featureContextFactory
      ? await this.featureContextFactory(universe, this.provider, this.market)
      : createPrototypeFeatureContext(universe);

    if (providerMode !== 'MOCK' && featureContext.isSimulated) {
      throw new Error(
        `Provider ${providerName} returned a simulated feature context. ` +
        'Research snapshot rejected to prevent synthetic assumptions contaminating real-data backtests.',
      );
    }

    FeatureStore.bindPipelineContext(featureContext);
    const featuresByTicker = Object.fromEntries(
      universe.map(stock => [stock.ticker, FeatureStore.get(stock, featureContext)]),
    );
    const featureProvenanceByTicker = Object.fromEntries(
      Object.entries(featuresByTicker).map(([ticker, vector]) => [
        ticker,
        buildFeatureProvenance(vector, featureContext, providerStatus.metadata),
      ]),
    );

    if (providerMode !== 'MOCK') {
      const unsafeTickers = Object.values(featureProvenanceByTicker)
        .filter(snapshot => !snapshot.productionSafe)
        .map(snapshot => snapshot.ticker);
      if (unsafeTickers.length > 0) {
        throw new Error(
          `Feature provenance validation failed for provider ${providerName}: ` +
          `${unsafeTickers.length} ticker(s) contain simulated or unclassified feature lineage. ` +
          'Research snapshot rejected before strategy/backtest execution.',
        );
      }
    }

    // The compatibility projection still reads legacy StockData-derived shortlist
    // fields. Bind it to canonical provider mode so only explicitly MOCK research
    // can use that bridge; real/delayed/EOD data must wait for authoritative
    // Feature Engine-owned strategy inputs rather than silently trusting provider
    // enrichment fields.
    const shortlistStrategy = runFeatureGatedShortlistStrategy(
      universe,
      featuresByTicker,
      DEFAULT_SHORTLIST_EDGE_THRESHOLD,
      DEFAULT_SHORTLIST_LIMIT,
      providerMode,
    );

    return {
      universe,
      shortlistCandidates: shortlistStrategy.candidates,
      shortlistStrategy,
      featuresByTicker,
      featureProvenanceByTicker,
      featureContext,
      marketId: this.market.identity.marketId,
      provider: providerStatus.metadata,
      providerHealth: providerStatus.health,
      providerReadiness: providerStatus.readiness,
      providerCache: isCacheAwareProvider(this.provider) ? this.provider.getCacheSnapshot() : undefined,
      summary: buildResearchPipelineSummary(universe, shortlistStrategy),
      generatedAt: providerStatus.capturedAt,
    };
  }
}

export function createPrototypeResearchPipeline(): ResearchPipeline {
  return new DefaultResearchPipeline(
    new MockMarketDataProvider(),
    buildUniverse,
    universe => createPrototypeFeatureContext(universe),
    IDX_MARKET_ADAPTER,
  );
}
