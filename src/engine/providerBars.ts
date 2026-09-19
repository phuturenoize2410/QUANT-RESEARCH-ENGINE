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

function validateRequiredObservation(value: number | undefined, providerId: string, index: number, field: string): void {
  if (value === undefined) {
    throw new ProviderBarsError(providerId, index, `Historical bar ${field} is required.`);
  }
  validatePrice(value, providerId, index, field);
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
  if (typeof providerId !== 'string' || providerId.trim().length === 0) {
    throw new ProviderBarsError(typeof providerId === 'string' ? providerId : '', -1, 'Historical provider identity must be a non-empty string.');
  }

  // Adapter identities are provenance, not display labels. Canonicalize boundary
  // whitespace once so health/status diagnostics cannot split one provider into
  // multiple identities because of configuration or transport formatting.
  const canonicalProviderId = providerId.trim();
  let previousDate = '';

  const normalized = bars.map((bar, index) => {
    if (!isValidCalendarDate(bar.date)) {
      throw new ProviderBarsError(canonicalProviderId, index, 'Historical bar date must be a valid YYYY-MM-DD calendar date.');
    }
    if (previousDate && bar.date <= previousDate) {
      throw new ProviderBarsError(canonicalProviderId, index, 'Historical bars must be strictly ordered by ascending unique date.');
    }
    previousDate = bar.date;

    validateRequiredObservation(bar.open, canonicalProviderId, index, 'open');
    validateRequiredObservation(bar.high, canonicalProviderId, index, 'high');
    validateRequiredObservation(bar.low, canonicalProviderId, index, 'low');
    validateRequiredObservation(bar.close, canonicalProviderId, index, 'close');
    validateRequiredObservation(bar.volume, canonicalProviderId, index, 'volume');
    validateRequiredObservation(bar.turnover, canonicalProviderId, index, 'turnover');
    validatePrice(bar.nextOpen, canonicalProviderId, index, 'nextOpen');
    validatePrice(bar.nextHigh, canonicalProviderId, index, 'nextHigh');
    validatePrice(bar.nextLow, canonicalProviderId, index, 'nextLow');
    validatePrice(bar.nextClose, canonicalProviderId, index, 'nextClose');

    validateRange(bar.high, bar.low, bar.open, bar.close, canonicalProviderId, index, 'current');
    validateRange(bar.nextHigh, bar.nextLow, bar.nextOpen, bar.nextClose, canonicalProviderId, index, 'next-session');

    return Object.freeze({ ...bar });
  });

  return Object.freeze(normalized) as DailyBar[];
}
