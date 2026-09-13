import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProviderMetadata } from '../src/engine/dataProviders';
import { MockMarketDataProvider } from '../src/engine/dataProviders';
import { getProviderHealthSnapshot } from '../src/engine/providerHealth';
import {
  evaluateProviderReadiness,
  getProviderReadinessMatrix,
  providerSupportsMarket,
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

const mixedCaseMarketMetadata = {
  ...baseMetadata,
  id: 'mixed-case-market-provider',
  supportedMarkets: [' idx '],
} as unknown as ProviderMetadata;

assert.equal(
  providerSupportsMarket(mixedCaseMarketMetadata, 'IDX'),
  true,
  'market compatibility must use the same trim/case normalization as canonical provider metadata snapshots',
);

const mixedCaseDirectReadiness = evaluateProviderReadiness(
  mixedCaseMarketMetadata,
  {
    status: 'HEALTHY',
    checkedAt: '2026-09-13T02:00:00.000Z',
    lastSuccessfulSyncAt: '2026-09-13T01:59:00.000Z',
  },
  'EOD_RESEARCH',
  'IDX',
);
assert.equal(
  mixedCaseDirectReadiness.allowed,
  true,
  'direct readiness must not disagree with the canonical snapshot path only because provider market casing differs',
);

const malformedRuntimeMetadata = {
  ...baseMetadata,
  id: 'malformed-runtime-provider',
  source: 'UNTRUSTED_VENDOR',
  mode: 'STREAMING',
  supportsHistorical: 'yes',
  supportsIntraday: 1,
  supportsRealtime: 'false',
  isPaid: 'no',
  supportedMarkets: 'IDX',
} as unknown as ProviderMetadata;

const malformedIssues = validateProviderMetadata(malformedRuntimeMetadata);
assert.ok(
  malformedIssues.some(issue => issue.includes('source is not recognized')),
  'runtime provider source values outside the canonical contract must be rejected',
);
assert.ok(
  malformedIssues.some(issue => issue.includes('mode is not recognized')),
  'runtime provider modes outside the canonical contract must be rejected',
);
assert.ok(
  malformedIssues.some(issue => issue.includes('supportsHistorical must be boolean')),
  'truthy non-boolean historical capability must not be treated as valid support',
);
assert.ok(
  malformedIssues.some(issue => issue.includes('supportedMarkets must be an array')),
  'runtime provider market declarations must preserve the canonical array shape',
);

const malformedDirectReadiness = evaluateProviderReadiness(
  malformedRuntimeMetadata,
  {
    status: 'HEALTHY',
    checkedAt: '2026-09-13T02:00:00.000Z',
    lastSuccessfulSyncAt: '2026-09-13T01:59:00.000Z',
  },
  'EOD_RESEARCH',
  'IDX',
);
assert.equal(
  malformedDirectReadiness.allowed,
  false,
  'direct readiness evaluation must fail closed on malformed runtime metadata',
);
assert.ok(
  malformedDirectReadiness.reasons.some(reason => reason.includes('supportsHistorical must be boolean')),
  'direct readiness must surface malformed capability context instead of accepting truthy runtime values',
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

const researchPipelineSource = readFileSync(
  resolve(process.cwd(), 'src/engine/researchPipeline.ts'),
  'utf8',
);
assert.ok(
  researchPipelineSource.includes(
    'buildFeatureProvenance(vector, featureContext, providerStatus.metadata)',
  ),
  'feature provenance must use the canonical metadata captured by provider status before ingestion',
);
assert.ok(
  !researchPipelineSource.includes(
    'buildFeatureProvenance(vector, featureContext, this.provider.metadata)',
  ),
  'feature provenance must not re-read mutable raw provider metadata after the readiness boundary',
);

console.log('Provider metadata contract smoke checks passed.');
