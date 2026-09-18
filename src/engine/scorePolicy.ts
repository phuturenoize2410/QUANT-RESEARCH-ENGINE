export interface ScoreBounds {
  readonly min: number;
  readonly max: number;
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
 * Infinity, strings, arrays, nullish payloads, or out-of-domain limits can never
 * propagate into strategy ranking, risk decisions, or UI. Runtime bounds are an
 * atomic contract: both endpoints must be finite numbers before a custom range is
 * accepted. Valid runtime bounds may narrow the canonical score domain, but may
 * never expand beyond 0-100 or define a range wholly disjoint from that domain.
 * The returned policy snapshot is frozen so downstream consumers cannot mutate
 * validated bounds after crossing the canonical boundary.
 */
export function normalizeScoreBounds(bounds: unknown = NORMALIZED_SCORE_BOUNDS): Readonly<ScoreBounds> {
  if (!isRecord(bounds)
    || typeof bounds.min !== 'number'
    || !Number.isFinite(bounds.min)
    || typeof bounds.max !== 'number'
    || !Number.isFinite(bounds.max)) {
    return NORMALIZED_SCORE_BOUNDS;
  }

  const orderedMin = Math.min(bounds.min, bounds.max);
  const orderedMax = Math.max(bounds.min, bounds.max);

  // A custom contract must overlap the canonical domain. Silently collapsing a
  // wholly external range such as 150-200 to 100-100 (or -200--100 to 0-0)
  // would manufacture a degenerate score policy from invalid external metadata.
  if (orderedMax < NORMALIZED_SCORE_BOUNDS.min || orderedMin > NORMALIZED_SCORE_BOUNDS.max) {
    return NORMALIZED_SCORE_BOUNDS;
  }

  return Object.freeze({
    min: Math.min(NORMALIZED_SCORE_BOUNDS.max, Math.max(NORMALIZED_SCORE_BOUNDS.min, orderedMin)),
    max: Math.min(NORMALIZED_SCORE_BOUNDS.max, Math.max(NORMALIZED_SCORE_BOUNDS.min, orderedMax)),
  });
}

export function clampScore(value: number, bounds: Readonly<ScoreBounds> = NORMALIZED_SCORE_BOUNDS): number {
  const normalizedBounds = normalizeScoreBounds(bounds);

  if (!Number.isFinite(value)) {
    return normalizedBounds.min;
  }

  return Math.min(normalizedBounds.max, Math.max(normalizedBounds.min, value));
}

export function roundScore(value: number, bounds: Readonly<ScoreBounds> = NORMALIZED_SCORE_BOUNDS): number {
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
