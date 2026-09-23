# Provider Boundary Invariants

This document defines the non-negotiable boundary for future market-data integrations. It exists to prevent provider-specific assumptions from leaking into features, strategies, risk/execution, or UI code when Google Finance, another free IDX source, a paid feed, or a broker adapter is introduced.

## Canonical flow

`DataProvider -> Feature Engine -> Strategy Engine -> Risk/Execution -> UI`

The UI is a presentation/interaction surface. It must not fetch provider data directly, calculate provider-specific features, re-score strategy signals, or own execution economics.

## Provider edge

A provider adapter owns transport, authentication/configuration, vendor symbol translation, vendor payload parsing, and conversion into canonical engine contracts. Provider-specific field names and vendor response shapes stop at this boundary.

Provider metadata and health are runtime contracts, not display hints. Malformed capability declarations, contradictory mode/capability claims, unsupported markets, unavailable health, and stale data must fail closed before research output can be treated as executable evidence.

Canonical provider snapshots must be point-in-time and immutable. Canonicalization must never mutate or freeze caller/provider-owned objects. Downstream layers consume snapshots rather than live adapter-owned references.

## Mock-data rule

Mock/synthetic data remains explicitly identified as mock throughout provenance and UI. Synthetic history can exercise architecture and strategy plumbing, but it is not production backtest evidence and must not be used to justify paid real-time integration.

## Data-provider progression

Provider adoption should progress from contract-compatible historical/EOD data to stronger intraday/realtime capability only when the research use case requires it. A paid realtime feed is not an architecture milestone. It is justified only after realistic backtests, including centralized fees and slippage, demonstrate a robust edge.

Google Finance or any other future source must therefore be implemented as an adapter behind the same provider contracts rather than as a special path through feature, strategy, or UI code.

## Downstream ownership

Feature Engine owns transformations from canonical market observations into canonical features. Strategy Engine consumes features and produces strategy decisions/scores; it does not own vendor parsing or transaction-cost assumptions. Risk/Execution owns sizing, eligibility, fees, slippage, and execution-policy effects. Score bounds and execution economics must have one authoritative engine definition rather than per-screen constants. UI consumes application/engine outputs and must not recreate those decisions.

## Change gate

A provider-related change should be rejected or redesigned when it introduces any of the following:

- direct provider/vendor imports in Feature, Strategy, Risk/Execution, or UI layers;
- direct data fetching from UI components;
- provider-specific symbols or payload fields beyond the adapter boundary;
- duplicated fee/slippage assumptions or score bounds in presentation code;
- silent fallback from malformed/unsupported real data to mock data;
- unlabeled mock/synthetic observations;
- paid realtime integration before robust net-of-cost backtest evidence exists.

These invariants complement executable architecture smoke tests. When a new integration exposes a missing invariant, add regression coverage before broadening the adapter surface.