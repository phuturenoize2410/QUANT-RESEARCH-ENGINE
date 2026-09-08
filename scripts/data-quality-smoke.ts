import { buildOvernightPointInTimeDataset } from '../src/engine/pointInTimeDataset';
import { assertBacktestDatasetQuality, validateHistoricalBars } from '../src/engine/dataQuality';
import type { DailyBar } from '../src/types';

const bars: DailyBar[] = [
  { date: '2026-01-02', open: 100, high: 103, low: 99, close: 102, volume: 1_000_000, turnover: 102_000_000 },
  { date: '2026-01-05', open: 103, high: 105, low: 101, close: 104, volume: 1_100_000, turnover: 114_400_000 },
  { date: '2026-01-06', open: 104, high: 106, low: 102, close: 105, volume: 1_050_000, turnover: 110_250_000 },
  { date: '2026-01-07', open: 106, high: 108, low: 104, close: 107, volume: 1_200_000, turnover: 128_400_000 },
];

const report = validateHistoricalBars('TEST', bars);
if (!report.valid) {
  throw new Error(`Expected clean OHLCV bars, got: ${JSON.stringify(report.issues)}`);
}

const samples = buildOvernightPointInTimeDataset('TEST', bars, {
  lookbackBars: 3,
  minimumObservationBars: 2,
});
assertBacktestDatasetQuality(samples);

const contaminated: DailyBar[] = [
  { ...bars[0], nextOpen: 999 },
];
const contaminatedReport = validateHistoricalBars('TEST', contaminated);
if (contaminatedReport.valid || !contaminatedReport.issues.some(issue => issue.code === 'FUTURE_FIELD_PRESENT')) {
  throw new Error('Future-field leakage was not rejected by the data-quality gate.');
}

const brokenOhlc: DailyBar[] = [
  { date: '2026-01-02', open: 100, high: 99, low: 98, close: 101, volume: 100, turnover: 10_000 },
];
const brokenReport = validateHistoricalBars('TEST', brokenOhlc);
if (brokenReport.valid || !brokenReport.issues.some(issue => issue.code === 'OHLC_INCONSISTENCY')) {
  throw new Error('OHLC inconsistency was not rejected by the data-quality gate.');
}

console.log(`Data-quality smoke passed: ${samples.length} point-in-time samples validated.`);
