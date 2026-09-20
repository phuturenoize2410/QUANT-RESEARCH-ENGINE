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

  // A private/local duplicate is just as dangerous as an exported duplicate: it
  // lets concrete adapters drift from the canonical provenance/health vocabulary
  // while appearing compliant at the module boundary. Forbid either form.
  const duplicateDeclaration = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:type|interface)\\s+${name}\\b`);
  if (duplicateDeclaration.test(providers)) {
    throw new Error(
      `Concrete DataProvider boundary redeclared ${name}. Import/re-export provider-neutral contracts from providerContracts.ts instead of creating a second vocabulary.`,
    );
  }
}

const marketTypeImport = /import\s+type\s*\{[^}]*\bMarketId\b[^}]*\}\s*from\s*['"]\.\/market\/marketAdapter['"]/.test(contracts);
const marketValueImport = /import\s+(?!type\b)(?:[\s\S]*?\s+from\s+)?['"]\.\/market\/marketAdapter['"]/.test(contracts);
const marketRuntimeLoad = /(?:\bimport\s*\(|\brequire\s*\()\s*['"]\.\/market\/marketAdapter['"]\s*\)/.test(contracts);
if (!marketTypeImport || marketValueImport || marketRuntimeLoad) {
  throw new Error(
    'providerContracts.ts must consume MarketId through import type only. Provider contracts are evidence/schema declarations and must not create a runtime dependency on the market adapter implementation.',
  );
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

for (const name of sharedContracts) {
  if (!new RegExp(`\\b${name}\\b`).test(typeImportBlock[1])) {
    throw new Error(
      `Concrete DataProvider type import is missing ${name}. All provider-neutral provenance, capability and health contracts must be consumed from providerContracts.ts so future adapters share one authoritative vocabulary.`,
    );
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

console.log('Provider contract ownership passed: providerContracts.ts is authoritative and remains type-only, while dataProviders.ts consumes/re-exports the complete shared provenance, capability and health vocabulary through type-only boundaries without local duplicate declarations.');
