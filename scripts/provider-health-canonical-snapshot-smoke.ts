import {
  MockMarketDataProvider,
  type ProviderHealth,
} from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';

const nowMs = Date.parse('2026-09-24T11:00:00.000Z');
const provider = new MockMarketDataProvider();

const vendorHealth = {
  status: 'HEALTHY',
  checkedAt: '2026-09-24T11:00:00.000Z',
  lastSuccessfulSyncAt: '2026-09-24T10:59:30.000Z',
  latencyMs: 18,
  staleAfterSeconds: 120,
  message: '  upstream\nfeed\tready  ',
  vendorRequestId: 'must-not-cross-provider-boundary',
  transport: { socket: 'mutable-vendor-state' },
} as unknown as ProviderHealth;

const snapshot = await getProviderHealthSnapshot(provider, vendorHealth, nowMs);
const healthRecord = snapshot.health as unknown as Record<string, unknown>;

if (healthRecord.vendorRequestId !== undefined || healthRecord.transport !== undefined) {
  throw new Error('provider health snapshots must allowlist canonical fields instead of forwarding vendor-specific runtime state.');
}
if (snapshot.health.message !== 'upstream feed ready') {
  throw new Error('provider health messages must be canonicalized before downstream engine/UI consumption.');
}
if (!Object.isFrozen(snapshot.health) || !Object.isFrozen(snapshot)) {
  throw new Error('canonical provider health evidence and its snapshot envelope must remain immutable.');
}

const oversizedMessage = `${'x'.repeat(300)}\ntransport-noise`;
const boundedSnapshot = await getProviderHealthSnapshot(
  provider,
  {
    status: 'DEGRADED',
    checkedAt: '2026-09-24T11:00:00.000Z',
    message: oversizedMessage,
  },
  nowMs,
);

if (!boundedSnapshot.health.message || boundedSnapshot.health.message.length > 240) {
  throw new Error('canonical provider health messages must remain bounded to 240 characters.');
}
if (/[\r\n\t]/.test(boundedSnapshot.health.message)) {
  throw new Error('canonical provider health messages must not expose multiline/control-character transport noise.');
}

class ThrowingProvider extends MockMarketDataProvider {
  override async getHealth(): Promise<ProviderHealth> {
    throw new Error(`  upstream\n${'failure-context-'.repeat(30)}  `);
  }
}

const failedSnapshot = await getProviderHealthSnapshot(new ThrowingProvider(), undefined, nowMs);
if (failedSnapshot.health.status !== 'UNAVAILABLE') {
  throw new Error('provider health exceptions must fail closed as canonical UNAVAILABLE state.');
}
if (!failedSnapshot.health.message || failedSnapshot.health.message.length > 240) {
  throw new Error('provider exception context must use the same bounded canonical message policy.');
}
if (/[\r\n\t]/.test(failedSnapshot.health.message)) {
  throw new Error('provider exception context must be normalized before downstream consumption.');
}

console.log('Provider-health canonical snapshot smoke passed: vendor-specific runtime fields are stripped, canonical evidence is immutable, and normal/exception health messages share one bounded single-line policy.');
