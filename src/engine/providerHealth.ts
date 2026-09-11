import {
  HealthCheckedProvider,
  ProviderHealth,
  ProviderMetadata,
} from './dataProviders';
import {
  captureProviderHealth,
  normalizeProviderHealth,
} from './providerPolicy';

/**
 * Vendor-neutral health/status envelope shared by every external data adapter.
 *
 * This intentionally stops before market-data readiness. Market-data providers
 * additionally need research-use-case capability policy, while broker-flow or
 * future alternative-data providers still need the same canonical metadata,
 * health normalization and capture timestamp semantics.
 */
export interface ProviderHealthSnapshot {
  metadata: ProviderMetadata;
  health: ProviderHealth;
  capturedAt: string;
}

/**
 * Capture one canonical health snapshot for any provider crossing an external
 * system boundary. Callers may inject an already captured health payload when
 * coordinating multiple status decisions at the same instant; the payload is
 * still normalized by engine-owned health semantics.
 */
export async function getProviderHealthSnapshot(
  provider: HealthCheckedProvider,
  healthSnapshot?: ProviderHealth,
  nowMs: number = Date.now(),
): Promise<ProviderHealthSnapshot> {
  const health = healthSnapshot
    ? normalizeProviderHealth(healthSnapshot, nowMs)
    : await captureProviderHealth(provider, nowMs);

  return {
    metadata: provider.metadata,
    health,
    capturedAt: new Date(nowMs).toISOString(),
  };
}
