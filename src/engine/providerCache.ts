import { DailyBar, StockData } from '../types';
import {
  MarketDataProvider,
  MarketQuote,
  ProviderHealth,
  ProviderMetadata,
  ProviderRequestError,
} from './dataProviders';
import { MarketRegime } from './strategyTypes';

export interface ProviderCachePolicy {
  quoteTtlMs: number;
  dailyBarsTtlMs: number;
  universeTtlMs: number;
}

export interface ProviderCacheStats {
  hits: number;
  misses: number;
  writes: number;
}

export interface ProviderCacheSnapshot {
  providerId: string;
  policy: ProviderCachePolicy;
  stats: ProviderCacheStats;
  quoteEntries: number;
  dailyBarEntries: number;
  universeCached: boolean;
  oldestEntryAt?: string;
  newestEntryAt?: string;
}

export interface CacheAwareMarketDataProvider extends MarketDataProvider {
  getCacheSnapshot(): ProviderCacheSnapshot;
  clearCache(): void;
}

interface CacheEntry<T> {
  value: T;
  cachedAtMs: number;
  expiresAtMs: number;
}

const DEFAULT_CACHE_POLICY: ProviderCachePolicy = {
  quoteTtlMs: 15_000,
  dailyBarsTtlMs: 6 * 60 * 60 * 1_000,
  universeTtlMs: 5 * 60 * 1_000,
};

export class ProviderCachePolicyError extends Error {
  constructor(
    readonly providerId: string,
    readonly field: keyof ProviderCachePolicy,
    readonly value: number,
  ) {
    super(`Provider ${providerId} cache policy ${field} must be a finite non-negative number.`);
    this.name = 'ProviderCachePolicyError';
  }
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function requireTicker(ticker: string, providerId: string): string {
  const normalized = normalizeTicker(ticker);
  if (!normalized) {
    throw new ProviderRequestError(providerId, 'ticker', 'Ticker must be a non-empty instrument identity.');
  }
  return normalized;
}

function requireLimit(limit: number, providerId: string): number {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new ProviderRequestError(providerId, 'limit', 'Daily-bar limit must be a positive integer.');
  }
  return limit;
}

function requireCachePolicy(
  providerId: string,
  policy: Partial<ProviderCachePolicy>,
): ProviderCachePolicy {
  const resolved = { ...DEFAULT_CACHE_POLICY, ...policy };
  for (const field of Object.keys(resolved) as Array<keyof ProviderCachePolicy>) {
    const value = resolved[field];
    if (!Number.isFinite(value) || value < 0) {
      throw new ProviderCachePolicyError(providerId, field, value);
    }
  }
  return resolved;
}

function snapshotProviderMetadata(metadata: ProviderMetadata): ProviderMetadata {
  return Object.freeze({
    ...metadata,
    supportedMarkets: Object.freeze([...metadata.supportedMarkets]),
  });
}

function isFiniteBar(bar: DailyBar): boolean {
  return [bar.open, bar.high, bar.low, bar.close, bar.volume, bar.turnover]
    .every(Number.isFinite);
}

function cloneStockData(stock: StockData): StockData {
  return structuredClone(stock);
}

