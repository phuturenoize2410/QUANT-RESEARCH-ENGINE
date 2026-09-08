import { StrategyEngine } from '../strategyTypes';
import { OvernightStrategy } from './overnightStrategy';
import { IntradayStrategy } from './intradayStrategy';
import { TrendStrategy } from './trendStrategy';
import { MacdStrategy } from './macdStrategy';
import { IchimokuStrategy } from './ichimokuStrategy';
import { BreakoutStrategy } from './breakoutStrategy';
import { PullbackStrategy } from './pullbackStrategy';

export {
  OvernightStrategy,
  IntradayStrategy,
  TrendStrategy,
  MacdStrategy,
  IchimokuStrategy,
  BreakoutStrategy,
  PullbackStrategy,
};

export const STRATEGY_REGISTRY: StrategyEngine[] = [
  OvernightStrategy,
  IntradayStrategy,
  TrendStrategy,
  MacdStrategy,
  IchimokuStrategy,
  BreakoutStrategy,
  PullbackStrategy,
];

export function getAllStrategies(): StrategyEngine[] {
  return STRATEGY_REGISTRY;
}

export function getStrategyById(id: string): StrategyEngine | undefined {
  return STRATEGY_REGISTRY.find(s => s.id === id);
}

export function getDefaultStrategy(): StrategyEngine {
  return OvernightStrategy;
}
