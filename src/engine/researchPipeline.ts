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

export {
  DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  DEFAULT_SHORTLIST_LIMIT,
  runShortlistStrategy,
  selectShortlistCandidates,
} from './strategy/shortlistStrategy';

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

/**
 * TypeScript interfaces disappear at runtime. External adapters therefore need
 * one explicit contract check before ingestion so a provider that passes health
 * and metadata policy cannot crash the pipeline later because a market-data
 * method is absent or non-callable.
 */
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
    const entryDetail =
      invalidEntries.length > 0
        ? ` Invalid entries: ${invalidEntries.join('; ')}.`
        : '';
    super(
      `Provider ${providerName} returned an invalid universe payload: ` +
      `expected an array of uniquely identified stocks, received ${receivedType}.` +
      entryDetail,
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
    throw new ProviderUniverseContractError(
      providerName,
      describeRuntimeType(universe),
    );
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
      invalidEntries.push(
        `index ${index}: ticker ${JSON.stringify(ticker)} must be canonical ${canonicalTicker}`,
      );
      return;
    }

    if (seenTickers.has(canonicalTicker)) {
      invalidEntries.push(`index ${index}: duplicate ticker ${canonicalTicker}`);
      return;
    }

    seenTickers.add(canonicalTicker);
  });

  if (invalidEntries.length > 0) {
    throw new ProviderUniverseContractError(
      providerName,
      'array with invalid stock identities',
      invalidEntries,
    );
  }
}

function isCacheAwareProvider(
  provider: MarketDataProvider,
): provider is CacheAwareMarketDataProvider {
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

/**
 * Provider-driven orchestration boundary:
 * DataProvider -> Feature Context -> Feature Engine -> Strategy/Risk/Execution -> UI.
 *
 * The pipeline is explicitly bound to a market adapter. Provider suitability is
 * checked against that market before universe data is admitted into the research
 * flow, so future IDX/US providers cannot silently feed the wrong market into a
 * shared quant core.
 *
 * Strategy selection is delegated to the strategy engine so this orchestrator
 * coordinates stages without owning eligibility/ranking rules itself. Applied
 * strategy policy travels with the snapshot so downstream consumers do not need
 * to reconstruct thresholds, limits or ranking assumptions.
 *
 * The feature-context factory is deliberately injectable. A future Google Finance,
 * free API, broker or fundamental adapter can populate point-in-time contextual
 * inputs without changing FeatureStore or any UI consumer.
 */
export class DefaultResearchPipeline implements ResearchPipeline {
  constructor(
    private readonly provider: MarketDataProvider,
    private readonly seedUniverse?: (settings: StrategySettings) => StockData[],
    private readonly featureContextFactory?: FeatureContextFactory,
    private readonly market: MarketAdapter = IDX_MARKET_ADAPTER,
  ) {}

  getProvider(): MarketDataProvider {
    return this.provider;
  }

  getMarket(): MarketAdapter {
    return this.market;
  }

  async refresh(settings: StrategySettings): Promise<ResearchPipelineSnapshot> {
    // Prototype seeding is an implementation detail of the known mock adapter,
    // not a decision derived from untrusted provider metadata. This keeps malformed
    // third-party metadata from influencing orchestration before provider policy has
    // produced a canonical status snapshot.
    if (this.provider instanceof MockMarketDataProvider && this.seedUniverse) {
      const seeded = this.seedUniverse(settings);
      this.provider.setUniverse(seeded);
    }

    const providerStatus = await getProviderStatusSnapshot(
      this.provider,
      undefined,
      Date.now(),
      this.market.identity.marketId,
    );

    // The provider-policy layer owns all market/capability/health decisions.
    // Orchestration only enforces the canonical decision before ingestion.
    assertProviderReady(providerStatus, 'EOD_RESEARCH');

    // HealthCheckedProvider is intentionally narrower than MarketDataProvider.
    // Once policy readiness succeeds, verify the full adapter contract before any
    // ingestion call so external/free/paid adapters fail deterministically at the
    // boundary instead of surfacing a raw "is not a function" runtime exception.
    assertMarketDataProviderRuntimeContract(
      this.provider,
      providerStatus.metadata.name,
    );

    // From this point onward, orchestration consumes only canonicalized provider
    // identity/mode. Raw adapter metadata must not steer feature provenance or the
    // real-vs-simulated safety rules after the policy boundary has been crossed.
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

    // Binding is the feature-store safety boundary: it validates lineage and
    // invalidates any vectors cached under the previous point-in-time snapshot.
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

    const shortlistStrategy = runShortlistStrategy(universe);

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
      providerCache: isCacheAwareProvider(this.provider)
        ? this.provider.getCacheSnapshot()
        : undefined,
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
