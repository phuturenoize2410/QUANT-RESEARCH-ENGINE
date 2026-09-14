import assert from 'node:assert/strict';
import { buildUniverse } from '../src/data/mockStocks';
import { createPrototypeFeatureContext } from '../src/engine/featureContext';
import {
  FeatureInputContractError,
  FeatureStore,
} from '../src/engine/ml/featureStore';
import { StockData } from '../src/types';

const stock = buildUniverse()[0];
const context = createPrototypeFeatureContext([stock], '2026-09-14T15:45:00+07:00');

assert.doesNotThrow(() => FeatureStore.get(stock, context));

const cases: Array<{
  name: string;
  stock: StockData;
  expectedField: string;
}> = [
  {
    name: 'non-finite price',
    stock: { ...stock, price: Number.NaN },
    expectedField: 'price',
  },
  {
    name: 'non-positive price',
    stock: { ...stock, price: 0 },
    expectedField: 'price',
  },
  {
    name: 'non-finite daily return',
    stock: { ...stock, changePct: Number.POSITIVE_INFINITY },
    expectedField: 'changePct',
  },
  {
    name: 'negative volume',
    stock: { ...stock, volume: -1 },
    expectedField: 'volume',
  },
  {
    name: 'negative turnover',
    stock: { ...stock, turnover: -1 },
    expectedField: 'turnover',
  },
  {
    name: 'missing historical bars',
    stock: { ...stock, historicalBars: null as unknown as StockData['historicalBars'] },
    expectedField: 'historicalBars',
  },
  {
    name: 'missing technical snapshot',
    stock: { ...stock, technical: null as unknown as StockData['technical'] },
    expectedField: 'technical',
  },
  {
    name: 'missing broker-flow snapshot',
    stock: { ...stock, bandarmology: null as unknown as StockData['bandarmology'] },
    expectedField: 'bandarmology',
  },
  {
    name: 'missing historical statistics',
    stock: { ...stock, historicalStats: null as unknown as StockData['historicalStats'] },
    expectedField: 'historicalStats',
  },
];

for (const testCase of cases) {
  assert.throws(
    () => FeatureStore.get(testCase.stock, context),
    error => {
      assert.ok(
        error instanceof FeatureInputContractError,
        `${testCase.name} must fail at the Feature Engine input boundary`,
      );
      assert.equal(error.ticker, stock.ticker);
      assert.ok(error.invalidFields.includes(testCase.expectedField));
      return true;
    },
  );
}

console.log('feature input contract smoke passed');
