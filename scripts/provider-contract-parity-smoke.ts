import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contracts = readFileSync(resolve(process.cwd(), 'src/engine/providerContracts.ts'), 'utf8');
const providers = readFileSync(resolve(process.cwd(), 'src/engine/dataProviders.ts'), 'utf8');

const sharedTypeAliases = ['MarketDataSource', 'ProviderMode', 'ProviderHealthStatus'] as const;
const sharedInterfaces = ['ProviderMetadata', 'ProviderHealth', 'HealthCheckedProvider'] as const;

function normalize(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
}

function typeAlias(source: string, name: string): string {
  const match = source.match(new RegExp(`export\\s+type\\s+${name}\\s*=([\\s\\S]*?);`));
  if (!match) throw new Error(`Provider contract parity cannot find type ${name}.`);
  return normalize(match[1]);
}

function interfaceBody(source: string, name: string): string {
  const match = source.match(new RegExp(`export\\s+interface\\s+${name}(?:\\s+extends\\s+[^\\{]+)?\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Provider contract parity cannot find interface ${name}.`);
  return normalize(match[1]);
}

const drift: string[] = [];
for (const name of sharedTypeAliases) {
  if (typeAlias(contracts, name) !== typeAlias(providers, name)) drift.push(name);
}
for (const name of sharedInterfaces) {
  if (interfaceBody(contracts, name) !== interfaceBody(providers, name)) drift.push(name);
}

if (drift.length > 0) {
  throw new Error(
    `Provider-neutral contracts drifted from the concrete DataProvider boundary: ${drift.join(', ')}. Keep provenance/health semantics identical while the legacy declarations are migrated to imports/re-exports from providerContracts.ts. Future Google Finance/free/paid adapters must not create a second contract vocabulary.`,
  );
}

console.log('Provider contract parity passed: shared provider provenance and health contracts remain identical across the neutral contract seam and concrete DataProvider boundary.');
