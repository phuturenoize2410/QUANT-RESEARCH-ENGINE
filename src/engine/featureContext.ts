import { StockData } from '../types';
import { ProviderMode } from './dataProviders';

export type FeatureContextSource =
  | 'SIMULATED'
  | 'MARKET_PROVIDER'
  | 'BROKER_PROVIDER'
  | 'FUNDAMENTAL_PROVIDER'
  | 'DERIVED';

export interface MarketFeatureContext {
  ihsgRegime: string;
  marketBreadthPctAboveMa20: number;
  marketVolatilityIndex: number;
  sectorRelativeStrength: Record<string, number>;
  sectorMomentumRank: Record<string, number>;
}

export interface FundamentalFeatureSnapshot {
  revenueGrowthYoy: number;
  netMarginPct: number;
  roePct: number;
  pbvRatio: number;
  peRatio: number;
  publishedAt?: string;
}

export interface FeatureContext {
  asOfTimestamp: string;
  mode: ProviderMode;
  isSimulated: boolean;
  market: MarketFeatureContext;
  fundamentalsByTicker: Record<string, FundamentalFeatureSnapshot>;
  sources: {
    market: FeatureContextSource;
    sector: FeatureContextSource;
    broker: FeatureContextSource;
    fundamental: FeatureContextSource;
  };
}

const DEFAULT_FUNDAMENTALS: FundamentalFeatureSnapshot = {
  revenueGrowthYoy: 8.5,
  netMarginPct: 12.0,
  roePct: 11.2,
  pbvRatio: 1.2,
  peRatio: 8.5,
};

/**
 * Prototype-only contextual inputs. Keeping these assumptions outside FeatureStore
 * makes the feature engine provider-agnostic and prevents simulated market/fundamental
 * values from being mistaken for measurements supplied by a live data vendor.
 */
export function createPrototypeFeatureContext(
  universe: StockData[],
  asOfTimestamp: string = '15:45 WIB',
): FeatureContext {
  const fundamentalsByTicker: Record<string, FundamentalFeatureSnapshot> = {};

  for (const stock of universe) {
    fundamentalsByTicker[stock.ticker] = { ...DEFAULT_FUNDAMENTALS };
  }

  fundamentalsByTicker.BBCA = {
    revenueGrowthYoy: 14.2,
    netMarginPct: 38.0,
    roePct: 22.1,
    pbvRatio: 4.8,
    peRatio: 22.5,
  };
  fundamentalsByTicker.BRIS = {
    revenueGrowthYoy: 21.5,
    netMarginPct: 24.5,
    roePct: 17.8,
    pbvRatio: 2.9,
    peRatio: 19.8,
  };
  fundamentalsByTicker.ADRO = {
    revenueGrowthYoy: 18.0,
    netMarginPct: 28.0,
    roePct: 25.4,
    pbvRatio: 1.2,
    peRatio: 8.5,
  };

  return {
    asOfTimestamp,
    mode: 'MOCK',
    isSimulated: true,
    market: {
      ihsgRegime: 'BULLISH TREND ACCUMULATION',
      marketBreadthPctAboveMa20: 68,
      marketVolatilityIndex: 14.8,
      sectorRelativeStrength: {
        Banking: 82,
        Energy: 82,
        'Basic Materials': 76,
      },
      sectorMomentumRank: {
        Banking: 1,
        Energy: 2,
      },
    },
    fundamentalsByTicker,
    sources: {
      market: 'SIMULATED',
      sector: 'SIMULATED',
      broker: 'SIMULATED',
      fundamental: 'SIMULATED',
    },
  };
}

export function getFundamentalSnapshot(
  context: FeatureContext,
  ticker: string,
): FundamentalFeatureSnapshot {
  return context.fundamentalsByTicker[ticker] ?? DEFAULT_FUNDAMENTALS;
}
