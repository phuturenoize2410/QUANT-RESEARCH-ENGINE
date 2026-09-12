import { StockData, DailyBar, BandarmologyData } from '../types';
import { MarketId } from './market/marketAdapter';
import { normalizeSymbol } from './market/instrumentIdentity';
import { MarketRegime } from './market/marketRegime';

export type MarketDataSource = 'MOCK_ENGINE' | 'GOOGLE_FINANCE' | 'FREE_API' | 'IDX_FEED' | 'BROKER_API';
export type ProviderMode = 'MOCK' | 'DELAYED' | 'EOD' | 'REALTIME';
export type ProviderHealthStatus = 'HEALTHY' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE';

/**
 * Data capabilities are provider concerns, while market identity is carried
 * separately. Keeping them orthogonal avoids encoding vendor, delivery mode and
 * exchange assumptions into one enum as additional markets/providers are added.
 */
export interface ProviderMetadata {
  id: string;
  name: string;
  source: MarketDataSource;
  mode: ProviderMode;
  isPaid: boolean;
  supportedMarkets: readonly MarketId[];
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

/**
 * Smallest provider contract required by infrastructure health/status handling.
 * Market-data and broker-flow adapters both cross external-system boundaries, so
 * health capture must not be coupled to quote/universe methods that only market
 * data providers implement.
 */
export interface HealthCheckedProvider {
  readonly metadata: ProviderMetadata;
  getHealth(): Promise<ProviderHealth>;
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

export interface MarketDataProvider extends HealthCheckedProvider {
  getQuote(ticker: string): Promise<MarketQuote>;
  getDailyBars(ticker: string, limit?: number): Promise<DailyBar[]>;
  getUniverse(): Promise<StockData[]>;
  getCurrentRegime(): MarketRegime;
}

export interface BrokerDataProvider extends HealthCheckedProvider {
  getBrokerSummary(ticker: string): Promise<BandarmologyData>;
  getNetForeignFlow(ticker: string): Promise<number>;
}

export class ProviderDataError extends Error {
  readonly providerId: string;
  readonly ticker: string;

  constructor(providerId: string, ticker: string, message?: string) {
    super(message ?? `Provider ${providerId} has no data for ticker ${ticker}.`);
    this.name = 'ProviderDataError';
    this.providerId = providerId;
    this.ticker = ticker;
  }
}

function copyDailyBars(bars: readonly DailyBar[]): DailyBar[] {
  return bars.map(bar => ({ ...bar }));
}

function copyBandarmology(data: BandarmologyData): BandarmologyData {
  return {
    ...data,
    topBuyers: data.topBuyers.map(item => ({ ...item })),
    topSellers: data.topSellers.map(item => ({ ...item })),
  };
}

/**
 * Providers own their cached records. Clone nested mutable structures at the
 * adapter boundary so feature/strategy/UI consumers cannot mutate provider state
 * through a previously returned snapshot (and callers cannot mutate stored input
 * after setUniverse/constructor ingestion).
 */
function copyStock(stock: StockData): StockData {
  return {
    ...stock,
    historicalBars: copyDailyBars(stock.historicalBars),
    technical: { ...stock.technical },
    bandarmology: copyBandarmology(stock.bandarmology),
    historicalStats: {
      ...stock.historicalStats,
      matchedTrades: stock.historicalStats.matchedTrades.map(trade => ({ ...trade })),
    },
    prefilterFailReasons: [...stock.prefilterFailReasons],
    positiveFactors: [...stock.positiveFactors],
    riskFactors: [...stock.riskFactors],
  };
}

function copyUniverse(universe: readonly StockData[]): StockData[] {
  return universe.map(copyStock);
}

function requireStock(
  universe: readonly StockData[],
  ticker: string,
  providerId: string,
): StockData {
  const canonicalTicker = normalizeSymbol(ticker);
  const stock = universe.find(item => normalizeSymbol(item.ticker) === canonicalTicker);
  if (!stock) {
    throw new ProviderDataError(providerId, canonicalTicker);
  }
  return stock;
}

function mockProviderHealth(
  universeSize: number,
  lastSuccessfulSyncAt: string | undefined,
  healthyMessage: string,
  checkedAt: string = new Date().toISOString(),
): ProviderHealth {
  if (universeSize === 0) {
    return {
      status: 'DEGRADED',
      checkedAt,
      lastSuccessfulSyncAt,
      latencyMs: 0,
      message: 'Mock provider adapter is operational, but no simulated universe is loaded.',
    };
  }

  return {
    status: 'HEALTHY',
    checkedAt,
    lastSuccessfulSyncAt,
    latencyMs: 0,
    message: healthyMessage,
  };
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
    supportedMarkets: Object.freeze(['IDX'] as MarketId[]),
    supportsHistorical: true,
    supportsIntraday: true,
    supportsRealtime: false,
    notes: 'Synthetic prototype data only. Not suitable for live trading decisions.',
  };