export function normalizeDailyBars(bars: DailyBar[]): DailyBar[] {
  const byDate = new Map<string, DailyBar>();

  bars
    .filter(bar => Boolean(bar.date) && isFiniteBar(bar))
    .forEach(bar => {
      byDate.set(bar.date, { ...bar });
    });

  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeMarketQuote(quote: MarketQuote): MarketQuote {
  return {
    ...quote,
    ticker: normalizeTicker(quote.ticker),
    timestamp: quote.timestamp || new Date().toISOString(),
  };
}

export function normalizeUniverse(universe: StockData[]): StockData[] {
  const byTicker = new Map<string, StockData>();

  universe.forEach(stock => {
    const ticker = normalizeTicker(stock.ticker);
    if (!ticker) return;

    const detached = cloneStockData(stock);
    byTicker.set(ticker, {
      ...detached,
      ticker,
      historicalBars: normalizeDailyBars(detached.historicalBars ?? []),
    });
  });

  return Array.from(byTicker.values())
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export class CachedMarketDataProvider implements CacheAwareMarketDataProvider {
  readonly metadata: ProviderMetadata;

  private readonly quotes = new Map<string, CacheEntry<MarketQuote>>();
  private readonly dailyBars = new Map<string, CacheEntry<DailyBar[]>>();
  private universe?: CacheEntry<StockData[]>;
  private readonly policy: ProviderCachePolicy;
  private readonly stats: ProviderCacheStats = { hits: 0, misses: 0, writes: 0 };

  constructor(
    private readonly delegate: MarketDataProvider,
    policy: Partial<ProviderCachePolicy> = {},
  ) {
    this.metadata = snapshotProviderMetadata(delegate.metadata);
    this.policy = requireCachePolicy(this.metadata.id, policy);
  }

  async getHealth(): Promise<ProviderHealth> {
    return this.delegate.getHealth();
  }

  getCurrentRegime(): MarketRegime {
    return this.delegate.getCurrentRegime();
  }

  async getQuote(ticker: string): Promise<MarketQuote> {
    const key = requireTicker(ticker, this.metadata.id);
    const cached = this.read(this.quotes.get(key));
    if (cached) return { ...cached };

    const normalized = normalizeMarketQuote(await this.delegate.getQuote(key));
    this.quotes.set(key, this.createEntry(normalized, this.policy.quoteTtlMs));
    this.stats.writes += 1;
    return { ...normalized };
  }

  async getDailyBars(ticker: string, limit: number = 90): Promise<DailyBar[]> {
    const normalizedTicker = requireTicker(ticker, this.metadata.id);
    const validatedLimit = requireLimit(limit, this.metadata.id);
    const cachedEntry = this.dailyBars.get(normalizedTicker);
    const cached = this.read(cachedEntry);

    if (cached && cached.length >= validatedLimit) {
      return cached.slice(-validatedLimit).map(bar => ({ ...bar }));
    }

    const bars = normalizeDailyBars(await this.delegate.getDailyBars(normalizedTicker, validatedLimit));
    this.dailyBars.set(
      normalizedTicker,
      this.createEntry(bars, this.policy.dailyBarsTtlMs),
    );
    this.stats.writes += 1;
    return bars.slice(-validatedLimit).map(bar => ({ ...bar }));
  }

  async getUniverse(): Promise<StockData[]> {
    const cached = this.read(this.universe);
    if (cached) return cached.map(cloneStockData);

    const normalized = normalizeUniverse(await this.delegate.getUniverse());
    this.universe = this.createEntry(normalized, this.policy.universeTtlMs);
    this.stats.writes += 1;
    return normalized.map(cloneStockData);
  }

  clearCache(): void {
    this.quotes.clear();
    this.dailyBars.clear();
    this.universe = undefined;
  }

  getCacheSnapshot(): ProviderCacheSnapshot {
    const cachedAtValues = [
      ...Array.from(this.quotes.values()).map(entry => entry.cachedAtMs),
      ...Array.from(this.dailyBars.values()).map(entry => entry.cachedAtMs),
      ...(this.universe ? [this.universe.cachedAtMs] : []),
    ];

    return {
      providerId: this.metadata.id,
      policy: { ...this.policy },
      stats: { ...this.stats },
      quoteEntries: this.quotes.size,
      dailyBarEntries: this.dailyBars.size,
      universeCached: Boolean(this.universe),
      oldestEntryAt: cachedAtValues.length
        ? new Date(Math.min(...cachedAtValues)).toISOString()
        : undefined,
      newestEntryAt: cachedAtValues.length
        ? new Date(Math.max(...cachedAtValues)).toISOString()
        : undefined,
    };
  }

  private read<T>(entry?: CacheEntry<T>): T | undefined {
    if (!entry || entry.expiresAtMs <= Date.now()) {
      this.stats.misses += 1;
      return undefined;
    }

    this.stats.hits += 1;
    return entry.value;
  }

  private createEntry<T>(value: T, ttlMs: number): CacheEntry<T> {
    const cachedAtMs = Date.now();
    return {
      value,
      cachedAtMs,
      expiresAtMs: cachedAtMs + ttlMs,
    };
  }
}
