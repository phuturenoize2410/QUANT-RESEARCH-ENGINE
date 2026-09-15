import { ProviderMetadata } from './dataProviders';
import {
  ProviderReadiness,
  ProviderStatusSnapshot,
  ResearchUseCase,
} from './providerPolicy';

const snapshotReadiness = (readiness: ProviderReadiness): ProviderReadiness => Object.freeze({
  useCase: readiness.useCase,
  allowed: readiness.allowed,
  reasons: Object.freeze([...readiness.reasons]) as unknown as string[],
  warnings: Object.freeze([...readiness.warnings]) as unknown as string[],
});

const snapshotProviderMetadata = (metadata: ProviderMetadata): ProviderMetadata => Object.freeze({
  ...metadata,
  supportedMarkets: Object.freeze([...metadata.supportedMarkets]),
});

const missingReadiness = (useCase: ResearchUseCase): ProviderReadiness => snapshotReadiness({
  useCase,
  allowed: false,
  reasons: [`Provider readiness snapshot is missing or malformed for ${useCase}.`],
  warnings: [],
});

const isDiagnosticArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(
    item => typeof item === 'string' && item.trim().length > 0,
  );

/**
 * Runtime guard for readiness payloads crossing adapter/cache/persistence boundaries.
 * TypeScript types do not protect against malformed JSON, stale cached snapshots or
 * third-party adapters. A readiness decision is usable only when its use case,
 * boolean decision and diagnostic arrays all satisfy the canonical contract.
 * Allowed decisions cannot carry blocking reasons, while rejected decisions must
 * explain why they failed so downstream UI/telemetry never has to infer policy.
 */
export function isProviderReadiness(value: unknown, useCase: ResearchUseCase): value is ProviderReadiness {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ProviderReadiness>;
  if (
    candidate.useCase !== useCase ||
    typeof candidate.allowed !== 'boolean' ||
    !isDiagnosticArray(candidate.reasons) ||
    !isDiagnosticArray(candidate.warnings)
  ) {
    return false;
  }

  return candidate.allowed
    ? candidate.reasons.length === 0
    : candidate.reasons.length > 0;
}

/**
 * Resolve one canonical readiness decision without trusting runtime payload shape.
 *
 * ProviderStatusSnapshot is strongly typed inside the engine, but future provider
 * adapters, caches and persisted status payloads are external boundaries at
 * runtime. Missing, malformed or older snapshots fail closed instead of allowing
 * truthy non-boolean values or incomplete diagnostics to bypass provider policy.
 * Valid decisions are defensively snapshotted so callers cannot mutate a status
 * object after the enforcement boundary and silently change the decision or its
 * diagnostics for downstream UI/telemetry consumers.
 */
export function getProviderReadiness(
  status: ProviderStatusSnapshot,
  useCase: ResearchUseCase,
): ProviderReadiness {
  const readiness = status.readiness?.[useCase] as unknown;
  return isProviderReadiness(readiness, useCase)
    ? snapshotReadiness(readiness)
    : missingReadiness(useCase);
}

export class ProviderReadinessError extends Error {
  readonly status: ProviderStatusSnapshot;
  readonly provider: ProviderMetadata;
  readonly useCase: ResearchUseCase;
  readonly readiness: ProviderReadiness;

  constructor(status: ProviderStatusSnapshot, useCase: ResearchUseCase) {
    const readiness = getProviderReadiness(status, useCase);
    const provider = snapshotProviderMetadata(status.metadata);
    const marketContext = status.targetMarket
      ? ` for target market ${status.targetMarket}`
      : '';
    const reasons = readiness.reasons.length > 0
      ? ` ${readiness.reasons.join(' ')}`
      : '';

    super(
      `Provider ${provider.name} is not ready for ${useCase}${marketContext}.` +
      `${reasons} Pipeline rejected before data ingestion.`,
    );

    this.name = 'ProviderReadinessError';
    // Preserve canonical snapshots of the policy decision and provider identity
    // that caused rejection. External adapters/caches may still mutate the source
    // status object, but downstream UI/telemetry must not observe provider identity
    // drifting away from the readiness decision captured at this boundary.
    this.status = status;
    this.provider = provider;
    this.useCase = useCase;
    this.readiness = readiness;
  }
}

/**
 * Canonical enforcement boundary for provider suitability.
 *
 * ProviderPolicy owns the suitability decision; orchestration, strategy and UI
 * consumers should enforce that decision through this gate instead of rebuilding
 * market, freshness or capability rules locally. Keeping the thrown error typed
 * and carrying canonical readiness/provider snapshots gives downstream status
 * surfaces a stable, vendor-neutral failure contract without re-evaluating policy.
 * Missing or malformed runtime readiness decisions fail closed through the same
 * typed error. The returned decision is an immutable defensive snapshot.
 */
export function assertProviderReady(
  status: ProviderStatusSnapshot,
  useCase: ResearchUseCase,
): ProviderReadiness {
  const readiness = getProviderReadiness(status, useCase);
  if (!readiness.allowed) {
    throw new ProviderReadinessError(status, useCase);
  }

  return readiness;
}
