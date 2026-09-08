import { DailyBar } from '../types';
import { normalizeDailyBars } from './providerCache';

export interface HistoricalSeriesKey {
  providerId: string;
  ticker: string;
}

export interface HistoricalStoreWriteMetadata {
  fetchedAt: string;
  sourceMode: 'MOCK' | 'DELAYED' | 'EOD' | 'REALTIME';
  isSimulated: boolean;
}

export interface HistoricalStoreRecord extends HistoricalSeriesKey {
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
 * The first concrete implementation is in-memory, but adapters for IndexedDB,
 * SQLite/Postgres or object storage can implement this contract without changing
 * feature, strategy, risk/execution or UI code.
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
  providerId: string;
  ticker: string;
  asOfDate: string;
  bars: DailyBar[];
  metadata: HistoricalStoreWriteMetadata;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function seriesId(key: HistoricalSeriesKey): string {
  return `${key.providerId.trim()}::${normalizeTicker(key.ticker)}`;
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
    const key: HistoricalSeriesKey = {
      providerId: record.providerId.trim(),
      ticker: normalizeTicker(record.ticker),
    };
    const id = seriesId(key);
    const existing = this.records.get(id);
    const mergedBars = normalizeDailyBars([
      ...(existing?.bars ?? []),
      ...record.bars,
    ]);

    this.records.set(id, {
      ...key,
      bars: mergedBars.map(bar => ({ ...bar })),
      metadata: { ...record.metadata },
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
      providerId: record.providerId,
      ticker: record.ticker,
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
    providerId: record.providerId,
    ticker: record.ticker,
    asOfDate,
    bars: record.bars,
    metadata: record.metadata,
  };
}

function cloneRecord(record: HistoricalStoreRecord): HistoricalStoreRecord {
  return {
    providerId: record.providerId,
    ticker: record.ticker,
    bars: record.bars.map(bar => ({ ...bar })),
    metadata: { ...record.metadata },
  };
}
