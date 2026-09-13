/**
 * Stable application-layer facade for React and other presentation surfaces.
 *
 * The implementation remains in the engine package while architecture debt is
 * retired incrementally, but presentation code must depend on this facade rather
 * than importing quant-core orchestration directly. This gives future provider
 * adapters and application DTOs a stable boundary without changing UI behavior.
 */
export * from '../engine/researchApplication';
