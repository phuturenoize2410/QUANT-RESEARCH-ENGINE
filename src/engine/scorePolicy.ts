export const SCORE_BOUNDS = Object.freeze({
  SCORE: Object.freeze({ min: 0, max: 100 }),
  EDGE_SCORE: Object.freeze({ min: 1, max: 99 }),
  PROBABILITY_PCT: Object.freeze({ min: 0, max: 100 }),
  UNIT_INTERVAL: Object.freeze({ min: 0, max: 1 }),
});

export type NumericBounds = Readonly<{
  min: number;
  max: number;
}>;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function clampToBounds(
  value: number,
  bounds: NumericBounds,
  fallback: number = bounds.min,
): number {
  const finiteValue = finiteOr(value, fallback);
  return Math.min(bounds.max, Math.max(bounds.min, finiteValue));
}

export function clampScore(value: number, fallback: number = 0): number {
  return clampToBounds(value, SCORE_BOUNDS.SCORE, fallback);
}

export function clampRoundedScore(value: number, fallback: number = 0): number {
  return Math.round(clampScore(value, fallback));
}

export function clampEdgeScore(value: number, fallback: number = 1): number {
  return Math.round(clampToBounds(value, SCORE_BOUNDS.EDGE_SCORE, fallback));
}

export function clampProbabilityPct(value: number, fallback: number = 0): number {
  return clampToBounds(value, SCORE_BOUNDS.PROBABILITY_PCT, fallback);
}

export function clampUnitInterval(value: number, fallback: number = 0): number {
  return clampToBounds(value, SCORE_BOUNDS.UNIT_INTERVAL, fallback);
}
