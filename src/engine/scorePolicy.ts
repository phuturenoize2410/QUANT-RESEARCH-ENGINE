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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Score contracts may eventually arrive from strategy configuration or external
 * research metadata. Normalize malformed bounds at the policy boundary so NaN,
 * Infinity, strings, arrays, or nullish runtime payloads can never propagate into
 * strategy ranking, risk decisions, or UI.
 */
export function normalizeScoreBounds(bounds: unknown = NORMALIZED_SCORE_BOUNDS): ScoreBounds {
  const candidate = isRecord(bounds) ? bounds : NORMALIZED_SCORE_BOUNDS;
  const candidateMin = typeof candidate.min === 'number' && Number.isFinite(candidate.min)
    ? candidate.min
    : NORMALIZED_SCORE_BOUNDS.min;
  const candidateMax = typeof candidate.max === 'number' && Number.isFinite(candidate.max)
    ? candidate.max
    : NORMALIZED_SCORE_BOUNDS.max;

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
