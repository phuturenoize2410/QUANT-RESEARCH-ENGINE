import type { StockData, DailyBar, BandarmologyData } from '../types';
import type { MarketId } from './market/marketAdapter';
import { normalizeSymbol } from './market/instrumentIdentity';
import type { MarketRegime } from './market/marketRegime';
import { normalizeProviderQuote } from './providerQuote';
import { normalizeProviderBars } from './providerBars';
import type {
  HealthCheckedProvider,
  MarketDataSource,
  ProviderHealth,
  ProviderMetadata,
} from './providerContracts';

// Compatibility re-export: providerContracts is the single authoritative owner.
// Existing consumers can migrate imports incrementally without duplicating the
// contract declarations inside concrete provider implementations.
export type {
  HealthCheckedProvider,
  MarketDataSource,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderMetadata,
  ProviderMode,
} from './providerContracts';

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

export class ProviderRequestError extends Error {
  readonly providerId: string;
  readonly field: 'ticker' | 'limit';

  constructor(providerId: string, field: 'ticker' | 'limit', message: string) {
    super(message);
    this.name = 'ProviderRequestError';
    this.providerId = providerId;
    this.field = field;
  }
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

function canonicalProviderTicker(ticker: string, providerId: string): string {
  const canonicalTicker = normalizeSymbol(ticker);
  if (!canonicalTicker) {
    throw new ProviderRequestError(providerId, 'ticker', `Provider ${providerId} requires a non-empty ticker.`);
  }
  return canonicalTicker;
}

function validateHistoricalLimit(limit: number, providerId: string): number {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new ProviderRequestError(providerId, 'limit', `Provider ${providerId} requires historical limit to be a positive integer.`);
  }
  return limit;
}

function requireStock(universe: readonly StockData[], ticker: string, providerId: string): StockData {
  const canonicalTicker = canonicalProviderTicker(ticker, providerId);
  const stock = universe.find(item => normalizeSymbol(item.ticker) === canonicalTicker);
  if (!stock) throw new ProviderDataError(providerId, canonicalTicker);
  return stock;
}

function mockProviderHealth(universeSize: number, lastSuccessfulSyncAt: string | undefined, healthyMessage: string, checkedAt: string = new Date().toISOString()): ProviderHealth {
  if (universeSize === 0) {
    return Object.freeze({ status: 'DEGRADED', checkedAt, lastSuccessfulSyncAt, latencyMs: 0, message: 'Mock provider adapter is operational, but no simulated universe is loaded.' });
  }
  return Object.freeze({ status: 'HEALTHY', checkedAt, lastSuccessfulSyncAt, latencyMs: 0, message: healthyMessage });
}

function freezeProviderMetadata(metadata: ProviderMetadata): ProviderMetadata {
  return Object.freeze({
    ...metadata,
    supportedMarkets: Object.freeze([...metadata.supportedMarkets]),
  });
}

export class MockMarketDataProvider implements MarketDataProvider {
  readonly metadata: ProviderMetadata = freezeProviderMetadata({
    id: 'mock-market-v1',
    name: 'Mock IDX Market Engine',
    source: 'MOCK_ENGINE',
    mode: 'MOCK',
    isPaid: false,
    supportedMarkets: ['IDX'],
    supportsHistorical: true,
    supportsIntraday: true,
    supportsRealtime: false,
    notes: 'Synthetic prototype data only. Not suitable for live trading decisions.',
  });

  private universeCache: StockData[] = [];
  private regime: MarketRegime = 'BULLISH_TREND';
  private lastSuccessfulSyncAt?: string;

  constructor(initialUniverse: StockData[] = []) {
    this.universeCache = copyUniverse(initialUniverse);
    if (initialUniverse.length > 0) this.lastSuccessfulSyncAt = new Date().toISOString();
  }

  setUniverse(universe: StockData[]) {
    this.universeCache = copyUniverse(universe);
    this.lastSuccessfulSyncAt = universe.length > 0 ? new Date().toISOString() : undefined;
  }

  setRegime(regime: MarketRegime) { this.regime = regime; }

  async getHealth(): Promise<ProviderHealth> {
    return mockProviderHealth(this.universeCache.length, this.lastSuccessfulSyncAt, 'Mock provider operational. Data remains simulated.');
  }

  async getQuote(ticker: string): Promise<MarketQuote> {
    const stock = requireStock(this.universeCache, ticker, this.metadata.id);
    const lastBar = stock.historicalBars[stock.historicalBars.length - 1];
    return normalizeProviderQuote(this.metadata.id, this.metadata.source, {
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
    });
  }

  async getDailyBars(ticker: string, limit: number = 90): Promise<DailyBar[]> {
    const stock = requireStock(this.universeCache, ticker, this.metadata.id);
    return normalizeProviderBars(
      this.metadata.id,
      stock.historicalBars.slice(-validateHistoricalLimit(limit, this.metadata.id)),
    );
  }

  async getUniverse(): Promise<StockData[]> { return copyUniverse(this.universeCache); }
  getCurrentRegime(): MarketRegime { return this.regime; }
}

export class MockBrokerDataProvider implements BrokerDataProvider {
  readonly metadata: ProviderMetadata = freezeProviderMetadata({
    id: 'mock-broker-v1', name: 'Mock IDX Broker Flow Engine', source: 'MOCK_ENGINE', mode: 'MOCK',
    isPaid: false, supportedMarkets: ['IDX'], supportsHistorical: true, supportsIntraday: false,
    supportsRealtime: false, notes: 'Synthetic broker-flow data only.',
  });

  private universeCache: StockData[] = [];
  private lastSuccessfulSyncAt?: string;

  constructor(initialUniverse: StockData[] = []) {
    this.universeCache = copyUniverse(initialUniverse);
    if (initialUniverse.length > 0) this.lastSuccessfulSyncAt = new Date().toISOString();
  }

  setUniverse(universe: StockData[]) {
    this.universeCache = copyUniverse(universe);
    this.lastSuccessfulSyncAt = universe.length > 0 ? new Date().toISOString() : undefined;
  }

  async getHealth(): Promise<ProviderHealth> {
    return mockProviderHealth(this.universeCache.length, this.lastSuccessfulSyncAt, 'Mock broker provider operational. Data remains simulated.');
  }

  async getBrokerSummary(ticker: string): Promise<BandarmologyData> {
    return copyBandarmology(requireStock(this.universeCache, ticker, this.metadata.id).bandarmology);
  }

  async getNetForeignFlow(ticker: string): Promise<number> {
    return requireStock(this.universeCache, ticker, this.metadata.id).bandarmology.netForeignFlow;
  }
}
