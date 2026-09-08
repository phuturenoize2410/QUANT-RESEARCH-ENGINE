import { buildUniverse } from '../data/mockStocks';
import { StrategySettings, StockData } from '../types';
import {
  createPrototypeFeatureContext,
  FeatureContext,
} from './featureContext';
import { FeatureStore } from './ml/featureStore';
import { TickerFeatureVector } from './ml/types';
import {
  MarketDataProvider,
  MockMarketDataProvider,
  ProviderHealth,
  ProviderMetadata,
} from './dataProviders';
import {
  getProviderReadinessMatrix,
  ProviderReadiness,
  ResearchUseCase,
} from './providerPolicy';

export interface ResearchPipelineSnapshot {
  universe: StockData[];
  featuresByTicker: Record<string, TickerFeatureVector>;
  featureContext: FeatureContext;
  provider: ProviderMetadata;
  providerHealth: ProviderHealth;
  providerReadiness: Record<ResearchUseCase, ProviderReadiness>;
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

    const [universe, providerHealth, providerReadiness] = await Promise.all([
      this.provider.getUniverse(),
      this.provider.getHealth(),
      getProviderReadinessMatrix(this.provider),
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

    FeatureStore.clearCache();
    const featuresByTicker = Object.fromEntries(
      universe.map(stock => [stock.ticker, FeatureStore.get(stock, featureContext)]),
    );

    return {
      universe,
      featuresByTicker,
      featureContext,
      provider: this.provider.metadata,
      providerHealth,
      providerReadiness,
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
