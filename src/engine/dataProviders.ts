import { StockData, DailyBar, BandarmologyData } from '../types';
import { MarketRegime } from './strategyTypes';

export type MarketDataSource = 'MOCK_ENGINE' | 'GOOGLE_FINANCE' | 'FREE_API' | 'IDX_FEED' | 'BROKER_API';
export type ProviderMode = 'MOCK' | 'DELAYED' | 'EOD' | 'REALTIME';
export type ProviderHealthStatus = 'HEALTHY' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE';

export interface ProviderMetadata {
  id: string;
  name: string;
  source: MarketDataSource;
  mode: ProviderMode;
  isPaid: boolean;
  supportsHistorical: boolean;
  supportsIntraday: boolean;
  supportsRealtime: boolean;
  notes?: string;
}

export interface ProviderHealth {
  status: ProviderHealthStatus;
  checkedAt: string;
  lastSuccessfulSyncAt?: string;
  latencyMs?: number;
  staleAfterSeconds?: number;
  message?: string;
}

export interface MarketQuote {
  ticker: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePct: number;
  volume: number;
  turnover: number;
  timestamp: string;
  source: MarketDataSource;
}

export interface MarketDataProvider {
  readonly metadata: ProviderMetadata;
  getHealth(): Promise<ProviderHealth>;
  getQuote(ticker: string): Promise<MarketQuote>;
  getDailyBars(ticker: string, limit?: number): Promise<DailyBar[]>;
  getUniverse(): Promise<StockData[]>;
  getCurrentRegime(): MarketRegime;
}

export interface BrokerDataProvider {
  readonly metadata: ProviderMetadata;
  getHealth(): Promise<ProviderHealth>;
  getBrokerSummary(ticker: string): Promise<BandarmologyData>;
  getNetForeignFlow(ticker: string): Promise<number>;
}

/**
 * Concrete mock implementation. It intentionally identifies itself as MOCK so
 * downstream UI and research code can never mistake simulated data for a live feed.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  readonly metadata: ProviderMetadata = {
    id: 'mock-market-v1',
    name: 'Mock IDX Market Engine',
    source: 'MOCK_ENGINE',
    mode: 'MOCK',
    isPaid: false,
    supportsHistorical: true,
    supportsIntraday: true,
    supportsRealtime: false,
    notes: 'Synthetic prototype data only. Not suitable for live trading decisions.',
  };

  private universeCache: StockData[] = [];
  private regime: MarketRegime = 'BULLISH_TREND';
  private lastSuccessfulSyncAt = new Date().toISOString();

  constructor(initialUniverse: StockData[] = []) {
    this.universeCache = initialUniverse;
  }

  setUniverse(universe: StockData[]) {
    this.universeCache = universe;
    this.lastSuccessfulSyncAt = new Date().toISOString();
  }

  setRegime(regime: MarketRegime) {
    this.regime = regime;
  }

  async getHealth(): Promise<ProviderHealth> {
    return {
      status: 'HEALTHY',
      checkedAt: new Date().toISOString(),
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      latencyMs: 0,
      message: 'Mock provider operational. Data remains simulated.',
    };
  }

  async getQuote(ticker: string): Promise<MarketQuote> {
    const stock = this.universeCache.find(s => s.ticker === ticker);
    if (!stock) throw new Error(`Ticker ${ticker} not found in MarketDataProvider universe.`);

    const lastBar = stock.historicalBars[stock.historicalBars.length - 1];
    return {
      ticker: stock.ticker,
      price: stock.price,
      open: lastBar ? lastBar.open : stock.price,
      high: lastBar ? lastBar.high : stock.price,
      low: lastBar ? lastBar.low : stock.price,
      close: stock.price,
      change: stock.change,
      changePct: stock.changePct,
      volume: stock.volume,
      turnover: stock.turnover,
      timestamp: new Date().toISOString(),
      source: this.metadata.source,
    };
  }

  async getDailyBars(ticker: string, limit: number = 90): Promise<DailyBar[]> {
    const stock = this.universeCache.find(s => s.ticker === ticker);
    if (!stock) return [];
    return stock.historicalBars.slice(-limit);
  }

  async getUniverse(): Promise<StockData[]> {
    return this.universeCache;
  }

  getCurrentRegime(): MarketRegime {
    return this.regime;
  }
}

export class MockBrokerDataProvider implements BrokerDataProvider {
  readonly metadata: ProviderMetadata = {
    id: 'mock-broker-v1',
    name: 'Mock IDX Broker Flow Engine',
    source: 'MOCK_ENGINE',
    mode: 'MOCK',
    isPaid: false,
    supportsHistorical: true,
    supportsIntraday: false,
    supportsRealtime: false,
    notes: 'Synthetic broker-flow data only.',
  };

  private universeCache: StockData[] = [];
  private lastSuccessfulSyncAt = new Date().toISOString();

  constructor(initialUniverse: StockData[] = []) {
    this.universeCache = initialUniverse;
  }

  setUniverse(universe: StockData[]) {
    this.universeCache = universe;
    this.lastSuccessfulSyncAt = new Date().toISOString();
  }

  async getHealth(): Promise<ProviderHealth> {
    return {
      status: 'HEALTHY',
      checkedAt: new Date().toISOString(),
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      latencyMs: 0,
      message: 'Mock broker provider operational. Data remains simulated.',
    };
  }

  async getBrokerSummary(ticker: string): Promise<BandarmologyData> {
    const stock = this.universeCache.find(s => s.ticker === ticker);
    if (!stock) throw new Error(`Ticker ${ticker} not found in BrokerDataProvider.`);
    return stock.bandarmology;
  }

  async getNetForeignFlow(ticker: string): Promise<number> {
    const stock = this.universeCache.find(s => s.ticker === ticker);
    return stock ? stock.bandarmology.netForeignFlow : 0;
  }
}