  private universeCache: StockData[] = [];
  private regime: MarketRegime = 'BULLISH_TREND';
  private lastSuccessfulSyncAt?: string;

  constructor(initialUniverse: StockData[] = []) {
    this.universeCache = copyUniverse(initialUniverse);
    if (initialUniverse.length > 0) {
      this.lastSuccessfulSyncAt = new Date().toISOString();
    }
  }

  setUniverse(universe: StockData[]) {
    this.universeCache = copyUniverse(universe);
    this.lastSuccessfulSyncAt = universe.length > 0 ? new Date().toISOString() : undefined;
  }

  setRegime(regime: MarketRegime) {
    this.regime = regime;
  }

  async getHealth(): Promise<ProviderHealth> {
    return mockProviderHealth(
      this.universeCache.length,
      this.lastSuccessfulSyncAt,
      'Mock provider operational. Data remains simulated.',
    );
  }

  async getQuote(ticker: string): Promise<MarketQuote> {
    const stock = requireStock(this.universeCache, ticker, this.metadata.id);
    const lastBar = stock.historicalBars[stock.historicalBars.length - 1];
    return {
      ticker: normalizeSymbol(stock.ticker),
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
    const stock = requireStock(this.universeCache, ticker, this.metadata.id);
    return copyDailyBars(stock.historicalBars.slice(-limit));
  }

  async getUniverse(): Promise<StockData[]> {
    return copyUniverse(this.universeCache);
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
    supportedMarkets: Object.freeze(['IDX'] as MarketId[]),
    supportsHistorical: true,
    supportsIntraday: false,
    supportsRealtime: false,
    notes: 'Synthetic broker-flow data only.',
  };

  private universeCache: StockData[] = [];
  private lastSuccessfulSyncAt?: string;

  constructor(initialUniverse: StockData[] = []) {
    this.universeCache = copyUniverse(initialUniverse);
    if (initialUniverse.length > 0) {
      this.lastSuccessfulSyncAt = new Date().toISOString();
    }
  }

  setUniverse(universe: StockData[]) {
    this.universeCache = copyUniverse(universe);
    this.lastSuccessfulSyncAt = universe.length > 0 ? new Date().toISOString() : undefined;
  }

  async getHealth(): Promise<ProviderHealth> {
    return mockProviderHealth(
      this.universeCache.length,
      this.lastSuccessfulSyncAt,
      'Mock broker provider operational. Data remains simulated.',
    );
  }

  async getBrokerSummary(ticker: string): Promise<BandarmologyData> {
    return copyBandarmology(requireStock(this.universeCache, ticker, this.metadata.id).bandarmology);
  }

  async getNetForeignFlow(ticker: string): Promise<number> {
    return requireStock(this.universeCache, ticker, this.metadata.id).bandarmology.netForeignFlow;
  }
}
