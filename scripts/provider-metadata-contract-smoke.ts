import { strict as assert } from 'node:assert';
import type { ProviderMetadata } from '../src/engine/dataProviders';
import {
  evaluateProviderReadiness,
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

console.log('Provider metadata contract smoke checks passed.');
