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
}

export type FeatureContextFactory = (
  universe: StockData[],
  provider: MarketDataProvider,
) => Promise<FeatureContext> | FeatureContext;

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
  ) {}

  getProvider(): MarketDataProvider {
    return this.provider;
  }

  async refresh(settings: StrategySettings): Promise<ResearchPipelineSnapshot> {
    if (this.provider.metadata.mode === 'MOCK' && this.seedUniverse) {
      const seeded = this.seedUniverse(settings);
      if (this.provider instanceof MockMarketDataProvider) {
        this.provider.setUniverse(seeded);
      }
    }

    // Provider status is captured through one policy boundary. The pipeline no
    // longer owns freshness normalization or readiness interpretation.
    const [universe, providerStatus] = await Promise.all([
      this.provider.getUniverse(),
      getProviderStatusSnapshot(this.provider),
    ]);

    if (this.provider.metadata.mode !== 'MOCK' && !this.featureContextFactory) {
      throw new Error(
        `Provider ${this.provider.metadata.name} requires a point-in-time FeatureContextFactory. ` +
        'Refusing to combine real market data with simulated contextual features.',
      );
    }

    const featureContext = this.featureContextFactory
      ? await this.featureContextFactory(universe, this.provider)
      : createPrototypeFeatureContext(universe);

    if (this.provider.metadata.mode !== 'MOCK' && featureContext.isSimulated) {
      throw new Error(
        `Provider ${this.provider.metadata.name} returned a simulated feature context. ` +
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
        buildFeatureProvenance(vector, featureContext, this.provider.metadata),
      ]),
    );

    if (this.provider.metadata.mode !== 'MOCK') {
      const unsafeTickers = Object.values(featureProvenanceByTicker)
        .filter(snapshot => !snapshot.productionSafe)
        .map(snapshot => snapshot.ticker);

      if (unsafeTickers.length > 0) {
        throw new Error(
          `Feature provenance validation failed for provider ${this.provider.metadata.name}: ` +
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
  );
}
