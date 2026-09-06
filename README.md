# TGDetect: Temporal Heterogeneous Graph Threat Detection

[![Version](https://img.shields.io/badge/Version-1.0.0-emerald.svg)](https://github.com/Pratham2511/TGDetect-Temporal-Graph/releases)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141+-teal?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PyG](https://img.shields.io/badge/PyTorch_Geometric-2.3+-orange)](https://pytorch-geometric.readthedocs.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An open, locally runnable research platform and forensic dashboard for multi-step cyber threat detection using **Temporal Heterogeneous Graph Neural Networks (TemporalGNN)**.

TGDetect integrates an interactive **Next.js 16 frontend dashboard** (`localhost:3000`) with a high-performance **FastAPI backend** (`localhost:8000`). The system inspects and visualizes real Parquet graph artifacts, reconstructed multi-stage attack chains, temporal graph snapshots, and PyTorch Geometric model checkpoints (`SAGEConv` + `GRU`).

---

## Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [What TGDetect Actually Implements](#what-tgdetect-actually-implements)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Data Pipeline](#data-pipeline)
- [Graph Data Model](#graph-data-model)
- [Temporal Snapshot Construction](#temporal-snapshot-construction)
- [TemporalGNN Architecture](#temporalgnn-architecture)
- [Training](#training)
- [Evaluation](#evaluation)
- [Dataset Formats](#dataset-formats)
- [Current Dataset & Provenance](#current-dataset--provenance)
- [Frontend Dashboard](#frontend-dashboard)
- [API Reference](#api-reference)
- [Local Setup](#local-setup)
- [Running the Backend](#running-the-backend)
- [Running the Frontend](#running-the-frontend)
- [Modal GPU Workflow](#modal-gpu-workflow)
- [Artifact Structure](#artifact-structure)
- [Testing & Quality Verification](#testing--quality-verification)
- [Research Claim vs Implementation](#research-claim-vs-implementation)
- [Security & Engineering Safeguards](#security--engineering-safeguards)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Project & Research Context](#project--research-context)
- [License](#license)

---

## Overview

Modern Advanced Persistent Threats (APTs) execute stealthy, low-and-slow campaigns spanning hours, days, or months. Traditional rule-based SIEM systems, isolated anomaly detectors, and static snapshot graphs often struggle to detect these threats because individual operations (such as authentication or PowerShell execution) appear innocuous when viewed in isolation.

**TGDetect** addresses this challenge by framing host and network telemetry as an evolving, directed, heterogeneous temporal graph:
- Entities (**Users, Hosts, Processes, Files, IP addresses, Domains, Sockets**) are modeled as typed nodes.
- Security events (**Logons, Process Executions, File I/O, Network Connections, Kerberoasting, Privilege Escalation**) form timestamped, typed directed edges.
- Attack progression is identified by tracking both spatial interaction topologies (via **GraphSAGE / SAGEConv**) and temporal dynamics across snapshot sequences (via **Gated Recurrent Units / GRU**).

The project provides an end-to-end open pipeline: from streaming log parsing and normalization to snapshot partitioning, neural training, offline evaluation, and an analyst-oriented forensic dashboard.

---

## Current Status

| Environment | Component | Technology | Default Port / URL | Status |
|---|---|---|---|---|
| **Frontend** | Forensic Dashboard | Next.js 16.1.1 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Radix UI, Recharts | `http://localhost:3000` | **OPERATIONAL** |
| **Backend API** | REST Gateway | FastAPI 0.141+, Starlette, Pydantic, PyArrow, Pandas | `http://localhost:8000` | **OPERATIONAL** |
| **Graph Builder** | Normalization & Extraction | Python 3.10+, PyArrow, NetworkX, Orjson | Offline / CLI | **OPERATIONAL** |
| **Model (TGNN)** | Spatiotemporal GNN | PyTorch 2.0+, PyTorch Geometric 2.3+, Scikit-Learn | Offline / Modal | **OPERATIONAL** |
| **Cloud GPU** | Scaled Training & Snapshots | Modal Cloud (Nvidia A10G, Debian slim) | Modal CLI | **OPERATIONAL** |

> [!NOTE]
> **Mock Mode is Disabled by Default**: `NEXT_PUBLIC_TGDETECT_MOCK_MODE=false`. The frontend binds directly to the local FastAPI backend. If the backend server is stopped or unreachable, the UI displays a clear `● API OFFLINE` alert panel with connection diagnostics rather than silently degrading to simulated data.

---

## What TGDetect Actually Implements

To ensure transparency for researchers and engineers evaluating this repository, the following capabilities are confirmed executable in the current branch:

1. **Deterministic Parquet Graph Artifacts**: Parses structured security logs into canonical columnar storage (`events.parquet`, `edges.parquet`, `nodes.parquet`, `chains_summary.parquet`, `graph_stats.json`).
2. **Typed Heterogeneous Graph Schema**: Standardizes discrete node types and relations with explicit timestamping, attribute tracking, and optional NetFlow metadata columns (`flow_dur`, `flow_proto`, `flow_sport`, `flow_dport`, `flow_dir`, `flow_state`, `flow_tot_pkts`, `flow_tot_bytes`, `flow_src_bytes`).
3. **Multi-Strategy Attack-Chain Reconstruction**: Implements 3 distinct chain reconstruction engines:
   - `chain_id`: Ground-truth grouping when scenario identifiers are known.
   - `causal_parent`: Directed Acyclic Graph (DAG) traversal across parent event pointers.
   - `entity_time`: Sliding-window temporal proximity and shared-entity inference.
4. **Time-Windowed Snapshot Generator**: Vectorized generation of PyTorch-ready temporal snapshots with event-driven stride windows, supporting both standard graph features and 37-dim leakage-free NetFlow features.
5. **Multi-Head Spatiotemporal Model (TemporalGNN)**: PyTorch/PyG architecture combining 2-layer `SAGEConv` with edge projection, batch normalization, single-layer `GRU` (stepping across temporal windows), and dedicated classification heads for node-level, snapshot-level, and flow edge-level threat detection.
6. **Cross-Scenario Held-Out Splitting & Imbalance Control**: Scenario-aware partitioner (`--train-scenarios`, `--test-scenarios`) preventing data leakage across captures, paired with a capped `pos_weight` loss stabilizer preventing gradient explosion and all-positive mode collapse.
7. **Three-Operating-Point Evaluation Engine**: Standardized reporting across (1) calibrated saved threshold, (2) optimal F1 threshold, and (3) operational 1.0% False Positive Rate (FPR) threshold with full ROC-AUC and PR-AUC tracking.
8. **29+ Implemented Read-Only REST Endpoints**: A modular FastAPI backend exposing event filters, graph structures, attack subgraphs, model configurations, checkpoint evaluations (with multi-run discovery), and analytics.
9. **Production-Grade Next.js Dashboard**: 8 dedicated forensic views with theme switching, canvas graph layout, subgraphs, and confusion matrix rendering.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS 16 FRONTEND                                │
│                          http://localhost:3000                              │
│                                                                             │
│  Overview  │  Events  │  Graph  │  Attack Chains  │  Datasets  │ Artifacts  │
│                       │  TGNN / Model  │  Analytics                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       │ HTTP / JSON (CORS localhost:3000)
                                       │ Client: frontend/src/lib/tgdetect/api/client.ts
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TGDETECT FASTAPI BACKEND (backend/)                 │
│                         http://localhost:8000                               │
│                                                                             │
│  /api/health      /api/overview   /api/events       /api/graph              │
│  /api/chains      /api/datasets   /api/artifacts    /api/model              │
│  /api/analytics   Swagger: /docs  ReDoc: /redoc                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       │ Local Filesystem / Disk Ingestion
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LOCAL ARTIFACTS IN BACKEND                           │
│                                                                             │
│  backend/data/processed/mordor_empire/   backend/data/snapshots/mordor_empire│
│  ├── events.parquet (1,219 rows)         ├── meta.json                      │
│  ├── edges.parquet  (1,219 rows)         └── snapshot_*.pkl (612 snapshots) │
│  ├── nodes.parquet  (45 rows)                                               │
│  ├── chains_summary.parquet (3)          backend/models/checkpoints/mixed/  │
│  └── graph_stats.json                    ├── best_model.pt (36,098 params)  │
│                                          ├── history.json (5 epochs)        │
│  backend/data/graphs/chains/*.json       └── eval/metrics_test.json         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Communication Flow
- **Data Ingestion**: The backend reads Parquet tables and JSON summaries using PyArrow and Pandas upon startup or first query, with cached in-memory representations.
- **REST Endpoints**: Fast HTTP JSON endpoints serialize tabular records, metadata, and graph node/edge projections.
- **Frontend Fetch**: Client services in `frontend/src/lib/tgdetect/services/api/index.ts` call the backend using native `fetch` with configurable timeouts and AbortController cancellation.
- **Security Envelope**: Path validation guards in `backend/api/services/artifacts_service.py` strictly whitelist exposed files and forbid directory traversal (`..`, `/`, `\`).

---

## Repository Structure

TGDetect is structured as a unified monorepo containing both the frontend dashboard and the complete backend pipeline:

```text
TGDetect-Temporal-Graph/
├── frontend/                           # Next.js 16 Dashboard & UI Layer
│   ├── .env.example                    # Environment template (API URL, Mock toggle)
│   ├── package.json                    # Next.js 16, React 19, Lucide, Tailwind CSS dependencies
│   ├── tsconfig.json                   # Strict TypeScript configuration
│   ├── next.config.ts                  # Next.js standalone server config
│   ├── components.json                 # UI component registry configuration
│   ├── eslint.config.mjs               # ESLint configuration
│   ├── postcss.config.mjs              # PostCSS configuration
│   ├── tailwind.config.ts              # Tailwind CSS configuration
│   ├── public/                         # Static brand assets and icons
│   │   ├── logo.svg                    # Vector brand mark
│   │   └── robots.txt                  # Search indexing directives
│   └── src/
│       ├── app/
│       │   ├── layout.tsx              # Global HTML wrapper, fonts, ThemeProvider
│       │   ├── page.tsx                # Root navigation container, API status monitor
│       │   └── globals.css             # Midnight Intelligence design tokens & styles
│       ├── components/
│       │   ├── tgdetect/
│       │   │   ├── overview/           # OverviewPage: KPI tiles, timeline, distributions
│       │   │   ├── events/             # EventsPage: Filterable forensic event table & detail drawer
│       │   │   ├── graph/              # GraphPage: Force-directed heterogeneous canvas view
│       │   │   ├── chains/             # ChainsPage: Multi-strategy timeline & subgraph explorer
│       │   │   ├── datasets/           # DatasetsPage: Dataset inventory & job inspection
│       │   │   ├── artifacts/          # ArtifactsPage: Parquet schema & row previewer
│       │   │   ├── model/              # ModelPage: Architecture, Snapshots, Training, Evaluation
│       │   │   ├── analytics/          # AnalyticsPage: Event, Graph, Attack, and Dataset metrics
│       │   │   └── shared/             # Badges, pills, legends, temporal graph canvas
│       │   └── ui/                     # Radix UI primitive components
│       └── lib/
│           ├── date-utils.ts           # Timestamp formatters & date calculations
│           └── tgdetect/
│               ├── types.ts            # TypeScript interfaces mirroring Python schemas 1:1
│               ├── constants.ts        # Node types, relations, color palettes
│               ├── formatters.ts       # Number, byte, ratio, and duration formatters
│               ├── mocks.ts            # Static mock fixtures for offline testing
│               ├── api/
│               │   └── client.ts       # HTTP client with timeout and error handling
│               └── services/
│                   ├── index.ts        # Service factory (switches API vs Mock via env)
│                   ├── hooks.ts        # React state hooks for service consumption
│                   └── api/
│                       └── index.ts    # Concrete HTTP API service adapters
│
├── backend/                            # Python Graph Pipeline, TGNN & FastAPI Backend
│   ├── requirements-graph.txt          # Graph builder dependencies (NetworkX, PyArrow, etc.)
│   ├── requirements-ml.txt             # Machine learning dependencies (PyTorch, PyG, scikit-learn)
│   ├── modal_train.py                  # Modal cloud GPU training definition (Nvidia A10G)
│   │
│   ├── api/                            # FastAPI backend service
│   │   ├── main.py                     # App definition, CORS, routing, error handlers
│   │   ├── dependencies.py             # Filepath constants, DataFrame caches, sanitizers
│   │   ├── routes/                     # Route endpoints (health, events, graph, chains, etc.)
│   │   └── services/                   # Business logic for data extraction & serialization
│   │
│   ├── graph_builder/                  # Graph construction pipeline
│   │   ├── README.md                   # Graph builder documentation & CLI guide
│   │   ├── schema.py                   # TGEvent, NodeType, RelationType, Parquet schemas
│   │   ├── parsers.py                  # Streaming JSON/JSONL parsers (Synthetic, Mordor)
│   │   ├── normalizer.py               # Canonical ID coercion, entity typing, timestamp validation
│   │   ├── labeler.py                  # Rule-based heuristics, LOLBIN regexes, label propagation
│   │   ├── builder.py                  # StreamingGraphBuilder and TemporalGraphBuilder
│   │   ├── attack_tracker.py           # ChainIdTracker, CausalParentTracker, EntityTimeTracker
│   │   ├── temporal.py                 # TemporalSnapshot builder & sliding window partitioner
│   │   ├── loader.py                   # TemporalGraphDataset loader
│   │   └── exporters.py                # Parquet, JSON, and subgraph disk writers
│   │
│   ├── models/                         # Neural network architectures & checkpoints
│   │   ├── tgnn.py                     # TemporalGNN (GraphSAGE + GRU + dual linear classifiers)
│   │   └── checkpoints/
│   │       ├── mordor_mixed/           # Checkpoint run: best_model.pt, history.json, eval/
│   │       ├── mordor_full/            # Full scenario checkpoint run
│   │       └── mordor_test/            # Test scenario checkpoint run
│   │
│   ├── scripts/                        # CLI execution and utility scripts
│   │   ├── init_demo_data.py           # Generates the synthetic demonstration graph
│   │   ├── build_graph.py              # CLI pipeline: raw logs -> processed Parquet graph
│   │   ├── build_snapshots.py          # CLI pipeline: processed graph -> snapshot pickles
│   │   ├── train_tgnn.py               # PyTorch/PyG training script with early stopping
│   │   ├── evaluate_tgnn.py            # Standalone checkpoint evaluation on test split
│   │   ├── validate_graph.py           # Integrity validator for processed Parquets
│   │   ├── visualize_graph.py          # NetworkX / Matplotlib graph rendering
│   │   └── visualize_severity_graph.py # PyVis interactive attack severity graph
│   │
│   ├── tests/                          # Backend test suite
│   │   └── test_api_integration.py     # 12 automated unittest cases for FastAPI backend
│   │
│   ├── data/                           # Demonstration and processed data
│   │   ├── processed/mordor_empire/    # Demonstration processed Parquet tables & graph_stats.json
│   │   ├── snapshots/mordor_empire/    # Demonstration temporal snapshot sequence & meta.json
│   │   └── graphs/chains/              # Demonstration attack chain subgraphs
│   │
│   ├── reports/                        # Visual reports, training curves, distributions
│   └── results/                        # Evaluation metrics and prediction parquet files
│
├── docs/                               # System and API Documentation
│   └── API_CONTRACT.md                 # Complete OpenAPI/FastAPI endpoint specifications
│
├── README.md                           # Authoritative monorepo technical documentation
├── LICENSE                             # MIT License
└── .gitignore                          # Root ignore rules for Python, Node, Next.js, and env
```

---

## Data Pipeline

The pipeline transforms unformatted event streams into graph structures and temporal snapshot sequences:

```text
Raw Log Ingestion (JSON / JSONL / GZ / ZIP / TAR)
   │
   ▼
1. Parser Layer (backend/graph_builder/parsers.py)
   Streams line-by-line using Orjson; emits unnormalized TGEvent records.
   │
   ▼
2. Normalization Layer (graph_builder/normalizer.py)
   Infers entity types (USER, HOST, PROCESS, FILE, IP, DOMAIN, SOCKET).
   Enforces canonical `type:value` IDs; converts Windows FILETIME / ISO-8601 to epoch float.
   │
   ▼
3. Labeling Layer (graph_builder/labeler.py)
   Modes: parser (preserves raw label), force (fixed 0/1), or heuristic.
   Matches suspicious processes (Mimikatz, Empire), LOLBINs (rundll32, certutil), and cmdline patterns.
   Propagates labels across entities within sliding time windows.
   │
   ▼
4. Graph Construction (graph_builder/builder.py)
   StreamingGraphBuilder streams edges directly to Parquet while tracking node metadata in RAM.
   TemporalGraphBuilder accumulates NetworkX MultiDiGraph structures for analysis.
   │
   ▼
5. Attack Chain Reconstruction (graph_builder/attack_tracker.py)
   Extracts multi-step attack campaigns using chain_id, causal_parent, or entity_time strategies.
   │
   ▼
6. Parquet & JSON Export (graph_builder/exporters.py)
   Writes events.parquet, edges.parquet, nodes.parquet, chains_summary.parquet, graph_stats.json.
   │
   ▼
7. Snapshot Generation (graph_builder/temporal.py)
   Builds windowed PyTorch geometric snapshots (x, edge_index, edge_attr, y, node_ids).
   │
   ▼
8. Model Training & Evaluation (models/tgnn.py, scripts/train_tgnn.py)
   Trains TemporalGNN (GraphSAGE + GRU) and outputs best_model.pt and evaluation metrics.
```

### Supported Parser Modes

Confirmed in `graph_builder/parsers.py`:
1. **`synthetic`** (`parse_synthetic_jsonl`): Reads native TGDetect synthetic event streams where node IDs encode entity prefixes (`user_`, `host_`, `external_ip_`).
2. **`mordor`** (`parse_mordor_jsonl`): Streams MITRE ATT&CK Security-Datasets / Mordor logs in JSON or JSON-Lines format. Supports directory trees, `.json`, `.jsonl`, `.ndjson`, `.log`, `.txt`, and compressed archives (`.gz`, `.tar.gz`, `.zip`, `.tgz`, `.tar.bz2`).

> [!IMPORTANT]
> **Unsupported Input Formats**: The current implementation does **not** parse binary Windows Event Log files (`.evtx`) or tabular Comma-Separated Values (`.csv`). Logs must be pre-converted to JSON Lines before ingestion.

---

## Graph Data Model

### Node Representation
Nodes represent physical or logical entities identified by a canonical prefix format (`<type>:<value>`):
- **`USER`** (`user:alice`, `user:administrator`)
- **`HOST`** (`host:WKSTN-01.corp`, `host:DC01.corp`)
- **`PROCESS`** (`process:powershell.exe`, `process:lsass.exe`)
- **`FILE`** (`file:C:\Windows\System32\ntdll.dll`)
- **`IP`** (`ip:10.0.0.1`, `ip:192.168.1.100`)
- **`DOMAIN`** (`domain:microsoft.com`, `domain:corp.internal`)
- **`SOCKET`** (`socket:10.0.0.1:443->192.168.1.5:49152`)
- **`UNKNOWN`** (`entity:untyped_identifier`)

### Relation Types (Edges)
Edges represent observed operations or interactions between two entities at timestamp `ts`:
`LOGON`, `EXECUTES`, `READS`, `WRITES`, `DELETES`, `CONNECTS_TO`, `AUTHENTICATES_TO`, `NETWORK_FLOW`, `EXPLOIT`, `LATERAL_MOVE`, `EXFILTRATE`, `DISCOVER`, `IMPACT`, `GENERIC`.

### The Canonical `TGEvent` Schema
Every edge is persisted according to the 14-field specification:

| Field | Type | Storage Format | Description |
|---|---|---|---|
| `event_id` | `str` | PyArrow String | Unique identifier (e.g., `evt-mal-c1-000`) |
| `ts` | `float` | PyArrow Float64 | Unix epoch timestamp in seconds with fractional precision |
| `src_id` | `str` | PyArrow String | Source node identifier (`type:value`) |
| `src_type` | `str` | PyArrow String | One of the 8 canonical `NodeType` values |
| `dst_id` | `str` | PyArrow String | Destination node identifier (`type:value`) |
| `dst_type` | `str` | PyArrow String | One of the 8 canonical `NodeType` values |
| `relation` | `str` | PyArrow String | One of the 14 canonical `RelationType` values |
| `label` | `int` | PyArrow Int8 | Ground truth classification: `0` (benign) or `1` (malicious) |
| `tactics` | `list[str]` | PyArrow List(String) | MITRE ATT&CK tactics (e.g., `["execution", "c2"]`) |
| `apt_stage` | `str \| null` | PyArrow String | Phase within the multi-stage campaign |
| `source_tag` | `str` | PyArrow String | Origin dataset or ingest batch tag |
| `chain_id` | `str \| null` | PyArrow String | Campaign identifier when known |
| `causal_parent`| `str \| null` | PyArrow String | Event ID of the direct causal antecedent |
| `attrs` | `dict` | PyArrow String (JSON) | Variable attributes (command line, hashes, status codes) |

### Graph Heterogeneity vs Neural Input
TGDetect models a **heterogeneous graph** in its schema, storage tables, and visualization. However, it does **not** utilize relational multi-graph operators like PyG's `HeteroConv` or `RGCNConv`. Instead:
- Node types are one-hot encoded into a 10-dimensional node feature vector `x`.
- Edge relations are one-hot encoded into an 8-dimensional edge attribute vector `edge_attr` alongside relative temporal offsets.
- The neural network processes this graph through homogeneous `SAGEConv` layers with explicit linear edge-projection encoders (`edge_encoders`).

---

## Temporal Snapshot Construction

To allow spatial Graph Neural Networks to reason over temporal sequences, the graph is sliced into chronological snapshots by `graph_builder/temporal.py`.

Each `TemporalSnapshot` encapsulates:
- `ts_start` and `ts_end`: Float Unix boundaries defining the window.
- `x`: `[N, in_channels]` Float32 matrix containing one-hot node types and structural indicators.
- `edge_index`: `[2, E]` Int64 coordinate tensor indexing nodes active within the window.
- `edge_attr`: `[E, edge_dim]` Float32 tensor containing one-hot relations and normalized timestamps.
- `node_labels`: `[N]` Int64 array indicating whether each node participated in a malicious event during the window.
- `edge_labels`: `[E]` Int64 array indicating whether each edge is malicious.
- `snapshot_label`: Integer flag (`1` if any malicious event occurred in the window, else `0`).
- `node_ids`: List of canonical node strings mapping tensor row indices back to entity identities.

Snapshots are stored as serialized Python pickle objects (`snapshot_*.pkl`) alongside a metadata summary (`meta.json`).

---

## TemporalGNN Architecture

The machine learning core is defined in `models/tgnn.py` as a composite spatiotemporal model:

```text
Snapshot Sequence [t - W, ..., t]
   │
   ▼
[For each snapshot]:
   Node Features x: [N, 10] ──┐
   Edge Index:      [2, E]  ──┼─► SAGEConv (Layer 1: 10 -> 64) ──► ReLU ──► BatchNorm1d ──► Dropout(0.3)
   Edge Attr:       [E, 8]  ──┘   + Edge Projection: Linear(8 -> 64)
                                  │
                                  ▼
                              SAGEConv (Layer 2: 64 -> 64) ──► ReLU ──► BatchNorm1d ──► Dropout(0.3)
                                  + Edge Projection: Linear(8 -> 64)
                                  │
                                  ▼
                        Spatial Node Embeddings h_t: [N_t, 64]
   │
   ▼
Temporal Alignment (Common Node Mapping Across W Snapshots)
Aligned Sequence Tensor: [W, N_final, 64]
   │
   ▼
Gated Recurrent Unit (GRU)
   input_size=64, hidden_size=64, num_layers=1, batch_first=False
   Final Temporal Node Embeddings: [N_final, 64]
   │
   ├──────────────────────────┬──────────────────────────┐
   ▼                          ▼                          ▼
Node Classifier            Snapshot Classifier        Edge Classifier
Linear(64 -> 1)            Global Max Pool: [1, 64]   Linear(128 -> 1)
                           Linear(64 -> 1)            (Concatenates [h_src, h_dst])
   │                          │                          │
   ▼                          ▼                          ▼
Node Threat Logits: [N, 1] Snapshot Threat Logit: [1] Edge Threat Logits: [E, 1]
```

### Recurrence & Edge Modeling Corrections

1. **Temporal Sequence Recurrence (`batch_first=False`)**: The spatiotemporal GRU receives node embeddings across time windows with shape `[W, N, C]`. PyTorch's `nn.GRU` with `batch_first=False` treats dimension 0 (`W`) as sequence length and dimension 1 (`N`) as batch elements. In earlier iterations, `batch_first=True` caused PyTorch to treat `N` as time steps and `W` as batch elements. Fixing this ensures recurrence genuinely propagates temporal state across time.
2. **Bidirectional Edge Message Aggregation**: Pure-source nodes (such as outbound C2 bots initiating connections) have zero incoming edges. In standard aggregation, pure-source nodes never receive edge feature information. The message projection step updates both source and destination node representations, ensuring attacker IPs incorporate edge flow attributes.
3. **Edge-Level Threat Classification**: An optional edge classification head projects concatenated endpoint representations `[h_src, h_dst]` into flow anomaly logits. When training with `--target edge`, loss backpropagates directly against malicious network flows.

### Parameter Breakdown & Checkpoint Compatibility

| Checkpoint | Target | Heads | In Channels | Edge Dim | Total Parameters | Notes |
|---|---|---|---|---|---|---|
| `mordor_mixed` | `node` | 2 (Node, Snapshot) | 10 (Type + Degree) | 8 (Rel + Time) | **36,098** | Legacy checkpoint preserved; backward-compatible |
| `ctu13_ho_c47` | `edge` | 3 (Node, Snapshot, Edge) | 1 (Type only) | 37 (Rel + Flow + Time) | **38,787** | NetFlow benchmark; held-out Scenario 47 evaluation |

`TemporalGNN.load_state_dict` includes a graceful backward-compatibility fallback (`strict=False` when `edge_classifier.weight` is missing in older weights), allowing legacy Mordor checkpoints to load seamlessly without code changes.

> [!CAUTION]
> **No Attention or Transformers**: The model architecture is strictly `GraphSAGE + GRU`. It contains **no** multi-head attention, graph transformers, or Large Language Models (LLMs). The metadata flags `has_attention`, `has_transformer`, and `has_llm` evaluate to `false`.

---

## Training

The training script `scripts/train_tgnn.py` trains the TemporalGNN on serialized snapshots:

### Implementation Defaults & Hyperparameters

| Parameter | Type | Default Value | Recorded in `best_model.pt`? |
|---|---|---|---|
| `--epochs` | `int` | `20` | Yes (Recorded run completed 5 epochs) |
| `--lr` | `float` | `1e-3` (`0.001`) | Yes |
| `--batch-size` | `int` | `8` | Yes |
| `--hidden-channels` | `int` | `64` | Yes |
| `--out-channels` | `int` | `64` | Yes |
| `--gnn-layers` | `int` | `2` | Yes |
| `--rnn-layers` | `int` | `1` | Yes |
| `--dropout` | `float` | `0.3` | Yes |
| `--window-size` | `int` | `10` | Yes |
| `--val-ratio` | `float` | `0.15` | Yes |
| `--test-ratio` | `float` | `0.15` | Yes |
| `--split-mode` | `str` | `block` | Implementation default |
| `--weight-decay` | `float` | `5e-4` | Implementation default |
| `--grad-clip` | `float` | `1.0` | Implementation default |
| `--patience` | `int` | `5` | Implementation default |
| `--select-metric` | `str` | `auc_pr` | Implementation default |
| `--pos-weight` | `float \| null` | `null` (auto-computed) | Yes (`null`) |
| `--seed` | `int` | `42` | Yes |

### Training History (`history.json`)
The recorded run completed 5 training epochs on `mordor_mixed`:

| Epoch | Train Loss | Validation Loss | Validation F1 | Validation AUC-ROC | Validation AUC-PR | Best Checkpoint |
|---|---|---|---|---|---|---|
| **1** | 0.3367 | 0.5502 | **0.9140** | 0.6324 | 0.8974 | **Saved (best_model.pt)** |
| **2** | 0.2802 | 0.5234 | 0.9140 | 0.6491 | 0.9138 | - |
| **3** | 0.2686 | 0.5175 | 0.9140 | 0.6523 | 0.9155 | - |
| **4** | 0.2626 | 0.5227 | 0.9140 | 0.5779 | 0.8872 | - |
| **5** | 0.2575 | 0.5568 | 0.9140 | 0.4749 | 0.8637 | - |

---

## Evaluation

Model evaluation is executed via `scripts/evaluate_tgnn.py` and produces `eval/metrics_test.json` and `eval/predictions_test.parquet`. The evaluation engine supports both node-level and edge-level evaluation across multiple operating points.

### 1. Legacy Evaluation (`models/checkpoints/mordor_mixed`)

The test partition for `mordor_mixed` contains 20,290 samples (1,072 positive malicious samples and 19,218 negative benign samples):

| Metric | Raw Artifact Value | UI Display Label (Rounded) | Description |
|---|---|---|---|
| **AUC-PR** | `0.2363` | `0.2363` | Area under the Precision-Recall curve |
| **AUC-ROC** | `0.7447` | `0.7447` | Area under the Receiver Operating Characteristic |
| **Recall (TPR)** | `1.0` | `100.0%` | Fraction of actual malicious samples detected |
| **Precision (PPV)** | `0.0528` | `5.28%` | Fraction of predicted malicious samples that are true positives |
| **F1-Score** | `0.1004` | `0.1004` | Harmonic mean of precision and recall at threshold |
| **Accuracy** | `0.0528` | `5.28%` | Overall correct sample ratio |

### Test Confusion Matrix

```text
                       Actual Benign (0)     Actual Malicious (1)
Predicted Benign (0)           0 (TN)                 0 (FN)
Predicted Malicious (1)   19,218 (FP)             1,072 (TP)
```

> [!WARNING]
> **Legacy All-Positive Operating Point**: In older training runs without a capped positive weight, the raw BCE loss weight forced logits heavily positive, causing the default threshold (0.50) to classify everything as malicious despite maintaining underlying ranking capability (AUC-ROC 0.7447).

### 2. CTU-13 Held-Out Benchmark (`models/checkpoints/ctu13_ho_c47`)

The CTU-13 benchmark models malicious network flows at the edge level and evaluates generalization on a held-out botnet scenario:

- **Checkpoint**: `ctu13_ho_c47`
- **Target**: `edge`
- **Scenario**: Held-out Scenario 47
- **Train Scenarios**: `ctu13_c52`, `ctu13_c46`, `ctu13_c53`, `ctu13_c48`
- **Test Scenario**: `ctu13_c47`
- **Total Parameters**: 38,787
- **In Channels**: 1 (node type one-hot)
- **Edge Dimension**: 37 (1 relation + 35 flow features + 1 relative time)
- **Output Heads**: Node, Snapshot, Edge

#### Test Split Metrics (`eval_test/metrics_test.json`)

The test partition contains 1,068,851 total flows (9,256 malicious positive flows, 1,059,595 benign negative flows):

| Metric | Raw Artifact Value | UI Display Label (Rounded) | Description |
|---|---|---|---|
| **AUC-ROC** | `0.9983` | `0.9983` | Area under the Receiver Operating Characteristic |
| **AUC-PR** | `0.7065` | `0.7065` | Area under the Precision-Recall curve |
| **Best F1** | `0.8388` | `0.8388` | Peak F1 score across decision thresholds |
| **Recall @ 1% FPR** | `0.9958` | `99.58%` | Detection rate constrained to 1% false positive rate |
| **Total Test Flows** | `1,068,851` | `1,068,851` | Total evaluated network flows in held-out scenario |
| **Malicious Flows** | `9,256` | `9,256` | Ground-truth botnet flows in held-out scenario |

> [!NOTE]
> **Confusion Matrix Counts**: Aggregate confusion-matrix counts are omitted because previously documented counts did not match the committed evaluation artifact.

See [TG-DETECT-vs-BASE-PAPER-RESULTS.md](docs/TG-DETECT-vs-BASE-PAPER-RESULTS.md) for full benchmark comparison against baseline literatures.

---

## Dataset Formats

TGDetect expects raw logs to arrive in line-delimited JSON formats conforming to one of the following schemas:

### 1. Synthetic JSON-Lines Format
```json
{
  "event_id": "syn-0001",
  "ts": 1700000015.2,
  "src_id": "user_alice",
  "dst_id": "workstation_01",
  "tactics": ["initial_access"],
  "apt_stage": "initial_compromise",
  "label": 1,
  "source_tag": "synthetic",
  "chain_id": "chain_syn_01",
  "causal_parent": null,
  "attrs": { "auth_type": "Kerberos" }
}
```

### 2. Mordor (Security-Datasets) Format
Structured Sysmon, Windows Security Auditing (Event ID 4624, 4688), or PowerShell operational events containing `EventID`, `Channel`, `Computer`, `Execution`, `ProcessId`, and `CommandLine`.

### 3. CTU-13 NetFlow Format (`.binetflow`, `.binetflow.xz`, `.binetflow.bz2`)
Comma-delimited bidirectional Argus network flow captures containing:
`StartTime, Dur, Proto, SrcAddr, Sport, Dir, DstAddr, Dport, State, sTos, dTos, TotPkts, TotBytes, SrcBytes, Label`

See [CTU-13-DATASET-DETAILS.md](docs/CTU-13-DATASET-DETAILS.md) for full scenario catalog and label mappings.

---

## Current Dataset & Provenance

To maintain strict scientific integrity, TGDetect explicitly distinguishes between demonstration data and external telemetry:

### A. Synthetic Demonstration Dataset (Bundled Locally)
- **Local Path**: `data/processed/mordor_empire/`
- **Origin**: Programmatically generated using `scripts/init_demo_data.py`.
- **Content**: 1,219 canonical events (1,200 benign background operations and 19 simulated malicious attack events modeling an Empire PowerShell command-and-control pivot, credential dumping, and exfiltration).
- **Scope**: Spans an epoch duration of 12,074.57 seconds (~3.35 hours) across 45 unique nodes.
- **Provenance Statement**: While located in a directory named `mordor_empire`, this artifact set is **synthetic demonstration data** generated to facilitate immediate local validation without requiring multi-gigabyte raw log downloads.

### B. Real External Datasets (Supported by Pipeline)
- **Mordor / Security-Datasets**: Pre-recorded cyber range scenarios published by the Open Threat Research (OTR) community (e.g., APT29, Empire, CaddyWiper). Supported via `parse_mordor_jsonl`.
- **CTU-13 Benchmark Dataset**: 13 real botnet traffic scenarios captured at CTU University, Prague (Neris, Rbot, Virut, Menti, Sogou, Murlo, NSIS). Supported via `parse_ctu13_binetflow` with full streaming support across compressed archives (`.xz`, `.bz2`). Checkpoints and evaluation reports for held-out Scenario 47 (`ctu13_ho_c47`) are included in `models/checkpoints/` and `reports/`.

### C. Data NOT Bundled with this Repository
- Multi-gigabyte raw PCAP captures, EVTX archives, and raw 100GB+ binetflow captures are not checked into git source control. Users can download raw CTU-13 files directly from Stratosphere IPS or run the automated cloud pipeline via Modal (`backend/modal_train.py`).

---

## Frontend Dashboard

The Next.js frontend delivers 8 core analytical workspaces:

```text
┌────────────────────────────┬────────────────────────────────────────────────────────┐
│ NAVIGATION ITEM            │ WORKSPACE PURPOSE & REAL DATA CONTRACT                 │
├────────────────────────────┼────────────────────────────────────────────────────────┤
│ 1. Overview                │ High-level KPI metrics, events-over-time area chart,   │
│                            │ node type breakdown, relation bars, recent detections. │
│ 2. Events                  │ 14-column filterable forensic table with text search,  │
│                            │ label/tactic filters, and JSON attribute inspector.   │
│ 3. Graph                   │ Force-directed HTML5 canvas visualizing 8 node types,  │
│                            │ 14 relations, degree distributions, and drag physics.  │
│ 4. Attack Chains           │ Multi-strategy reconstruction tabs (chain_id, causal,  │
│                            │ entity_time), timeline progression, and subgraphs.     │
│ 5. Datasets & Jobs         │ Dataset inventory, 6-stage pipeline progress monitor,  │
│                            │ and job configuration prototype modal.                 │
│ 6. Artifacts Explorer      │ Inspection of Parquet & JSON artifacts with PyArrow     │
│                            │ schemas, field data types, and typed row previews.     │
│ 7. TGNN / Model            │ 4 segmented tabs: Architecture, Snapshots, Training    │
│                            │ History, and Test Evaluation (Confusion Matrix).       │
│ 8. Analytics               │ 4 segmented tabs: Event distributions, Graph topology, │
│                            │ Attack characteristics, and Dataset normalization.     │
└────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## API Reference

The FastAPI backend exposes 29 fully implemented read-only `GET` endpoints:

### Implemented Endpoints Table

| Category | Method & Route | Purpose | Key Parameters | Return Data |
|---|---|---|---|---|
| **Health** | `GET /api/health` | Service health status | None | `{"status": "ok", "service": "tgdetect", "version": "1.0.0", "backend": "local"}` |
| **Overview** | `GET /api/overview` | Pipeline summary stats | None | Aggregated counts from `graph_stats.json` |
| **Events** | `GET /api/events` | Filtered TGEvent stream | `limit`, `offset`, `search`, `label`, `relations`, `node_types`, `tactics`, `chain_id` | `{"items": [TGEvent], "total": int}` |
| | `GET /api/events/recent-malicious` | Latest threat events | `limit` (default: 10) | Array of `TGEvent` where `label == 1` |
| | `GET /api/events/{event_id}` | Single event lookup | `event_id` (path) | `TGEvent` object or 404 error envelope |
| **Graph** | `GET /api/graph` | Graph node/edge bundle | `malicious_only`, `node_type`, `relation`, `chain_id`, `limit` | `{"nodes": [...], "edges": [...], "stats": {...}}` |
| | `GET /api/graph/nodes` | List all graph nodes | None | Array of `GraphNode` with in/out degrees |
| | `GET /api/graph/edges` | List all graph edges | None | Array of `GraphEdge` projections |
| | `GET /api/graph/nodes/{node_id}` | Node profile & incidents | `node_id` (path) | Detailed node statistics and incident events |
| | `GET /api/graph/stats` | Raw builder stats | None | Full `graph_stats.json` object |
| **Chains** | `GET /api/chains` | Reconstructed chains | `strategy` (`chain_id`, `causal_parent`, `entity_time`) | Array of `AttackChainSummary` from Parquet |
| | `GET /api/chains/strategies` | Grouped chain breakdown | None | Dictionary mapping strategies to chain lists |
| | `GET /api/chains/{chain_id}` | Single chain metadata | `chain_id` (path) | `AttackChainSummary` object or 404 |
| | `GET /api/chains/{chain_id}/subgraph` | Chain subgraph graph | `chain_id` (path) | JSON nodes and edges from `data/graphs/chains/` |
| | `GET /api/chains/{chain_id}/events` | Chain event sequence | `chain_id` (path) | Array of `TGEvent` objects belonging to chain |
| **Datasets** | `GET /api/datasets` | Available datasets | None | Array of registered dataset records |
| | `GET /api/datasets/{dataset_id}` | Dataset profile | `dataset_id` (path) | Single dataset configuration and size |
| | `GET /api/jobs` | Processing job records | None | Array of historical `ProcessingJob` objects |
| | `GET /api/jobs/{job_id}` | Single job execution | `job_id` (path) | Specific `ProcessingJob` metadata |
| **Artifacts**| `GET /api/artifacts` | Discovered artifacts | `job_id` (query) | Array of Parquet and JSON files with sizes |
| | `GET /api/artifacts/{artifact_id}` | Single artifact meta | `artifact_id` (path) | File statistics, schema, and description |
| | `GET /api/artifacts/{artifact_id}/schema` | Column schema definition | `artifact_id` (path) | Array of `{name, type, nullable}` |
| | `GET /api/artifacts/{artifact_id}/preview` | Columnar row preview | `artifact_id` (path), `limit` | Array of row dictionaries |
| **Model** | `GET /api/model/config` | Model hyperparameters | None | `TemporalGNN` architecture hyperparameters |
| | `GET /api/model/summary` | Parameter topology | None | Parameter counts (36,098) and layer specs |
| | `GET /api/model/snapshots` | Snapshot list & stats | `limit` (default: 100) | Array of snapshots with malicious edge counts |
| | `GET /api/model/snapshots/meta` | Snapshot metadata | None | Window sizes, strides, and snapshot bounds |
| | `GET /api/model/training` | Training run status | None | Epoch totals, best metric, checkpoint path |
| | `GET /api/model/training/history` | Per-epoch loss/metrics | None | Array of epoch history records from `history.json` |
| | `GET /api/model/evaluation` | Model evaluation stats | `split` (`train`, `val`, `test`) | Metrics from `eval/metrics_test.json` |
| | `GET /api/model/evaluation/runs` | Available eval runs | None | Array of available evaluation summaries |
| | `GET /api/model/predictions` | Prediction rows | `split`, `limit`, `offset` | Sample rows from `predictions_test.parquet` |
| **Analytics**| `GET /api/analytics/events` | Time-series telemetry | None | Event time buckets, tactic frequencies |
| | `GET /api/analytics/graph` | Graph metrics | None | Node/relation counts, degree distributions |
| | `GET /api/analytics/attacks` | Attack statistics | None | Strategy breakdowns, duration histograms |
| | `GET /api/analytics/datasets` | Normalization analytics | None | Normalization accept/reject and labeling stats |

### Planned / Not Implemented Endpoints
- `POST /api/jobs`: Start real background graph builder execution. *(Currently: Offline CLI only; UI modal is a configuration prototype).*
- `POST /api/datasets/upload`: Upload raw log archives from the browser.
- `POST /api/model/train`: Trigger remote or local TGNN training from the web UI.

---

## Local Setup

### Prerequisites
- **Python**: Python 3.10, 3.11, or 3.12 (also tested on Python 3.14).
- **Node.js**: Node.js 20+ (or Node.js 18.17+) with `npm` or `bun`.
- **Git**: For version control.

---

## Running the Backend

From the repository root, navigate into `backend/`:

```bash
cd backend

# 1. Create and activate a Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install backend dependencies
pip install -r requirements-graph.txt
pip install -r requirements-ml.txt
# Alternatively, for minimal API serving:
# pip install fastapi uvicorn pydantic pandas pyarrow networkx pyyaml tqdm httpx orjson

# 3. Generate or refresh the demonstration dataset (if needed)
python scripts/init_demo_data.py

# 4. Launch the FastAPI server on port 8000
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Health Verification**: `curl http://localhost:8000/api/health`
- **Overview Verification**: `curl http://localhost:8000/api/overview`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc Technical Interface**: `http://localhost:8000/redoc`

---

## Running the Frontend

From the repository root, navigate into `frontend/`:

```bash
cd frontend

# 1. Prepare environment file
cp .env.example .env.local

# 2. Install Node dependencies
npm install

# 3. Start development server on port 3000
npm run dev
```

Open `http://localhost:3000` in your browser.

### Environment Configuration (`.env.local`)

| Variable | Default Value | Description |
|---|---|---|
| `NEXT_PUBLIC_TGDETECT_API_URL` | `http://localhost:8000` | Backend API base URL |
| `NEXT_PUBLIC_TGDETECT_MOCK_MODE` | `false` | When `false`, uses live API. Set to `true` only for offline static mock testing. |

---

## Modal GPU Workflow

The repository includes `modal_train.py` for training the TemporalGNN on cloud GPUs using [Modal](https://modal.com):

```bash
# Authenticate with Modal
modal setup

# 1. Upload local processed Parquet graph to the persistent remote volume
modal run modal_train.py::upload --local-dir data/processed/mordor_mixed --remote-name mordor_mixed

# 2. Generate temporal snapshots on remote CPU workers
modal run modal_train.py::snapshots --name mordor_mixed --window-size 60 --stride 30

# 3. Train the TemporalGNN on an Nvidia A10G GPU
modal run modal_train.py::train --name mordor_mixed --epochs 50

# 4. Evaluate the best checkpoint on the test split
modal run modal_train.py::evaluate --name mordor_mixed --split test

# 5. Download results and checkpoints to local disk
modal run modal_train.py::download --name mordor_mixed --local-dir results/
```

---

## Artifact Structure

The filesystem artifacts produced and inspected by the platform are organized within `backend/` as follows:

```text
backend/data/
├── processed/
│   └── mordor_empire/
│       ├── events.parquet              # 1,219 canonical events with MITRE ATT&CK labels
│       ├── edges.parquet               # 1,219 graph edges for traversal & GNN inputs
│       ├── nodes.parquet               # 45 unique entities with in/out degree counts
│       ├── chains_summary.parquet      # 3 reconstructed multi-step attack campaigns
│       └── graph_stats.json            # Builder telemetry, label distributions, timing
│
├── snapshots/
│   └── mordor_empire/
│       ├── meta.json                   # Snapshot parameters (window_size, stride, counts)
│       └── snapshot_*.pkl              # 612 windowed PyTorch geometric snapshot tensors
│
└── graphs/
    └── chains/
        ├── chain_empire_01.json        # Subgraph for chain_id strategy
        ├── causal_*.json               # Subgraph for causal_parent strategy
        └── inferred_*.json             # Subgraph for entity_time strategy

backend/models/
└── checkpoints/
    └── mordor_mixed/
        ├── best_model.pt               # Checkpoint state dict (36,098 parameters, epoch 1)
        ├── final_model.pt              # State dict after final training epoch
        ├── history.json                # 5-epoch training loss and validation metrics
        └── eval/
            ├── metrics_test.json       # Test split metrics (AUC-PR: 0.23626, AUC-ROC: 0.7447)
            └── predictions_test.parquet# 20,290 sample predictions with ground truth
```

---

## Testing & Quality Verification

### Frontend Code Quality

Run from the `frontend/` directory:

```bash
cd frontend

# 1. TypeScript strict type check
npx tsc --noEmit

# 2. ESLint code standard check
npm run lint

# 3. Production standalone build
npm run build
```

### Backend Integration Tests

Run from the `backend/` directory using the virtual environment:

```bash
cd backend

# Run all backend integration tests
.venv/bin/python tests/test_api_integration.py
# or:
.venv/bin/python -m unittest discover -s tests
```

*Status: 12 tests passing covering health, overview, event filtering, attack chains, path traversal security, snapshots, training configurations, and normalization statistics.*

---

## Research Claim vs Implementation

| Capability / Claim | Actual Implementation Status | Current Technical Details |
|---|---|---|
| **Temporal Graph Representation** | **IMPLEMENTED** | Evolving directed multigraph with timestamped edges and sliding-window snapshots. |
| **Typed Entity & Relation Schema** | **IMPLEMENTED** | 8 node types and 14 relation types defined in `schema.py`. |
| **Relational Message Passing (HeteroConv/RGCN)** | **NOT IMPLEMENTED** | Node and edge types are one-hot encoded and passed to homogeneous `SAGEConv` layers with linear edge projection. |
| **Spatial Graph Convolution** | **IMPLEMENTED** | 2-layer `SAGEConv` with linear edge encoding and batch normalization. |
| **Temporal Sequence Modeling** | **IMPLEMENTED** | 1-layer `GRU` aggregating node embeddings across aligned snapshot sequences. |
| **Attention / Transformers / LLMs** | **NOT IMPLEMENTED** | Pure `SAGEConv + GRU`. No attention layers or transformer modules exist in the codebase. |
| **Rule-Based & Heuristic Labeling** | **IMPLEMENTED** | `labeler.py` matches suspicious process names, LOLBINs, and command lines with time-window propagation. |
| **MITRE ATT&CK Tactic Mapping** | **IMPLEMENTED** | Tactic extraction and attack stage sequencing across events and reconstructed chains. |
| **Attack-Chain Reconstruction** | **IMPLEMENTED** | 3 strategies: `chain_id` (ground truth), `causal_parent` (DAG link traversal), `entity_time` (proximity inference). |
| **APT Detection** | **EXPERIMENTAL / RESEARCH** | Functional proof-of-concept for detecting multi-step campaigns; evaluated on synthetic/mordor data. |
| **Validation Threshold Tuning** | **IMPLEMENTED** | `train_tgnn.py` tunes the classification threshold on validation F1 during training. |
| **Test Partition Evaluation** | **IMPLEMENTED** | Evaluated on test split (`eval/metrics_test.json`, `eval/predictions_test.parquet`). *Train/val evaluation artifacts are not saved.* |
| **Continual Learning / Rehearsal Buffer**| **NOT IMPLEMENTED** | No continual learning buffers, rehearsal mechanisms, or streaming fine-tuning loops exist. |
| **Cloud GPU Training** | **IMPLEMENTED** | Fully functioning Modal integration (`modal_train.py`) targeting Nvidia A10G GPUs. |
| **Add Dataset / Job Ingestion UI** | **UI PROTOTYPE ONLY** | Frontend configuration wizard exists; does not initiate background ingestion. Ingestion is run via CLI. |
| **Background Task Executor** | **NOT IMPLEMENTED** | No Celery or Redis job runner. Reads pre-generated Parquet and JSON files. |

---

## Security & Engineering Safeguards

- **Strict Path Traversal Protection**: The backend enforces a strict whitelist of permissible artifact filenames (`ALLOWED_ARTIFACTS`) in `api/services/artifacts_service.py` and verifies `path.is_relative_to()`, completely neutralizing directory traversal attacks (`../`).
- **Restricted CORS Policy**: `CORSMiddleware` explicitly permits requests only from `http://localhost:3000` and `http://127.0.0.1:3000`.
- **Zero Silent Mock Fallback**: If the backend is unreachable and `NEXT_PUBLIC_TGDETECT_MOCK_MODE=false`, the UI displays a connection error panel rather than showing misleading mock data.
- **Strict Credential Hygiene**: No secret API keys, access tokens, or credentials are hardcoded or tracked in Git. `.env*` files are excluded by `.gitignore` (except `.env.example`).

---

## Known Limitations

1. **No Browser-Based Dataset Processing**: The "Add Dataset / New Job" modal in the frontend is currently a configuration interface. Uploading and processing new datasets must be executed via the CLI (`scripts/build_graph.py`).
2. **Evaluation Split Artifacts**: The model checkpoint directory preserves evaluation metrics and prediction rows exclusively for the `test` partition. Train and validation metric artifacts are not currently output to disk.
3. **No EVTX or CSV Parsers**: Raw Windows Event Log binaries (`.evtx`) and CSV tables cannot be ingested directly without prior conversion to JSON Lines.
4. **Homogeneous Neural Ingestion**: While the data schema is heterogeneous, the neural layers process one-hot encoded feature matrices through homogeneous graph convolutions rather than relational convolutions.

---

## Roadmap

- [ ] Wire `POST /api/jobs` to an asynchronous worker queue (Celery or ARQ) to enable dataset ingestion directly from the frontend.
- [ ] Implement native `.evtx` streaming parsing using `evtx` Rust bindings.
- [ ] Add relational graph convolutional operators (`RGCNConv` or `HeteroConv`) to evaluate performance against homogeneous `SAGEConv`.
- [ ] Persist complete evaluation artifacts across `train`, `val`, and `test` splits.
- [ ] Add streaming replay capabilities for simulating real-time telemetry ingestion.

---

## Project & Research Context

TGDetect is developed as an open research and engineering initiative exploring temporal graph neural network architectures for cybersecurity incident detection and automated attack-chain investigation.

- **Primary Repository**: [https://github.com/Pratham2511/TGDetect-Temporal-Graph](https://github.com/Pratham2511/TGDetect-Temporal-Graph)
- **Active Feature Branch**: `feat/local-backend-integration`

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
