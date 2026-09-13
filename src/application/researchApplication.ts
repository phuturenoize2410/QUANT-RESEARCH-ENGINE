/**
 * Stable application-layer facade for React and other presentation surfaces.
 *
 * Keep this surface explicit: presentation code may depend on application use
 * cases and DTOs, but new engine exports must not become UI dependencies merely
 * because they were added to the implementation module.
 */
export {
  ResearchApplicationService,
  createPrototypeResearchApplicationService,
} from '../engine/researchApplication';

export type {
  DecisionCandidateEvaluation,
  ExecutionCostSettingKey,
  ManualMorningPositionInput,
  MorningJournalSeedSnapshot,
  QuantLabConditionDefinition,
  QuantLabConditionalEvaluation,
  ResearchApplicationSnapshot,
  StrategyLabCatalogSnapshot,
  StrategyLabSortMetric,
} from '../engine/researchApplication';
