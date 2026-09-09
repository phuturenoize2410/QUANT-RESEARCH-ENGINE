export interface ScoreBounds {
  min: number;
  max: number;
}

/** Canonical 0-100 range for probabilities, normalized features, and percentages. */
export const NORMALIZED_SCORE_BOUNDS: Readonly<ScoreBounds> = Object.freeze({ min: 0, max: 100 });

/** Existing overnight edge contract intentionally reserves 0 and 100 as sentinel extremes. */
export const OVERNIGHT_EDGE_SCORE_BOUNDS: Readonly<ScoreBounds> = Object.freeze({ min: 1, max: 99 });

/** Existing safety/confidence scoring uses a non-zero floor once a score is established. */
export const ESTABLISHED_SCORE_BOUNDS: Readonly<ScoreBounds> = Object.freeze({ min: 5, max: 100 });

export function clampScore(value: number, bounds: ScoreBounds = NORMALIZED_SCORE_BOUNDS): number {
  if (!Number.isFinite(value)) {
    return bounds.min;
  }

  const min = Math.min(bounds.min, bounds.max);
  const max = Math.max(bounds.min, bounds.max);
  return Math.min(max, Math.max(min, value));
}

export function roundScore(value: number, bounds: ScoreBounds = NORMALIZED_SCORE_BOUNDS): number {
  return Math.round(clampScore(value, bounds));
}
