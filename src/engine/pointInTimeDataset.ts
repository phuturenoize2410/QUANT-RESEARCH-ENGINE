import { DailyBar } from '../types';
import { buildPointInTimeBars } from './historicalStore';
import { normalizeDailyBars } from './providerCache';

export interface OvernightOutcomeLabel {
  entryDate: string;
  exitDate: string;
  entryClose: number;
  nextOpen: number;
  grossGapPct: number;
  isGapDown1Pct: boolean;
  isGapDown2Pct: boolean;
}

export interface PointInTimeTrainingSample {
  ticker: string;
  asOfDate: string;
  observationBars: DailyBar[];
  label: OvernightOutcomeLabel;
}

export interface PointInTimeDatasetOptions {
  lookbackBars?: number;
  minimumObservationBars?: number;
}

/**
 * Builds supervised overnight samples without placing the next-session outcome
 * inside the observation window. The next open is created as a separate label
 * only after the point-in-time feature window has been frozen.
 */
export function buildOvernightPointInTimeDataset(
  ticker: string,
  bars: DailyBar[],
  options: PointInTimeDatasetOptions = {},
): PointInTimeTrainingSample[] {
  const canonical = normalizeDailyBars(bars);
  const lookbackBars = Math.max(1, options.lookbackBars ?? 60);
  const minimumObservationBars = Math.max(
    1,
    Math.min(lookbackBars, options.minimumObservationBars ?? 20),
  );
  const samples: PointInTimeTrainingSample[] = [];

  for (let i = 0; i < canonical.length - 1; i += 1) {
    const entryBar = canonical[i];
    const nextBar = canonical[i + 1];

    if (!isValidPrice(entryBar.close) || !isValidPrice(nextBar.open)) continue;

    const observationBars = buildPointInTimeBars(
      canonical.slice(0, i + 1),
      entryBar.date,
      lookbackBars,
    );

    if (observationBars.length < minimumObservationBars) continue;

    const grossGapPct = ((nextBar.open / entryBar.close) - 1) * 100;

    samples.push({
      ticker: ticker.trim().toUpperCase(),
      asOfDate: entryBar.date,
      observationBars,
      label: {
        entryDate: entryBar.date,
        exitDate: nextBar.date,
        entryClose: entryBar.close,
        nextOpen: nextBar.open,
        grossGapPct,
        isGapDown1Pct: grossGapPct < -1,
        isGapDown2Pct: grossGapPct < -2,
      },
    });
  }

  assertDatasetChronology(samples);
  return samples;
}

export function assertDatasetChronology(
  samples: PointInTimeTrainingSample[],
): void {
  for (const sample of samples) {
    const latestObservation = sample.observationBars[sample.observationBars.length - 1];

    if (!latestObservation || latestObservation.date !== sample.asOfDate) {
      throw new Error(
        `Point-in-time dataset violation for ${sample.ticker}: observation window ` +
        `does not terminate at ${sample.asOfDate}.`,
      );
    }

    if (sample.label.exitDate <= sample.asOfDate) {
      throw new Error(
        `Point-in-time dataset violation for ${sample.ticker}: label date ` +
        `${sample.label.exitDate} must be after ${sample.asOfDate}.`,
      );
    }

    const leakedFuturePrice = sample.observationBars.some(
      bar =>
        bar.nextOpen !== undefined ||
        bar.nextHigh !== undefined ||
        bar.nextLow !== undefined ||
        bar.nextClose !== undefined,
    );

    if (leakedFuturePrice) {
      throw new Error(
        `Look-ahead violation for ${sample.ticker} at ${sample.asOfDate}: ` +
        'future-label price fields leaked into observations.',
      );
    }
  }
}

function isValidPrice(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
