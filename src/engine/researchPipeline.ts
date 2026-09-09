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
  getProviderReadinessMatrix,
  normalizeProviderHealth,
  ProviderReadiness,
  ResearchUseCase,
} from './providerPolicy';

export interface ResearchPipelineSnapshot {
  universe: StockData[];
  featuresByTicker: Record<string, TickerFeatureVector>;
  featureProvenanceByTicker: Record<string, FeatureProvenanceSnapshot>;
  featureContext: FeatureContext;
  provider: ProviderMetadata;
  providerHealth: ProviderHealth;
  providerReadiness: Record<ResearchUseCase, ProviderReadiness>;
  providerCache?: ProviderCacheSnapshot;
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

/**
 * Provider-driven orchestration boundary:
 * DataProvider -> Feature Context -> Feature Engine -> Strategy/Risk/Execution -> UI.
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

    // Capture health exactly once per refresh so snapshot health and readiness
    // decisions can never disagree because the adapter changed between calls.
    const [universe, rawProviderHealth] = await Promise.all([
      this.provider.getUniverse(),
      this.provider.getHealth(),
    ]);
    const providerHealth = normalizeProviderHealth(rawProviderHealth);
    const providerReadiness = await getProviderReadinessMatrix(this.provider, providerHealth);

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

    // Bind only after provider/context validation succeeds. Existing consumers that
    // omit the optional context parameter will now inherit this exact validated
    // point-in-time context instead of silently rebuilding prototype assumptions.
    FeatureStore.bindPipelineContext(featureContext);
    FeatureStore.clearCache();

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

    return {
      universe,
      featuresByTicker,
      featureProvenanceByTicker,
      featureContext,
      provider: this.provider.metadata,
      providerHealth,
      providerReadiness,
      providerCache: isCacheAwareProvider(this.provider)
        ? this.provider.getCacheSnapshot()
        : undefined,
      generatedAt: new Date().toISOString(),
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
