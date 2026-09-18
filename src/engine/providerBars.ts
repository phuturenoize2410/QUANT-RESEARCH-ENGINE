import type { DailyBar } from '../types';

export class ProviderBarsError extends Error {
  readonly providerId: string;
  readonly index: number;

  constructor(providerId: string, index: number, message: string) {
    super(message);
    this.name = 'ProviderBarsError';
    this.providerId = providerId;
    this.index = index;
  }
}

function validatePrice(value: number | undefined, providerId: string, index: number, field: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new ProviderBarsError(providerId, index, `Historical bar ${field} must be finite and non-negative.`);
  }
}

function validateRange(high: number | undefined, low: number | undefined, open: number | undefined, close: number | undefined, providerId: string, index: number, label: string): void {
  if (high === undefined && low === undefined && open === undefined && close === undefined) return;
  if (high === undefined || low === undefined || open === undefined || close === undefined || high < low || high < open || high < close || low > open || low > close) {
    throw new ProviderBarsError(providerId, index, `Historical bar ${label} OHLC fields are internally inconsistent.`);
  }
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

/**
 * Canonical validation/copy boundary for historical market-data adapters.
 * Vendor-specific adapters should map payloads to DailyBar first, then pass the
 * result here before Feature Engine consumers receive historical observations.
 * The canonical snapshot is frozen so downstream stages cannot mutate provider
 * evidence after validation/provenance has been established.
 */
export function normalizeProviderBars(providerId: string, bars: readonly DailyBar[]): DailyBar[] {
  let previousDate = '';

  const normalized = bars.map((bar, index) => {
    if (!isValidCalendarDate(bar.date)) {
      throw new ProviderBarsError(providerId, index, 'Historical bar date must be a valid YYYY-MM-DD calendar date.');
    }
    if (previousDate && bar.date <= previousDate) {
      throw new ProviderBarsError(providerId, index, 'Historical bars must be strictly ordered by ascending unique date.');
    }
    previousDate = bar.date;

    validatePrice(bar.open, providerId, index, 'open');
    validatePrice(bar.high, providerId, index, 'high');
    validatePrice(bar.low, providerId, index, 'low');
    validatePrice(bar.close, providerId, index, 'close');
    validatePrice(bar.volume, providerId, index, 'volume');
    validatePrice(bar.turnover, providerId, index, 'turnover');
    validatePrice(bar.nextOpen, providerId, index, 'nextOpen');
    validatePrice(bar.nextHigh, providerId, index, 'nextHigh');
    validatePrice(bar.nextLow, providerId, index, 'nextLow');
    validatePrice(bar.nextClose, providerId, index, 'nextClose');

    validateRange(bar.high, bar.low, bar.open, bar.close, providerId, index, 'current');
    validateRange(bar.nextHigh, bar.nextLow, bar.nextOpen, bar.nextClose, providerId, index, 'next-session');

    return Object.freeze({ ...bar });
  });

  return Object.freeze(normalized) as DailyBar[];
}
