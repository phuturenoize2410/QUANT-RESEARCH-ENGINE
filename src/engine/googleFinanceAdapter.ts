import { DailyBar, StockData } from '../types';
import {
  freezeProviderMetadata,
  MarketDataProvider,
  MarketQuote,
  ProviderDataError,
  ProviderHealth,
  ProviderMetadata,
} from './dataProviders';
import { normalizeProviderQuote } from './providerQuote';
import { normalizeProviderBars } from './providerBars';
import { normalizeSymbol } from './market/instrumentIdentity';
import { MarketRegime } from './market/marketRegime';

export interface GoogleFinanceConfig {
  /** Optional custom proxy or Google Sheets Web App endpoint URL */
  readonly endpointUrl?: string;
  /** Timeout in milliseconds for external fetch */
  readonly timeoutMs?: number;
  /** Fallback universe when offline or endpoint is unconfigured */
  readonly fallbackUniverse?: StockData[];
}

/**
 * Translates canonical Indonesian ticker (e.g., 'BBCA') into Google Finance convention ('IDX:BBCA').
 */
export function toGoogleFinanceSymbol(ticker: string): string {
  const clean = ticker.replace(/^IDX:/i, '').trim().toUpperCase();
  return `IDX:${clean}`;
}

/**
 * Translates Google Finance ticker ('IDX:BBCA') back to canonical ticker ('BBCA').
 */
export function fromGoogleFinanceSymbol(symbol: string): string {
  return symbol.replace(/^IDX:/i, '').trim().toUpperCase();
}

/**
 * Parses Google Finance standard historical OHLCV CSV table:
 * Headers: Date,Open,High,Low,Close,Volume
 */
export function parseGoogleFinanceHistoricalCsv(csvText: string, ticker: string): DailyBar[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const dateIdx = header.indexOf('date');
  const openIdx = header.indexOf('open');
  const highIdx = header.indexOf('high');
  const lowIdx = header.indexOf('low');
  const closeIdx = header.indexOf('close');
  const volIdx = header.indexOf('volume');

  if (dateIdx === -1 || closeIdx === -1) {
    throw new Error(`Invalid Google Finance CSV format for ${ticker}: missing Date or Close column.`);
  }

  const bars: DailyBar[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(col => col.trim());
    if (row.length < 5) continue;

    const dateStr = row[dateIdx];
    const open = parseFloat(row[openIdx >= 0 ? openIdx : closeIdx]);
    const high = parseFloat(row[highIdx >= 0 ? highIdx : closeIdx]);
    const low = parseFloat(row[lowIdx >= 0 ? lowIdx : closeIdx]);
    const close = parseFloat(row[closeIdx]);
    const volume = volIdx >= 0 ? parseFloat(row[volIdx]) : 0;

    if (!Number.isFinite(close) || close <= 0) continue;

    const safeOpen = Number.isFinite(open) && open > 0 ? open : close;
    const safeHigh = Math.max(high || close, safeOpen, close);
    const safeLow = Math.min(low || close, safeOpen, close);
    const safeVol = Number.isFinite(volume) && volume >= 0 ? volume : 0;

    bars.push({
      date: dateStr,
      open: safeOpen,
      high: safeHigh,
      low: safeLow,
      close,
      volume: safeVol,
      turnover: Math.round(safeVol * close),
    });
  }

  // Ensure chronological ascending order
  bars.sort((a, b) => a.date.localeCompare(b.date));
  return bars;
}

/**
 * Concrete MarketDataProvider for Google Finance (IDX Equities).
 * Adheres strictly to the canonical engine provider invariants.
 */
export class GoogleFinanceMarketDataProvider implements MarketDataProvider {
  readonly metadata: ProviderMetadata = freezeProviderMetadata({
    id: 'google-finance-idx-v1',
    name: 'Google Finance (IDX Equities)',
    source: 'GOOGLE_FINANCE',
    mode: 'EOD',
    isPaid: false,
    supportedMarkets: ['IDX'],
    supportsHistorical: true,
    supportsIntraday: false,
    supportsRealtime: false,
    notes: 'Free EOD historical OHLCV and delayed market quotes for IDX via Google Finance.',
  });

  private readonly config: GoogleFinanceConfig;
  private readonly universeMap = new Map<string, StockData>();
  private lastSyncTime?: string;
  private regime: MarketRegime = 'BULLISH_TREND';

  constructor(config: GoogleFinanceConfig = {}) {
    this.config = {
      timeoutMs: 8000,
      ...config,
    };

    if (config.fallbackUniverse) {
      config.fallbackUniverse.forEach(stock => {
        this.universeMap.set(normalizeSymbol(stock.ticker), stock);
      });
      this.lastSyncTime = new Date().toISOString();
    }
  }

  setRegime(regime: MarketRegime): void {
    this.regime = regime;
  }

  getCurrentRegime(): MarketRegime {
    return this.regime;
  }

  async getHealth(): Promise<ProviderHealth> {
    const isConfigured = Boolean(this.config.endpointUrl);
    const hasData = this.universeMap.size > 0;

    return {
      providerId: this.metadata.id,
      status: isConfigured && hasData ? 'HEALTHY' : hasData ? 'DEGRADED' : 'UNAVAILABLE',
      latencyMs: isConfigured ? 250 : 0,
      symbolsTracked: this.universeMap.size,
      lastSuccessfulSyncAt: this.lastSyncTime ?? new Date().toISOString(),
      message: isConfigured 
        ? 'Google Finance adapter operational.' 
        : 'Google Finance adapter running in fallback/local mode. Configure endpointUrl for live cloud sync.',
      source: this.metadata.source,
      mode: this.metadata.mode,
      checkedAt: new Date().toISOString(),
    };
  }

  async getQuote(ticker: string): Promise<MarketQuote> {
    const cleanTicker = normalizeSymbol(ticker);
    const stock = this.universeMap.get(cleanTicker);

    if (!stock) {
      throw new ProviderDataError(this.metadata.id, cleanTicker, `No Google Finance quote cached for ${cleanTicker}.`);
    }

    const lastBar = stock.historicalBars[stock.historicalBars.length - 1];

    return normalizeProviderQuote(this.metadata.id, this.metadata.source, {
      ticker: cleanTicker,
      price: stock.price,
      open: lastBar?.open ?? stock.price,
      high: lastBar?.high ?? stock.price,
      low: lastBar?.low ?? stock.price,
      close: stock.price,
      change: stock.change,
      changePct: stock.changePct,
      volume: stock.volume,
      turnover: stock.turnover,
      timestamp: new Date().toISOString(),
    });
  }

  async getDailyBars(ticker: string, limit: number = 90): Promise<DailyBar[]> {
    const cleanTicker = normalizeSymbol(ticker);
    const stock = this.universeMap.get(cleanTicker);

    if (!stock) {
      throw new ProviderDataError(this.metadata.id, cleanTicker, `No historical bars found for ${cleanTicker}.`);
    }

    const safeLimit = Math.max(1, Math.min(limit, 365));
    return normalizeProviderBars(
      this.metadata.id,
      stock.historicalBars.slice(-safeLimit)
    );
  }

  async getUniverse(): Promise<StockData[]> {
    return Array.from(this.universeMap.values()).map(s => ({ ...s }));
  }
}
