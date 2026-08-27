# TGDetect Frontend

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Pratham2511/TGDetect-Temporal-Graph/blob/main/LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-green.svg)](https://github.com/Pratham2511/TGDetect-Temporal-Graph/releases)
[![Stars](https://img.shields.io/github/stars/Pratham2511/TGDetect-Temporal-Graph)](https://github.com/Pratham2511/TGDetect-Temporal-Graph/stargazers)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)

A backend-contract-ready Next.js frontend for the TGDetect temporal graph neural network threat detection system, designed around the actual Python backend data schemas (`graph_builder/`, `models/tgnn.py`).

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Backend-contract domain model** | TypeScript types mirror backend Python schemas 1:1 (TGEvent, NodeType, RelationType, AttackChain, GraphStats, TGNNModelConfig) — verified against `graph_builder/schema.py`, `attack_tracker.py`, `tgnn.py` |
| **Overview / Dashboard** | Pipeline summary (normalization → labeling → graph build → chains → elapsed), KPI tiles, events-over-time, node/relation/source distributions, recent malicious events |
| **Event Investigation** | Filterable table of all 14 TGEvent fields; click-to-detail panel with causal_parent navigation, attrs JSON, related events touching src/dst nodes, link-to-chain |
| **Temporal Heterogeneous Graph** | Canvas-based force-directed directed graph with node/relation legends, malicious-only mode, edge-label toggle, node inspector, pan/zoom/drag |
| **Attack Chain Reconstruction** | Chain list with severity + strategy filters; 4-tab detail panel (Timeline / Subgraph / Events / Evidence) showing tactic/stage/relation sequences and causal links |
| **Dataset Processing Workflow** | Job-oriented UI: 10 backend pipeline states (idle → parsing → normalizing → labeling → building_graph → exporting → reconstructing_chains → completed/failed), full ProcessingConfig display, equivalent CLI preview |
| **Graph Artifacts Explorer** | Inspect 6 backend outputs (events.parquet, edges.parquet, nodes.parquet, chains_summary.parquet, graph_stats.json, subgraphs/) with exact schema field tables and row previews |
| **TGNN Model Interface** | Architecture flow diagram (GraphSAGE per snapshot → GRU over time → node + snapshot classifiers), snapshot config, training history curves, evaluation metrics with confusion matrix |
| **Analytics** | 4 categories: Event / Graph / Attack / Dataset analytics — all derived from backend-conformant domain entities |
| **Service-layer abstraction** | UI depends on 8 service interfaces (Dataset / Event / Graph / AttackChain / Artifact / Model / Training / Processing); mock implementations swappable for real API with zero UI changes |
| **Light / Dark themes** | "Midnight Intelligence" design system preserved from original repo |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ or Bun 1.1+
- npm / bun package manager

### Installation
```bash
git clone https://github.com/Pratham2511/TGDetect-Temporal-Graph.git
cd TGDetect-Temporal-Graph
bun install
```

---

## 📖 Usage

### Basic Usage
```bash
bun run dev
```
Open `http://localhost:3000` to view the application. Navigate the 8 sections via the left sidebar:
- **Overview** — backend pipeline summary
- **Events** — TGEvent investigation table
- **Graph** — temporal heterogeneous graph workspace
- **Attack Chains** — chain reconstruction with 4 detail views
- **Datasets** — dataset + processing job inspector
- **Artifacts** — parquet/JSON output explorer
- **TGNN / Model** — GraphSAGE + GRU architecture, training, evaluation
- **Analytics** — event/graph/attack/dataset analytics

### Commands
| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server on port 3000 |
| `bun run build` | Production build (outputs to `.next/standalone/`) |
| `bun run start` | Start production server from built standalone |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push Prisma schema to SQLite (currently unused — backend not connected) |

---

## 🔧 Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `tgdetect-theme` | localStorage key for theme (`light` / `dark`) | `light` |
| Service implementation | Mock implementations live in `src/lib/tgdetect/services/index.ts`. Replace with real API client by implementing the same interfaces. | mock |

**No environment variables are required.** The frontend runs entirely on local mock data conforming to backend schemas. When the backend is integrated later, API base URLs will be configured here.

---

## 🛠️ Development

### Setup
```bash
bun install
bun run dev
```

### Build
```bash
bun run build
bun run start
```

### Architecture
```
src/
  app/
    layout.tsx          # Root layout + ThemeProvider + Geist fonts
    page.tsx            # Main shell with state-based navigation (8 sections)
    globals.css          # Midnight Intelligence design system (light/dark)
  components/
    tgdetect/
      overview/          # Dashboard page
      events/            # Event investigation page
      graph/             # Temporal graph workspace
      chains/            # Attack chain workspace (4 detail views)
      datasets/          # Dataset + processing job inspector
      artifacts/         # Parquet/JSON artifact explorer
      model/             # TGNN architecture + training + evaluation
      analytics/         # 4-category analytics
      shared/            # Reusable pills, legends, TemporalGraphViz
    ui/                  # shadcn/Radix primitives (unchanged)
  lib/
    tgdetect/
      types.ts           # Backend-mirrored TypeScript domain types
      constants.ts       # UI metadata for every backend enum
      mocks.ts           # Backend-conformant mock fixtures
      formatters.ts      # Pure presentation adapters
      chart-constants.ts # Shared Recharts styling
      services/
        index.ts         # 8 service interfaces + mock implementations
        hooks.ts         # React hooks wrapping each service
    theme-context.tsx    # Light/dark theme provider
    date-utils.ts       # Hydration-safe date formatters
    utils.ts            # cn() helper
  hooks/
    use-mobile.ts       # Mobile breakpoint hook
    use-toast.ts        # Toast notifications
```

### Backend Contract
The frontend is designed around the actual TGDetect backend repository
([dhruvmankame/tgdetect](https://github.com/dhruvmankame/tgdetect)). Key
backend concepts the frontend is structured around:

- **TGEvent** — unified event with 14 fields (`event_id`, `ts`, `src_id`, `src_type`, `dst_id`, `dst_type`, `relation`, `label`, `tactics`, `apt_stage`, `source_tag`, `chain_id`, `causal_parent`, `attrs`)
- **NodeType** — 8 types: `USER`, `HOST`, `PROCESS`, `FILE`, `IP`, `DOMAIN`, `SOCKET`, `UNKNOWN`
- **RelationType** — 14 relations: `LOGON`, `EXECUTES`, `READS`, `WRITES`, `DELETES`, `CONNECTS_TO`, `AUTHENTICATES_TO`, `NETWORK_FLOW`, `EXPLOIT`, `LATERAL_MOVE`, `EXFILTRATE`, `DISCOVER`, `IMPACT`, `GENERIC`
- **Label semantics** — `0 = benign`, `1 = malicious`; 3 modes: `parser`, `force`, `heuristic`
- **Chain strategies** — `chain_id` (priority 1), `causal_parent` (priority 2, union-find), `entity_time` (priority 3, BFS)
- **Graph artifacts** — `events.parquet`, `edges.parquet`, `nodes.parquet`, `chains_summary.parquet`, `graph_stats.json`, per-chain subgraph JSON
- **TGNN architecture** — `TemporalGNN` = GraphSAGE (`SAGEConv`) per snapshot + GRU over time + dual classifier heads (node + snapshot); NO attention, NO Transformer, NO LLM
- **Datasets supported** — `synthetic` (JSONL) and `mordor` (OTRF Security-Datasets); the backend does NOT support DARPA/UNSW/LANL parsers
- **Training & evaluation** — `BCEWithLogitsLoss` with auto `pos_weight`, `AdamW` optimizer, threshold tuning on val set; metrics: precision, recall, F1, accuracy, AUC-ROC, AUC-PR, confusion matrix

### Mock Architecture
Mock data lives behind service interfaces. The UI never imports mock fixtures directly — it consumes typed hooks (`useEvents`, `useChains`, `useTrainingRun`, etc.) which call service interfaces backed by mock implementations. To integrate the real backend:

1. Implement the same 8 service interfaces (`DatasetService`, `EventService`, `GraphService`, `AttackChainService`, `ArtifactService`, `ModelService`, `TrainingService`, `ProcessingService`) in `src/lib/tgdetect/services/api/` using `fetch()` against your FastAPI/Flask endpoints
2. Swap the singleton exports in `src/lib/tgdetect/services/index.ts` from `MockXService` to `ApiXService`
3. No UI changes required

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📜 License

[MIT](https://github.com/Pratham2511/TGDetect-Temporal-Graph/blob/main/LICENSE)
