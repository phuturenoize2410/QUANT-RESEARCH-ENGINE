import assert from 'node:assert/strict';
import { DEFAULT_STRATEGY_SETTINGS } from '../src/engine/analytics';
import { MarketDataProvider } from '../src/engine/dataProviders';
import { ProviderReadinessError } from '../src/engine/providerGate';
import {
  DefaultResearchPipeline,
  MarketDataProviderContractError,
} from '../src/engine/researchPipeline';

let seedCalls = 0;
const nullRootPipeline = new DefaultResearchPipeline(
  null as unknown as MarketDataProvider,
  () => {
    seedCalls += 1;
    return [];
  },
);

await assert.rejects(
  () => nullRootPipeline.refresh(DEFAULT_STRATEGY_SETTINGS),
  error => {
    assert.ok(
      error instanceof ProviderReadinessError,
      'malformed provider roots must fail through the canonical readiness gate, not raw metadata access',
    );
    assert.equal(error.readiness.allowed, false);
    assert.equal(error.status.health.status, 'UNAVAILABLE');
    return true;
  },
);
assert.equal(
  seedCalls,
  0,
  'prototype seed callbacks must never run for malformed/non-mock provider roots',
);

let universeCalls = 0;
let healthCalls = 0;
const malformedMetadataProvider = {
  metadata: null,
  async getHealth() {
    healthCalls += 1;
    return {
      status: 'HEALTHY',
      checkedAt: new Date().toISOString(),
    };
  },
  async getUniverse() {
    universeCalls += 1;
    return [];
  },
  async getQuote() {
    throw new Error('not used');
  },
  async getDailyBars() {
    throw new Error('not used');
  },
  getCurrentRegime() {
    return 'BULLISH_TREND';
  },
} as unknown as MarketDataProvider;

const malformedMetadataPipeline = new DefaultResearchPipeline(
  malformedMetadataProvider,
  () => {
    seedCalls += 1;
    return [];
  },
);

await assert.rejects(
  () => malformedMetadataPipeline.refresh(DEFAULT_STRATEGY_SETTINGS),
  error => {
    assert.ok(error instanceof ProviderReadinessError);
    assert.equal(error.status.metadata.mode, 'MOCK');
    assert.equal(error.status.health.status, 'UNAVAILABLE');
    assert.equal(error.readiness.allowed, false);
    return true;
  },
);
assert.equal(
  universeCalls,
  0,
  'provider ingestion must not run when canonical readiness rejects malformed metadata',
);
assert.equal(
  healthCalls,
  0,
  'malformed provider metadata must fail closed before trusting adapter health methods',
);
assert.equal(
  seedCalls,
  0,
  'metadata claiming or canonicalizing to MOCK must not grant prototype seeding privileges',
);

let incompleteHealthCalls = 0;
const incompleteProvider = {
  metadata: {
    id: 'future-free-provider',
    name: 'Future Free IDX Provider',
    source: 'FREE_API',
    mode: 'EOD',
    isPaid: false,
    supportedMarkets: ['IDX'],
    supportsHistorical: true,
    supportsIntraday: false,
    supportsRealtime: false,
  },
  async getHealth() {
    incompleteHealthCalls += 1;
    const now = new Date().toISOString();
    return {
      status: 'HEALTHY',
      checkedAt: now,
      lastSuccessfulSyncAt: now,
      staleAfterSeconds: 3600,
    };
  },
  async getQuote() {
    throw new Error('not used');
  },
  async getDailyBars() {
    return [];
  },
  getCurrentRegime() {
    return 'BULLISH_TREND';
  },
} as unknown as MarketDataProvider;

const incompleteProviderPipeline = new DefaultResearchPipeline(incompleteProvider);

await assert.rejects(
  () => incompleteProviderPipeline.refresh(DEFAULT_STRATEGY_SETTINGS),
  error => {
    assert.ok(
      error instanceof MarketDataProviderContractError,
      'policy-ready adapters with incomplete market-data methods must fail at the runtime provider contract boundary',
    );
    assert.deepEqual(error.missingMethods, ['getUniverse']);
    assert.equal(error.providerName, 'Future Free IDX Provider');
    return true;
  },
);
assert.equal(
  incompleteHealthCalls,
  1,
  'runtime market-data contract validation should run only after canonical health/readiness has accepted the adapter',
);

console.log('research pipeline provider-boundary smoke passed');
