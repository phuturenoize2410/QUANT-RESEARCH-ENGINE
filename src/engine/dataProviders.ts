import { StockData, DailyBar, BandarmologyData } from '../types';
import { MarketRegime } from './strategyTypes';

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
  source: 'MOCK_ENGINE' | 'GOOGLE_FINANCE' | 'IDX_FEED' | 'BROKER_API';
}

export interface MarketDataProvider {
  getQuote(ticker: string): Promise<MarketQuote>;
  getDailyBars(ticker: string, limit?: number): Promise<DailyBar[]>;
  getUniverse(): Promise<StockData[]>;
  getCurrentRegime(): MarketRegime;
}

export interface BrokerDataProvider {
  getBrokerSummary(ticker: string): Promise<BandarmologyData>;
  getNetForeignFlow(ticker: string): Promise<number>;
}

/**
 * Concrete Mock Implementation of MarketDataProvider
 * Simulates real-time IDX quotes, historical daily bars, and macro regime.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  private universeCache: StockData[] = [];
  private regime: MarketRegime = 'BULLISH_TREND';

  constructor(initialUniverse: StockData[] = []) {
    this.universeCache = initialUniverse;
  }

  setUniverse(universe: StockData[]) {
    this.universeCache = universe;
  }

  setRegime(regime: MarketRegime) {
    this.regime = regime;
  }

  async getQuote(ticker: string): Promise<MarketQuote> {
    const stock = this.universeCache.find(s => s.ticker === ticker);
    if (!stock) {
      throw new Error(`Ticker ${ticker} not found in MarketDataProvider universe.`);
    }
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
      source: 'MOCK_ENGINE',
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

/**
 * Concrete Mock Implementation of BrokerDataProvider
 * Simulates Bandarmology accumulation/distribution flows and foreign net transactions.
 */
export class MockBrokerDataProvider implements BrokerDataProvider {
  private universeCache: StockData[] = [];

  constructor(initialUniverse: StockData[] = []) {
    this.universeCache = initialUniverse;
  }

  setUniverse(universe: StockData[]) {
    this.universeCache = universe;
  }

  async getBrokerSummary(ticker: string): Promise<BandarmologyData> {
    const stock = this.universeCache.find(s => s.ticker === ticker);
    if (!stock) {
      throw new Error(`Ticker ${ticker} not found in BrokerDataProvider.`);
    }
    return stock.bandarmology;
  }

  async getNetForeignFlow(ticker: string): Promise<number> {
    const stock = this.universeCache.find(s => s.ticker === ticker);
    return stock ? stock.bandarmology.netForeignFlow : 0;
  }
}
