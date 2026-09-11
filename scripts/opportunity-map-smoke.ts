import assert from 'node:assert/strict';
import { buildUniverse } from '../src/data/mockStocks';
import {
  buildOpportunityMapProjection,
  DEFAULT_ACTIONABLE_OPPORTUNITY_SCORE,
} from '../src/engine/opportunityMapEngine';
import { getAllStrategies } from '../src/engine/strategies';

const universe = buildUniverse();
const strategies = getAllStrategies();

const projection = buildOpportunityMapProjection(universe, {}, strategies);

assert.ok(universe.length > 0, 'mock universe should contain stocks');
assert.ok(strategies.length > 0, 'strategy registry should contain strategies');
assert.equal(
  projection.summary.actionableSetups,
  projection.opportunities.length,
  'summary actionable count must come from the canonical projection',
);
assert.ok(
  projection.opportunities.every(
    item => item.topScoreResult.score >= DEFAULT_ACTIONABLE_OPPORTUNITY_SCORE,
  ),
  'default projection must enforce the canonical actionable score floor',
);

for (let index = 1; index < projection.opportunities.length; index += 1) {
  assert.ok(
    projection.opportunities[index - 1].topScoreResult.score >=
      projection.opportunities[index].topScoreResult.score,
    'opportunities must remain ranked by winning-strategy score',
  );
}

const expectedStrongBuys = projection.opportunities.filter(
  item => item.topScoreResult.signal === 'STRONG BUY',
).length;
const expectedBuys = projection.opportunities.filter(
  item => item.topScoreResult.signal === 'BUY',
).length;
const expectedAverageReturn = projection.opportunities.length
  ? projection.opportunities.reduce(
      (sum, item) => sum + item.topScoreResult.expectedReturnPct,
      0,
    ) / projection.opportunities.length
  : 0;

assert.equal(projection.summary.strongBuyCount, expectedStrongBuys);
assert.equal(projection.summary.buyCount, expectedBuys);
assert.equal(projection.summary.averageExpectedReturnPct, expectedAverageReturn);

const invalidFloorProjection = buildOpportunityMapProjection(
  universe,
  { actionableScoreFloor: Number.NaN },
  strategies,
);
assert.deepEqual(
  invalidFloorProjection.opportunities.map(item => item.stock.ticker),
  projection.opportunities.map(item => item.stock.ticker),
  'invalid score floors must fall back to the canonical default',
);

const cappedFloorProjection = buildOpportunityMapProjection(
  universe,
  { actionableScoreFloor: 1000 },
  strategies,
);
assert.ok(
  cappedFloorProjection.opportunities.every(item => item.topScoreResult.score >= 100),
  'score floor must be capped at the canonical 0-100 score range',
);

const firstSector = universe[0].sector;
const sectorProjection = buildOpportunityMapProjection(
  universe,
  { sector: firstSector, actionableScoreFloor: 0 },
  strategies,
);
assert.ok(
  sectorProjection.opportunities.every(item => item.stock.sector === firstSector),
  'sector filtering belongs to the canonical projection, not React',
);

const emptyStrategyProjection = buildOpportunityMapProjection(universe, {}, []);
assert.equal(emptyStrategyProjection.opportunities.length, 0);
assert.equal(emptyStrategyProjection.summary.actionableSetups, 0);
assert.equal(emptyStrategyProjection.summary.averageExpectedReturnPct, 0);

console.log('Opportunity map projection smoke checks passed.');
