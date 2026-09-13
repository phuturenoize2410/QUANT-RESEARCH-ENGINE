import { strict as assert } from 'node:assert';
import type { ProviderMetadata } from '../src/engine/dataProviders';
import { MockMarketDataProvider } from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';
import {
  evaluateProviderReadiness,
  getProviderReadinessMatrix,
  validateProviderMetadata,
} from '../src/engine/providerPolicy';

const baseMetadata: ProviderMetadata = {
  id: 'provider-contract-smoke',
  name: 'Provider Contract Smoke',
  source: 'FREE_API',
  mode: 'EOD',
  isPaid: false,
  supportedMarkets: ['IDX'],
  supportsHistorical: true,
  supportsIntraday: false,
  supportsRealtime: false,
};

function expectMetadataIssue(
  metadata: ProviderMetadata,
  expectedFragment: string,
): void {
  const issues = validateProviderMetadata(metadata);
  assert.ok(
    issues.some(issue => issue.includes(expectedFragment)),
    `expected provider metadata issue containing "${expectedFragment}", got: ${issues.join(' | ')}`,
  );

  const readiness = evaluateProviderReadiness(
    metadata,
    {
      status: 'HEALTHY',
      checkedAt: '2026-09-13T02:00:00.000Z',
      lastSuccessfulSyncAt: '2026-09-13T01:59:00.000Z',
    },
    'EOD_RESEARCH',
    'IDX',
  );

  assert.equal(
    readiness.allowed,
    false,
    'contradictory provider metadata must fail closed before research consumption',
  );
}

expectMetadataIssue(
  {
    ...baseMetadata,
    id: 'eod-with-intraday',
    supportsIntraday: true,
  },
  'EOD mode cannot declare intraday support',
);

expectMetadataIssue(
  {
    ...baseMetadata,
    id: 'delayed-with-realtime-capability',
    mode: 'DELAYED',
    supportsIntraday: true,
    supportsRealtime: true,
  },
  'real-time support requires REALTIME mode',
);

expectMetadataIssue(
  {
    ...baseMetadata,
    id: 'realtime-without-intraday-capability',
    mode: 'REALTIME',
    supportsRealtime: true,
    supportsIntraday: false,
  },
  'real-time support requires intraday support',
);

expectMetadataIssue(
  {
    ...baseMetadata,
    id: 'mock-mode-non-mock-source',
    mode: 'MOCK',
  },
  'MOCK mode requires MOCK_ENGINE source',
);

expectMetadataIssue(
  {
    ...baseMetadata,
    id: 'mock-source-non-mock-mode',
    source: 'MOCK_ENGINE',
  },
  'MOCK_ENGINE source requires MOCK mode',
);

const validDelayedMetadata: ProviderMetadata = {
  ...baseMetadata,
  id: 'valid-delayed-provider',
  mode: 'DELAYED',
  supportsIntraday: true,
};

assert.deepEqual(
  validateProviderMetadata(validDelayedMetadata),
  [],
  'delayed intraday providers should remain valid for future free/paid adapters',
);

const validMockMetadata: ProviderMetadata = {
  ...baseMetadata,
  id: 'valid-mock-provider',
  source: 'MOCK_ENGINE',
  mode: 'MOCK',
  supportsIntraday: true,
};

assert.deepEqual(
  validateProviderMetadata(validMockMetadata),
  [],
  'mock adapters should remain valid when source and delivery mode agree',
);

async function expectHealthBoundaryFailure(
  mutate: (metadata: ProviderMetadata) => void,
  expectedFragment: string,
): Promise<void> {
  const provider = new MockMarketDataProvider();
  const metadata = provider.metadata as ProviderMetadata;
  mutate(metadata);
  const snapshot = await getProviderHealthSnapshot(
    provider,
    {
      status: 'HEALTHY',
      checkedAt: '2026-09-13T02:00:00.000Z',
    },
    Date.parse('2026-09-13T02:00:00.000Z'),
  );

  assert.equal(
    snapshot.health.status,
    'UNAVAILABLE',
    'contradictory provider capabilities must fail closed at the shared health/status boundary',
  );
  assert.ok(
    snapshot.health.message?.includes(expectedFragment),
    `expected health boundary metadata context containing "${expectedFragment}", got: ${snapshot.health.message}`,
  );
}

await expectHealthBoundaryFailure(
  metadata => {
    metadata.source = 'FREE_API';
    metadata.mode = 'EOD';
    metadata.supportsIntraday = true;
    metadata.supportsRealtime = false;
  },
  'mode/supportsIntraday',
);

await expectHealthBoundaryFailure(
  metadata => {
    metadata.source = 'FREE_API';
    metadata.mode = 'REALTIME';
    metadata.supportsIntraday = false;
    metadata.supportsRealtime = true;
  },
  'supportsRealtime/supportsIntraday',
);

const readinessMatrixProvider = new MockMarketDataProvider();
const readinessMatrixMetadata = readinessMatrixProvider.metadata as ProviderMetadata;
readinessMatrixMetadata.source = 'FREE_API';
readinessMatrixMetadata.mode = 'EOD';
readinessMatrixMetadata.supportsIntraday = true;
readinessMatrixMetadata.supportsRealtime = false;

const readinessMatrix = await getProviderReadinessMatrix(
  readinessMatrixProvider,
  {
    status: 'HEALTHY',
    checkedAt: '2026-09-13T02:00:00.000Z',
    lastSuccessfulSyncAt: '2026-09-13T01:59:00.000Z',
  },
  Date.parse('2026-09-13T02:00:00.000Z'),
  'IDX',
);

assert.equal(
  readinessMatrix.EOD_RESEARCH.allowed,
  false,
  'matrix-only readiness callers must not bypass canonical runtime metadata validation',
);
assert.ok(
  readinessMatrix.EOD_RESEARCH.reasons.includes('Provider is unavailable.'),
  'invalid runtime provider metadata must be reflected as canonical unavailable health in readiness',
);

console.log('Provider metadata contract smoke checks passed.');
