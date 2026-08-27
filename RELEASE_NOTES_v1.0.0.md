## [v1.0.0](https://github.com/Pratham2511/TGDetect-Temporal-Graph/compare/9dda79b...v1.0.0) - 2026-08-27

### ✨ Features

- Added backend-contract-ready domain layer (`src/lib/tgdetect/types.ts`) mirroring the actual TGDetect backend Python schemas 1:1: TGEvent (14 fields), NodeType (8 values), RelationType (14 values), EventLabel (0/1), LabelMode (parser/force/heuristic), ChainStrategy (chain_id/causal_parent/entity_time), ProcessingState (10 states), GraphNode/GraphEdge/AttackChainSummary/ChainSubgraph, GraphStats (full graph_stats.json shape), TGNNModelConfig/Summary (GraphSAGE + GRU, no attention/transformer/LLM), TrainingConfig/EpochMetrics/TrainingRun, EvaluationRun/EvaluationMetrics/PredictionRow/ConfusionMatrix, SnapshotInfo/SnapshotMeta.
- Added 8 service interfaces with mock implementations (`src/lib/tgdetect/services/`): DatasetService, EventService, GraphService, AttackChainService, ArtifactService, ModelService, TrainingService, ProcessingService. UI depends on interfaces only — future API client implementation requires zero UI changes.
- Added Overview page: backend pipeline header (normalization → labeling → graph build → chains → elapsed), 6 KPI tiles, events-over-time stacked area, node type pie, relation distribution horizontal bar (attack relations in red), source tag bar, attacks card with strategy breakdown + events-per-chain histogram, recent malicious events table.
- Added Events investigation page: filterable table with all 14 TGEvent fields; filters for label / node type / relation / tactic / source tag / chain / event_id search / time range / pagination; click-to-detail panel showing all fields, causal_parent navigation, attrs JSON, related events touching source and destination nodes, link-to-chain.
- Added Graph workspace: canvas-based force-directed directed heterogeneous graph with pan / zoom / node-drag, malicious-event coloring (severity blends base color with red), chain highlighting, hover labels, arrowhead direction, node/relation legends with toggle-able filters, malicious-only mode, edge-label toggle, node inspector panel.
- Added Attack Chains workspace: chain list with severity + strategy filters + chain_id search; 4-tab detail panel: Timeline (ordered events with relation/tactic/stage pills), Subgraph (TemporalGraphViz rendering the chain's subgraph with chain-highlighted edges), Events (table), Evidence (strategy description, tactic/stage/relation sequences, involved nodes by type, causal links list).
- Added Datasets / Processing page: dataset list + Job Inspector with 6-stage pipeline visualization (parsing → normalizing → labeling → building_graph → exporting → reconstructing_chains), full ProcessingConfig display (label_mode, strategies, chain_window_s, max_hops, max_subgraphs, chunk_size, use_networkx, etc.), output artifact paths, equivalent CLI command preview, New Job wizard modal.
- Added Graph Artifacts explorer: job picker + artifact list (6 kinds: events.parquet, edges.parquet, nodes.parquet, chains_summary.parquet, graph_stats.json, subgraphs/) + artifact detail panel with schema field table matching backend parquet schemas and row previews.
- Added TGNN / Model page with 4 tabs: Architecture (forward-pass flow diagram GraphSAGE → GRU → dual classifier heads, hyperparameters, has_attention=false/has_transformer=false/has_llm=false badges), Snapshots (window config + per-snapshot edge/malicious-edge bar chart), Training (loss/threshold/auc/precision-recall curves + per-epoch history table with best-epoch highlight), Evaluation (split picker train/val/test, metrics tiles, confusion matrix with TPR/FPR/TNR/PPV/NPV, sample predictions table).
- Added Analytics page with 4 tabs: Event Analytics (events per snapshot, tactic distribution, source tag pie), Graph Analytics (node type pie, relation bar with attack-relations red, graph size over time), Attack Analytics (strategy comparison table, chain length + duration distributions, top tactics in chains), Dataset Analytics (normalization outcome pie, rejection reasons bar, label distribution, heuristic labeler indicators when mode=heuristic).
- Added shared components: LabelPill, NodeTypePill, RelationPill, StrategyPill, StatePill, MonoId, StatBlock, SectionTitle, EmptyState, LoadingState, ErrorState (pills.tsx); NodeLegend (8 node types), RelationLegend (14 relations) (legends.tsx); TemporalGraphViz canvas component (temporal-graph-viz.tsx).
- Added backend-conformant mock fixtures (`src/lib/tgdetect/mocks.ts`): 4 coherent multi-stage attack-chain narratives (spear-phish+exfil, persistence+C2, Empire pivot, Mimikatz DCSync) with proper causal_parent links and backend-exact field shapes; 220 benign background events seeded with stable LCG PRNG; derived nodes/edges/chains_summary/subgraphs matching backend parquet schemas; 4 Datasets (synthetic + mordor kinds matching PARSERS registry); 3 ProcessingJobs; ArtifactMeta fixtures for all 6 artifact kinds; 612 SnapshotInfo rows; TGNN model config matching defaults; 20-epoch training history; evaluation metrics per split with realistic F1≈0.70 / threshold≈0.94 numbers.
- Added CONTRIBUTING.md documenting the backend-contract-first contribution principles.
- Updated README.md using the Standard Repository Template structure.
- Updated package.json `name` from `nextjs_tailwind_shadcn_ts` to `tgdetect-frontend` and bumped version from `0.2.1` to `1.0.0`.

### 🐛 Bug Fixes

- Fixed i18n bug in `src/hooks/useLiveStream.ts` — the previous code emitted the Chinese string `刚刚` ("just now") in `lastEventTime`. The entire `useLiveStream` hook was removed in this refactor (replaced by service-layer hooks), so the bug is eliminated by deletion.

### 🔧 Improvements

- Refactored navigation from state-based 4-section (Dashboard/Analytics/Datasets/Profiles) to state-based 8-section architecture (Overview/Events/Graph/Attack Chains/Datasets/Artifacts/TGNN-Model/Analytics) that mirrors the actual backend pipeline.
- Refactored all charts to be driven by backend-compatible domain data instead of separate fake chart-generation utilities.
- Refactored tables to use monospace fonts for event IDs, node IDs, IP addresses, process identifiers, chain IDs, and causal parent IDs.
- Refactored theme detection in TemporalGraphViz from `useState + useEffect` to `useSyncExternalStore` for proper React 19 compliance.
- Refactored event-detail and artifact-detail navigation to use `key` prop remounting instead of `useEffect + setState` cascading renders.
- Preserved the existing Midnight Intelligence design system (light/dark themes, sidebar styling, card hover effects, custom scrollbar).
- Preserved all shadcn/Radix UI primitives in `src/components/ui/`.

### ⚠️ Breaking Changes

- Removed `src/lib/synthetic-data.ts` (601 lines) — the previous synthetic-data architecture is replaced by backend-contract-ready domain types and mock fixtures. Any code importing from `synthetic-data` must be updated to import from `@/lib/tgdetect/mocks` or consume via the service hooks in `@/lib/tgdetect/services/hooks`.
- Removed `src/hooks/useLiveStream.ts` — the `useLiveStream` hook and `LiveMetrics` interface are removed. The backend has no live-streaming endpoint; simulating one with `setInterval` violated the backend-integrity rule. Use `useGraphStats()` instead.
- Removed `src/components/tgdetect/AnalyticsPage.tsx` (1081 lines), `ColumnMappingModal.tsx` (348 lines), `OnboardingTour.tsx` (393 lines), `TimeRangePicker.tsx` (42 lines) — the v5 dashboard components are replaced by section-specific page components under `src/components/tgdetect/{overview,events,graph,chains,datasets,artifacts,model,analytics}/`.
- Removed `src/app/api/route.ts` — the placeholder `GET / → { message: "Hello, world!" }` endpoint is removed. No real API endpoints are added in this release; the frontend is backend-contract-ready, NOT backend-connected.
- Removed `prisma/schema.prisma` (default User/Post scaffold) and `db/custom.db` (empty SQLite). These were unused Next.js + Prisma boilerplate unrelated to TGDetect.
- Removed the closed dataset union `'DARPA' | 'UNSW' | 'LANL'` — the backend only supports `synthetic` and `mordor` parsers. Frontend now uses the `DatasetKind = 'synthetic' | 'mordor'` union matching the actual `PARSERS` registry.
- Removed `UserProfile.config.{temporalWindow, memoryDim, numHeads, nLayers, embedDim, threshold}` — these were guesses at "V16 Apex" params that do not exist in the backend. The actual TGNN config uses `{hidden_channels, out_channels, num_gnn_layers, num_rnn_layers, dropout}` matching `models/tgnn.py`.
- Removed `DetectionResult.status` enum (`'Detected' | 'Investigating' | 'Contained'`) — the backend has no such workflow enum. Predictions are bare `{node_id, probability, prediction, ground_truth, snapshot_label}` rows.
- Removed fabricated ML metrics (V16 Apex vs baselines comparison, tactic embedding clusters, attack-chain path scores) that had no backend source.
- Bumped `package.json` version from `0.2.1` to `1.0.0` and renamed the package from `nextjs_tailwind_shadcn_ts` to `tgdetect-frontend` — this is a major architectural refactor that breaks the previous synthetic-data API.

### 📦 Assets

No binary assets are attached to this release. The frontend is a Next.js application; users should clone the repository and run `bun install && bun run build` to produce the standalone server build.
