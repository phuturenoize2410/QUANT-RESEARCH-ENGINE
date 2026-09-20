import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contracts = readFileSync(resolve(process.cwd(), 'src/engine/providerContracts.ts'), 'utf8');
const providers = readFileSync(resolve(process.cwd(), 'src/engine/dataProviders.ts'), 'utf8');

const sharedContracts = [
  'MarketDataSource',
  'ProviderMode',
  'ProviderHealthStatus',
  'ProviderMetadata',
  'ProviderHealth',
  'HealthCheckedProvider',
] as const;

for (const name of sharedContracts) {
  const authoritativeDeclaration = new RegExp(`export\\s+(?:type|interface)\\s+${name}\\b`);
  if (!authoritativeDeclaration.test(contracts)) {
    throw new Error(`providerContracts.ts must remain the authoritative owner of ${name}.`);
  }

  const duplicateDeclaration = new RegExp(`export\\s+(?:type|interface)\\s+${name}\\b`);
  if (duplicateDeclaration.test(providers)) {
    throw new Error(
      `Concrete DataProvider boundary redeclared ${name}. Import/re-export provider-neutral contracts from providerContracts.ts instead of creating a second vocabulary.`,
    );
  }
}

const typeImportBlock = providers.match(/import\s+type\s*\{([\s\S]*?)\}\s*from\s*['"]\.\/providerContracts['"]/);
if (!typeImportBlock) {
  throw new Error('dataProviders.ts must consume provider-neutral contracts through an explicit type-only import from providerContracts.ts.');
}

const valueImportFromContracts = /import\s+(?!type\b)(?:[\s\S]*?\s+from\s+)?['"]\.\/providerContracts['"]/.test(providers);
const runtimeContractLoad = /(?:\bimport\s*\(|\brequire\s*\()\s*['"]\.\/providerContracts['"]\s*\)/.test(providers);
if (valueImportFromContracts || runtimeContractLoad) {
  throw new Error(
    'providerContracts.ts is a contract-only seam. Concrete providers must not create a runtime dependency on it; use import type so future provider adapters remain implementation-neutral.',
  );
}

for (const name of ['HealthCheckedProvider', 'MarketDataSource', 'ProviderHealth', 'ProviderMetadata'] as const) {
  if (!new RegExp(`\\b${name}\\b`).test(typeImportBlock[1])) {
    throw new Error(`Concrete DataProvider type import is missing ${name}.`);
  }
}

const reexportBlock = providers.match(/export\s+type\s*\{([\s\S]*?)\}\s*from\s*['"]\.\/providerContracts['"]/);
if (!reexportBlock) {
  throw new Error('dataProviders.ts must retain a type-only compatibility re-export from providerContracts.ts while downstream imports migrate.');
}

for (const name of sharedContracts) {
  if (!new RegExp(`\\b${name}\\b`).test(reexportBlock[1])) {
    throw new Error(`Compatibility re-export is missing ${name}.`);
  }
}

console.log('Provider contract ownership passed: providerContracts.ts is authoritative and dataProviders.ts consumes/re-exports the shared provenance and health vocabulary through type-only boundaries.');
