import { clampScore, OVERNIGHT_EDGE_SCORE_BOUNDS } from '../scorePolicy';

export const DEFAULT_SHORTLIST_EDGE_THRESHOLD = 50;
export const DEFAULT_SHORTLIST_LIMIT = 10;

/**
 * Provider-agnostic Strategy Engine input. Payload is opaque to the strategy
 * core: eligibility and ranking may depend only on strategy-owned fields.
 */
export interface ShortlistCoreCandidate<TPayload> {
  ticker: string;
  payload: TPayload;
  prefilterPassed: boolean;
  overnightEdgeScore: number;
}

export interface ShortlistStrategyPolicy {
  edgeThreshold: number;
  limit: number;
  requiresPrefilter: true;
  ranking: 'OVERNIGHT_EDGE_DESC';
}

export interface ShortlistCoreResult<TPayload> {
  candidates: TPayload[];
  evaluatedUniverseCount: number;
  eligibleCountBeforeLimit: number;
  policy: ShortlistStrategyPolicy;
}

export class ShortlistStrategyInputError extends Error {
  readonly invalidTickers: readonly string[];

  constructor(invalidTickers: readonly string[]) {
    super(
      'Shortlist strategy rejected malformed derived inputs for ticker(s): ' +
      `${invalidTickers.join(', ')}. Expected boolean prefilterPassed and finite ` +
      'overnightEdgeScore within canonical score bounds.',
    );
    this.name = 'ShortlistStrategyInputError';
    this.invalidTickers = Object.freeze([...invalidTickers]);
  }
}

function normalizeShortlistLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_SHORTLIST_LIMIT;
  }

  return Math.max(0, Math.floor(limit));
}

function assertShortlistCoreInputs<TPayload>(
  candidates: readonly ShortlistCoreCandidate<TPayload>[],
): void {
  const invalidTickers: string[] = [];

  candidates.forEach((candidate, index) => {
    const ticker = typeof candidate?.ticker === 'string' && candidate.ticker.length > 0
      ? candidate.ticker
      : `index:${index}`;
    const prefilterValid = typeof candidate?.prefilterPassed === 'boolean';
    const score = candidate?.overnightEdgeScore;
    const scoreValid =
      typeof score === 'number' &&
      Number.isFinite(score) &&
      score >= OVERNIGHT_EDGE_SCORE_BOUNDS.min &&
      score <= OVERNIGHT_EDGE_SCORE_BOUNDS.max;

    if (!prefilterValid || !scoreValid || ticker === `index:${index}`) {
      invalidTickers.push(ticker);
    }
  });

  if (invalidTickers.length > 0) {
    throw new ShortlistStrategyInputError(invalidTickers);
  }
}

/**
 * Canonical shortlist evaluator. It has no dependency on provider, feature,
 * application, or UI models; the result payload passes through opaquely.
 */
export function runShortlistCore<TPayload>(
  candidates: ShortlistCoreCandidate<TPayload>[],
  shortlistEdgeThreshold: number = DEFAULT_SHORTLIST_EDGE_THRESHOLD,
  shortlistLimit: number = DEFAULT_SHORTLIST_LIMIT,
): ShortlistCoreResult<TPayload> {
  assertShortlistCoreInputs(candidates);

  const normalizedThreshold = clampScore(
    shortlistEdgeThreshold,
    OVERNIGHT_EDGE_SCORE_BOUNDS,
  );
  const normalizedLimit = normalizeShortlistLimit(shortlistLimit);
  const eligible = candidates
    .filter(
      candidate =>
        candidate.prefilterPassed &&
        candidate.overnightEdgeScore >= normalizedThreshold,
    )
    .sort((a, b) => b.overnightEdgeScore - a.overnightEdgeScore);

  return {
    candidates: eligible.slice(0, normalizedLimit).map(candidate => candidate.payload),
    evaluatedUniverseCount: candidates.length,
    eligibleCountBeforeLimit: eligible.length,
    policy: {
      edgeThreshold: normalizedThreshold,
      limit: normalizedLimit,
      requiresPrefilter: true,
      ranking: 'OVERNIGHT_EDGE_DESC',
    },
  };
}
