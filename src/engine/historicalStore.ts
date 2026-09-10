import { DailyBar } from '../types';
import { normalizeDailyBars } from './providerCache';
import { buildInstrumentId, normalizeSymbol } from './market/instrumentIdentity';
import { MarketId } from './market/marketAdapter';

export interface HistoricalSeriesKey {
  instrumentId: string;
}

export interface HistoricalStoreWriteMetadata {
  fetchedAt: string;
  sourceMode: 'MOCK' | 'DELAYED' | 'EOD' | 'REALTIME';
  isSimulated: boolean;
  providerId: string;
}

export interface HistoricalStoreRecord extends HistoricalSeriesKey {
  symbol: string;
  marketId: MarketId;
  bars: DailyBar[];
  metadata: HistoricalStoreWriteMetadata;
}

export interface HistoricalStoreSnapshot {
  seriesCount: number;
  barCount: number;
  oldestBarDate?: string;
  newestBarDate?: string;
  newestWriteAt?: string;
}

/**
 * Persistent-storage boundary for canonical historical OHLCV data.
 *
 * Series identity is provider-independent. Provider provenance remains attached
 * to write metadata so future adapters can replace or reconcile data sources
 * without forcing feature/strategy/ML consumers to change storage keys.
 */
export interface HistoricalStore {
  upsert(record: HistoricalStoreRecord): Promise<void>;
  readSeries(key: HistoricalSeriesKey): Promise<HistoricalStoreRecord | undefined>;
  readAsOf(
    key: HistoricalSeriesKey,
    asOfDate: string,
    limit?: number,
  ): Promise<HistoricalStoreRecord | undefined>;
  getSnapshot(): Promise<HistoricalStoreSnapshot>;
  clear(): Promise<void>;
}

export interface PointInTimeSeries {
  instrumentId: string;
  symbol: string;
  marketId: MarketId;
  asOfDate: string;
  bars: DailyBar[];
  metadata: HistoricalStoreWriteMetadata;
}

export function createHistoricalSeriesKey(
  marketId: MarketId,
  symbol: string,
): HistoricalSeriesKey {
  return { instrumentId: buildInstrumentId(marketId, symbol) };
}

function normalizeInstrumentId(instrumentId: string): string {
  return instrumentId.trim().toUpperCase();
}

function seriesId(key: HistoricalSeriesKey): string {
  return normalizeInstrumentId(key.instrumentId);
}

/**
 * Future-label fields are useful for evaluating an already-generated signal,
 * but they must never enter a feature snapshot. Strip them at the point-in-time
 * boundary so a caller cannot accidentally leak tomorrow's prices into today.
 */
export function stripFutureLabels(bar: DailyBar): DailyBar {
  const {
    nextOpen: _nextOpen,
    nextHigh: _nextHigh,
    nextLow: _nextLow,
    nextClose: _nextClose,
    ...observable
  } = bar;

  return { ...observable };
}

export function buildPointInTimeBars(
  bars: DailyBar[],
  asOfDate: string,
  limit?: number,
): DailyBar[] {
  const observableBars = normalizeDailyBars(bars)
    .filter(bar => bar.date <= asOfDate)
    .map(stripFutureLabels);

  const bounded = typeof limit === 'number'
    ? observableBars.slice(-Math.max(0, limit))
    : observableBars;

  assertPointInTimeSafe(bounded, asOfDate);
  return bounded;
}

export function assertPointInTimeSafe(bars: DailyBar[], asOfDate: string): void {
  for (const bar of bars) {
    if (bar.date > asOfDate) {
      throw new Error(
        `Point-in-time violation: bar ${bar.date} is after as-of date ${asOfDate}.`,
      );
    }

    if (
      bar.nextOpen !== undefined ||
      bar.nextHigh !== undefined ||
      bar.nextLow !== undefined ||
      bar.nextClose !== undefined
    ) {
      throw new Error(
        `Look-ahead violation: ${bar.date} still contains future-label price fields.`,
      );
    }
  }
}

/**
 * Reference implementation used by the prototype and tests. The API mirrors a
 * future durable store so persistence can be introduced without changing the
 * research pipeline contract.
 */
export class InMemoryHistoricalStore implements HistoricalStore {
  private readonly records = new Map<string, HistoricalStoreRecord>();

  async upsert(record: HistoricalStoreRecord): Promise<void> {
    const symbol = normalizeSymbol(record.symbol);
    const marketId = String(record.marketId).trim().toUpperCase() as MarketId;
    const canonicalInstrumentId = buildInstrumentId(marketId, symbol);

    if (normalizeInstrumentId(record.instrumentId) !== canonicalInstrumentId) {
      throw new Error(
        `Historical series identity mismatch: ${record.instrumentId} does not match ` +
        `${marketId}:${symbol}.`,
      );
    }

    const key: HistoricalSeriesKey = { instrumentId: canonicalInstrumentId };
    const id = seriesId(key);
    const existing = this.records.get(id);
    const mergedBars = normalizeDailyBars([
      ...(existing?.bars ?? []),
      ...record.bars,
    ]);

    this.records.set(id, {
      instrumentId: canonicalInstrumentId,
      symbol,
      marketId,
      bars: mergedBars.map(bar => ({ ...bar })),
      metadata: {
        ...record.metadata,
        providerId: record.metadata.providerId.trim(),
      },
    });
  }

  async readSeries(
    key: HistoricalSeriesKey,
  ): Promise<HistoricalStoreRecord | undefined> {
    const record = this.records.get(seriesId(key));
    return record ? cloneRecord(record) : undefined;
  }

  async readAsOf(
    key: HistoricalSeriesKey,
    asOfDate: string,
    limit?: number,
  ): Promise<HistoricalStoreRecord | undefined> {
    const record = this.records.get(seriesId(key));
    if (!record) return undefined;

    return {
      instrumentId: record.instrumentId,
      symbol: record.symbol,
      marketId: record.marketId,
      bars: buildPointInTimeBars(record.bars, asOfDate, limit),
      metadata: { ...record.metadata },
    };
  }

  async getSnapshot(): Promise<HistoricalStoreSnapshot> {
    const records = Array.from(this.records.values());
    const allBars = records.flatMap(record => record.bars);
    const allDates = allBars.map(bar => bar.date).sort();
    const writeTimes = records
      .map(record => record.metadata.fetchedAt)
      .filter(Boolean)
      .sort();

    return {
      seriesCount: records.length,
      barCount: allBars.length,
      oldestBarDate: allDates[0],
      newestBarDate: allDates[allDates.length - 1],
      newestWriteAt: writeTimes[writeTimes.length - 1],
    };
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

export async function createPointInTimeSeries(
  store: HistoricalStore,
  key: HistoricalSeriesKey,
  asOfDate: string,
  limit?: number,
): Promise<PointInTimeSeries | undefined> {
  const record = await store.readAsOf(key, asOfDate, limit);
  if (!record) return undefined;

  return {
    instrumentId: record.instrumentId,
    symbol: record.symbol,
    marketId: record.marketId,
    asOfDate,
    bars: record.bars,
    metadata: record.metadata,
  };
}

function cloneRecord(record: HistoricalStoreRecord): HistoricalStoreRecord {
  return {
    instrumentId: record.instrumentId,
    symbol: record.symbol,
    marketId: record.marketId,
    bars: record.bars.map(bar => ({ ...bar })),
    metadata: { ...record.metadata },
  };
}
