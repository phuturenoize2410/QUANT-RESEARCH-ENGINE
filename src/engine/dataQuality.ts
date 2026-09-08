import { DailyBar } from '../types';
import { PointInTimeTrainingSample, assertDatasetChronology } from './pointInTimeDataset';
import { normalizeDailyBars } from './providerCache';

export interface HistoricalDataQualityIssue {
  code:
    | 'EMPTY_DATASET'
    | 'INVALID_DATE'
    | 'INVALID_PRICE'
    | 'INVALID_VOLUME'
    | 'OHLC_INCONSISTENCY'
    | 'DUPLICATE_DATE'
    | 'NON_MONOTONIC_DATE'
    | 'FUTURE_FIELD_PRESENT';
  severity: 'ERROR' | 'WARNING';
  message: string;
  date?: string;
}

export interface HistoricalDataQualityReport {
  ticker: string;
  rawBars: number;
  canonicalBars: number;
  valid: boolean;
  issues: HistoricalDataQualityIssue[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Provider-independent OHLCV quality gate. Run this before persisting external
 * market data or using it to build research/backtest datasets.
 */
export function validateHistoricalBars(
  ticker: string,
  bars: DailyBar[],
  options: { allowFutureFields?: boolean } = {},
): HistoricalDataQualityReport {
  const issues: HistoricalDataQualityIssue[] = [];
  const seenDates = new Set<string>();
  let previousDate: string | undefined;

  if (bars.length === 0) {
    issues.push({
      code: 'EMPTY_DATASET',
      severity: 'ERROR',
      message: 'No historical bars were supplied.',
    });
  }

  bars.forEach((bar, index) => {
    if (!ISO_DATE.test(bar.date)) {
      issues.push({
        code: 'INVALID_DATE',
        severity: 'ERROR',
        date: bar.date,
        message: `Bar ${index} has a non-canonical date: ${bar.date}.`,
      });
    }

    if (seenDates.has(bar.date)) {
      issues.push({
        code: 'DUPLICATE_DATE',
        severity: 'WARNING',
        date: bar.date,
        message: `Duplicate trading date ${bar.date}; normalization will keep the last bar.`,
      });
    }
    seenDates.add(bar.date);

    if (previousDate && bar.date < previousDate) {
      issues.push({
        code: 'NON_MONOTONIC_DATE',
        severity: 'WARNING',
        date: bar.date,
        message: `Input bars are not ascending at ${bar.date}; normalization will reorder them.`,
      });
    }
    previousDate = bar.date;

    const prices = [bar.open, bar.high, bar.low, bar.close];
    if (prices.some(value => !Number.isFinite(value) || value <= 0)) {
      issues.push({
        code: 'INVALID_PRICE',
        severity: 'ERROR',
        date: bar.date,
        message: `Bar ${bar.date} contains a non-positive or non-finite OHLC price.`,
      });
    }

    if (!Number.isFinite(bar.volume) || bar.volume < 0 || !Number.isFinite(bar.turnover) || bar.turnover < 0) {
      issues.push({
        code: 'INVALID_VOLUME',
        severity: 'ERROR',
        date: bar.date,
        message: `Bar ${bar.date} contains invalid volume or turnover.`,
      });
    }

    if (
      Number.isFinite(bar.high) && Number.isFinite(bar.low) &&
      Number.isFinite(bar.open) && Number.isFinite(bar.close) &&
      (bar.high < Math.max(bar.open, bar.close, bar.low) ||
        bar.low > Math.min(bar.open, bar.close, bar.high))
    ) {
      issues.push({
        code: 'OHLC_INCONSISTENCY',
        severity: 'ERROR',
        date: bar.date,
        message: `Bar ${bar.date} violates OHLC range consistency.`,
      });
    }

    if (!options.allowFutureFields && hasFutureFields(bar)) {
      issues.push({
        code: 'FUTURE_FIELD_PRESENT',
        severity: 'ERROR',
        date: bar.date,
        message: `Bar ${bar.date} contains next-session fields in an observation-safe dataset.`,
      });
    }
  });

  const canonicalBars = normalizeDailyBars(bars).length;

  return {
    ticker: ticker.trim().toUpperCase(),
    rawBars: bars.length,
    canonicalBars,
    valid: !issues.some(issue => issue.severity === 'ERROR'),
    issues,
  };
}

/**
 * Fails fast when a dataset is unsafe for research/backtesting. This combines
 * point-in-time chronology checks with OHLCV observation-window validation.
 */
export function assertBacktestDatasetQuality(samples: PointInTimeTrainingSample[]): void {
  assertDatasetChronology(samples);

  for (const sample of samples) {
    const report = validateHistoricalBars(sample.ticker, sample.observationBars);
    if (!report.valid) {
      const errors = report.issues
        .filter(issue => issue.severity === 'ERROR')
        .map(issue => `${issue.code}: ${issue.message}`)
        .join('; ');
      throw new Error(
        `Backtest data-quality violation for ${sample.ticker} at ${sample.asOfDate}: ${errors}`,
      );
    }
  }
}

function hasFutureFields(bar: DailyBar): boolean {
  return bar.nextOpen !== undefined ||
    bar.nextHigh !== undefined ||
    bar.nextLow !== undefined ||
    bar.nextClose !== undefined;
}
