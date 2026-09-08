import { buildUniverse } from '../data/mockStocks';
import { StrategySettings, StockData } from '../types';
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

/**
 * Snapshot delivered to application/UI consumers.
 * UI code should consume this normalized snapshot rather than constructing
 * market universes or features directly from mock/provider-specific sources.
 */
export interface ResearchPipelineSnapshot {
  universe: StockData[];
  featuresByTicker: Record<string, TickerFeatureVector>;
  provider: ProviderMetadata;
  providerHealth: ProviderHealth;
  providerReadiness: Record<ResearchUseCase, ProviderReadiness>;
  generatedAt: string;
}

export interface ResearchPipeline {
  refresh(settings: StrategySettings): Promise<ResearchPipelineSnapshot>;
  getProvider(): MarketDataProvider;
}

/**
 * Provider-driven orchestration boundary:
 * DataProvider -> Feature Engine -> downstream Strategy/Risk/Execution -> UI.
 *
 * During the prototype phase buildUniverse remains the synthetic data factory,
 * but it is contained behind this boundary. A Google Finance/free API adapter
 * can later replace MockMarketDataProvider without changing App.tsx consumers.
 */
export class DefaultResearchPipeline implements ResearchPipeline {
  constructor(
    private readonly provider: MarketDataProvider,
    private readonly seedUniverse?: (settings: StrategySettings) => StockData[],
  ) {}

  getProvider(): MarketDataProvider {
    return this.provider;
  }

  async refresh(settings: StrategySettings): Promise<ResearchPipelineSnapshot> {
    // Only prototype/mock pipelines are allowed to seed synthetic data.
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

    const featuresByTicker = Object.fromEntries(
      universe.map(stock => [stock.ticker, FeatureStore.get(stock, '15:45 WIB')]),
    );

    return {
      universe,
      featuresByTicker,
      provider: this.provider.metadata,
      providerHealth,
      providerReadiness,
      generatedAt: new Date().toISOString(),
    };
  }
}

export function createPrototypeResearchPipeline(): ResearchPipeline {
  return new DefaultResearchPipeline(new MockMarketDataProvider(), buildUniverse);
}
