import { StockData } from '../types';
import { computeEnsembleConsensus } from './quantLabEngine';
import { getAllStrategies } from './strategies';
import { EnsembleConsensus, StrategyEngine, StrategyScoreResult } from './strategyTypes';

export const DEFAULT_ACTIONABLE_OPPORTUNITY_SCORE = 45;

export type OpportunitySessionFilter = 'ALL' | 'AM' | 'PM';

export interface OpportunityProjectionItem {
  stock: StockData;
  ensemble: EnsembleConsensus;
  topStrategy: StrategyEngine;
  topScoreResult: StrategyScoreResult;
  allScores: Array<{
    strategy: StrategyEngine;
    scoreResult: StrategyScoreResult;
  }>;
}

export interface OpportunityProjectionFilters {
  session?: OpportunitySessionFilter;
  strategyId?: string;
  sector?: string;
  actionableScoreFloor?: number;
}

export interface OpportunityProjectionSummary {
  actionableSetups: number;
  strongBuyCount: number;
  buyCount: number;
  averageExpectedReturnPct: number;
}

export interface OpportunityMapProjection {
  opportunities: OpportunityProjectionItem[];
  summary: OpportunityProjectionSummary;
}

function normalizeScoreFloor(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_ACTIONABLE_OPPORTUNITY_SCORE;
  }
  return Math.min(100, Math.max(0, value));
}

/**
 * Canonical Strategy Engine projection for the opportunity map.
 *
 * React consumers must not re-score stocks, choose the winning strategy, or
 * invent their own actionable score threshold. Those are research/strategy
 * decisions and live here so future provider adapters can feed the same engine
 * without UI-specific behavior changes.
 */
export function buildOpportunityMapProjection(
  universe: StockData[],
  filters: OpportunityProjectionFilters = {},
  strategies: StrategyEngine[] = getAllStrategies(),
): OpportunityMapProjection {
  const scoreFloor = normalizeScoreFloor(filters.actionableScoreFloor);
  const session = filters.session ?? 'ALL';
  const strategyId = filters.strategyId ?? 'ALL';
  const sector = filters.sector ?? 'ALL';

  const opportunities = universe
    .map<OpportunityProjectionItem | null>(stock => {
      const allScores = strategies.map(strategy => ({
        strategy,
        scoreResult: strategy.score(stock),
      }));

      if (allScores.length === 0) return null;

      const top = allScores.reduce((best, candidate) =>
        candidate.scoreResult.score > best.scoreResult.score ? candidate : best,
      );

      return {
        stock,
        ensemble: computeEnsembleConsensus(stock, strategies),
        topStrategy: top.strategy,
        topScoreResult: top.scoreResult,
        allScores,
      };
    })
    .filter((item): item is OpportunityProjectionItem => item !== null)
    .filter(item => {
      if (session === 'AM' && item.topStrategy.operationalSession === 'PM_SESSION') return false;
      if (session === 'PM' && item.topStrategy.operationalSession === 'AM_SESSION') return false;
      if (strategyId !== 'ALL' && item.topStrategy.id !== strategyId) return false;
      if (sector !== 'ALL' && item.stock.sector !== sector) return false;
      return item.topScoreResult.score >= scoreFloor;
    })
    .sort((a, b) => b.topScoreResult.score - a.topScoreResult.score);

  const expectedReturnTotal = opportunities.reduce(
    (sum, item) => sum + item.topScoreResult.expectedReturnPct,
    0,
  );

  return {
    opportunities,
    summary: {
      actionableSetups: opportunities.length,
      strongBuyCount: opportunities.filter(item => item.topScoreResult.signal === 'STRONG BUY').length,
      buyCount: opportunities.filter(item => item.topScoreResult.signal === 'BUY').length,
      averageExpectedReturnPct:
        opportunities.length > 0 ? expectedReturnTotal / opportunities.length : 0,
    },
  };
}
