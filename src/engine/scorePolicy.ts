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

/** Walk-forward robustness intentionally keeps a stricter floor for degraded out-of-sample results. */
export const RESEARCH_ROBUSTNESS_SCORE_BOUNDS: Readonly<ScoreBounds> = Object.freeze({ min: 10, max: 100 });

/**
 * Score contracts may eventually arrive from strategy configuration or external
 * research metadata. Normalize malformed bounds at the policy boundary so NaN
 * or Infinity can never propagate into strategy ranking, risk decisions, or UI.
 */
export function normalizeScoreBounds(bounds: ScoreBounds = NORMALIZED_SCORE_BOUNDS): ScoreBounds {
  const candidateMin = Number.isFinite(bounds.min) ? bounds.min : NORMALIZED_SCORE_BOUNDS.min;
  const candidateMax = Number.isFinite(bounds.max) ? bounds.max : NORMALIZED_SCORE_BOUNDS.max;

  return {
    min: Math.min(candidateMin, candidateMax),
    max: Math.max(candidateMin, candidateMax),
  };
}

export function clampScore(value: number, bounds: ScoreBounds = NORMALIZED_SCORE_BOUNDS): number {
  const normalizedBounds = normalizeScoreBounds(bounds);

  if (!Number.isFinite(value)) {
    return normalizedBounds.min;
  }

  return Math.min(normalizedBounds.max, Math.max(normalizedBounds.min, value));
}

export function roundScore(value: number, bounds: ScoreBounds = NORMALIZED_SCORE_BOUNDS): number {
  return Math.round(clampScore(value, bounds));
}

/** Semantic helpers keep domain consumers from re-declaring score contracts locally. */
export function clampNormalizedScore(value: number): number {
  return clampScore(value, NORMALIZED_SCORE_BOUNDS);
}

export function roundNormalizedScore(value: number): number {
  return roundScore(value, NORMALIZED_SCORE_BOUNDS);
}

export function roundOvernightEdgeScore(value: number): number {
  return roundScore(value, OVERNIGHT_EDGE_SCORE_BOUNDS);
}

export function roundEstablishedScore(value: number): number {
  return roundScore(value, ESTABLISHED_SCORE_BOUNDS);
}

export function roundResearchRobustnessScore(value: number): number {
  return roundScore(value, RESEARCH_ROBUSTNESS_SCORE_BOUNDS);
}
