# TGDetect

### Temporal Graph Security Detection & Investigation Platform

TGDetect transforms raw cybersecurity telemetry into **temporal heterogeneous graphs**, directed security relationships, causal attack chains, and interactive forensic surfaces. By combining streaming graph construction with a spatiotemporal graph neural network (GraphSAGE + GRU), TGDetect detects stealthy, multi-stage threats while providing analysts with an authentic, research-grade command center.

> **TGDetect never substitutes uploaded telemetry with fake dashboard data.**<br/>
> When a dataset is activated, the application synchronizes its state globally across every investigation view. Model benchmark metrics describe the production neural network; live telemetry describes your data.

---

## Interface Preview

### Security Command Center

The Security Command Center provides a high-density operational overview strictly separated into live operational telemetry and offline model benchmark evaluation.

![Security Command Center (Night Operations)](docs/images/01_overview_command_center.png)
*Figure 1: Security Command Center in Night Operations. Section A renders live telemetry from the active dataset (CTU-13 Scenario 47: 1,068,851 events, 9,256 malicious flows). Section D isolates the production model evaluation benchmark with explicit provenance labeling.*

![Security Command Center (Solarized Light Operations)](docs/images/01b_overview_solarized_light.png)
*Figure 2: Security Command Center in Solarized Light Operations. Built with warm ivory (`#fdf6e3`), Solarized base2 (`#eee8d5`), sandstone borders (`#dfd7c2`), and deep slate typography (`#073642`) for complete day-shift visual ergonomics.*

---

### Temporal Heterogeneous Graph

Security interactions are modeled as a directed, temporal multigraph where nodes represent entities and edges represent timestamped communications.

![Temporal Heterogeneous Graph](docs/images/02_temporal_heterogeneous_graph.png)
*Figure 3: Temporal Heterogeneous Graph generated from the active telemetry partition (`tgdetect_ctu13_test_sample`). Nodes represent communicating IP endpoints, edges represent directional flow relations, and malicious attack paths are highlighted with red threat illumination. When the active dataset changes, topology updates dynamically.*

![Temporal Heterogeneous Graph (Solarized Light)](docs/images/02b_temporal_graph_solarized.png)
*Figure 4: Temporal Heterogeneous Graph rendered under Solarized Light Operations showing canonical NetFlow topology between communicating hosts.*

---

### Forensic Event Stream & Processing Pipeline

Granular investigation tools allow security analysts to inspect raw flows, track causal parents, and monitor the streaming GNN construction pipeline.

![Events Investigation](docs/images/03_events_investigation.png)
*Figure 5: Granular Event Investigation table displaying normalized flow records (`TGEvent`), source and target entities, directional relations, ground-truth labels, and MITRE ATT&CK tactic tags.*

![Dataset Ingestion Pipeline](docs/images/04_datasets_pipeline.png)
*Figure 6: Datasets & Processing Pipeline view displaying active telemetry partition status (`● ACTIVE TELEMETRY PARTITION`), 5-stage ingestion diagnostics, and the 6-stage GNN pipeline visualization.*

---

## Dataset Truth Architecture

TGDetect is engineered around the principle of **uncompromising data truthfulness**. In cybersecurity operations and academic research, visual dashboards that substitute mock numbers or silently fall back to demo datasets erode trust and compromise investigation integrity.

```
                  ┌──────────────────────────────┐
                  │   AUTHORITATIVE DATA CACHE   │
                  │   (FastAPI Backend Server)   │
                  └──────────────┬───────────────┘
                                 │
                   POST /api/datasets/{id}/activate
                                 │
                  ┌──────────────▼───────────────┐
                  │    GLOBAL DATASET CONTEXT    │
                  │   (Next.js State Provider)   │
                  └──────────────┬───────────────┘
                                 │
        ┌──────────────┬─────────┴────────┬──────────────┬──────────────┐
        ▼              ▼                  ▼              ▼              ▼
   [Overview]      [Events]            [Graph]        [Chains]     [Artifacts]
  Live Telemetry  Active Flows     Real Topology    Causal Paths  Active Parquet
```

### 1. Single Source of Truth
The active dataset is globally authoritative across the platform:
- **Backend**: `DataCache` manages the active dataset partition, Parquet storage paths, graph summary metadata, and sliding-window snapshot indices.
- **Frontend**: `DatasetContext` provides reactive state (`activeDatasetId`, `activeDataset`, `activateDataset()`, `datasetVersion`).
- **Zero Full-Page Reloads**: Activating a new dataset increments `datasetVersion`, automatically invalidating and refetching all queries (`useOverview`, `useEvents`, `useGraphNodes`, `useGraphEdges`, `useChains`, `useArtifacts`) via reactive hooks.

### 2. Live Telemetry vs. Model Benchmark Separation
TGDetect enforces a strict distinction between two categories of information:

| Information Domain | Description | Examples | Provenance Rule |
| :--- | :--- | :--- | :--- |
| **Live Dataset Telemetry** | Derived exclusively from the currently active dataset. | Event count, malicious count, unique nodes, graph edges, attack chains, temporal span, topology. | **Must change** whenever the active dataset changes. |
| **Model Benchmark Metrics** | Evaluates the production neural network checkpoint on held-out research data. | ROC-AUC (0.9983), PR-AUC (0.7065), Best F1 (0.8388), Recall @ 1% FPR (99.58%), 38,787 params. | **Never pretends** to be generated from uploaded telemetry. Labeled explicitly as held-out evaluation. |

### 3. Truthful Empty States
If an uploaded dataset contains zero events or produces zero graph relationships, TGDetect renders explicit, domain-specific empty states (`NO GRAPH TOPOLOGY AVAILABLE`, `TEMPORAL SIGNAL ABSENT`, `ATTACK CHAINS ABSENT`) with diagnostic instructions. The system **never silently substitutes canonical CTU-13 data**.

---

## System Architecture

The following diagram illustrates the end-to-end dataflow from raw telemetry ingestion to interactive forensic visualization:

```mermaid
flowchart TD
    subgraph INGESTION ["1. Ingestion & Validation"]
        RAW[Raw Telemetry
NetFlow / Sysmon / Synthetic] --> VAL[Format Detector &
Schema Validator]
        VAL --> DIAG[Parser Diagnostics &
Field Verification]
    end

    subgraph PIPELINE ["2. Streaming GNN Construction Pipeline"]
        DIAG --> NORM[Streaming Normalizer
TGEvent Contract]
        NORM --> LBL[Labeling Engine
Parser / Seed / Heuristic]
        LBL --> BLD[StreamingGraphBuilder
Node & Edge Projection]
        BLD --> TRK[AttackTracker Engine
Multi-Strategy Chains]
        TRK --> EXP[Parquet Exporter
events, nodes, edges, chains]
    end

    subgraph BACKEND ["3. FastAPI Backend Core"]
        EXP --> CACHE[(DataCache
Authoritative Partition)]
        CACHE --> API_OV[/api/overview]
        CACHE --> API_EV[/api/events]
        CACHE --> API_GR[/api/graph]
        CACHE --> API_CH[/api/chains]
        CACHE --> API_DS[/api/datasets]
        CACHE --> API_AR[/api/artifacts]
        CACHE --> API_MD[/api/model]
    end

    subgraph FRONTEND ["4. Synchronized Command Center"]
        API_DS --> CTX[DatasetContext
Active Dataset State]
        CTX -.->|Synchronizes| UI_OV[Overview Deck]
        CTX -.->|Synchronizes| UI_EV[Events Investigation]
        CTX -.->|Synchronizes| UI_GR[Temporal Graph Viz]
        CTX -.->|Synchronizes| UI_CH[Attack Chains]
        CTX -.->|Synchronizes| UI_AR[Artifacts Inspector]
        CTX -.->|Synchronizes| UI_AN[Security Analytics]
    end

    classDef proc fill:#002b36,stroke:#2aa198,stroke-width:1px,color:#93a1a1;
    classDef sync fill:#073642,stroke:#268bd2,stroke-width:2px,color:#268bd2;
    class RAW,VAL,DIAG,NORM,LBL,BLD,TRK,EXP,CACHE,API_OV,API_EV,API_GR,API_CH,API_DS,API_AR,API_MD,UI_OV,UI_EV,UI_GR,UI_CH,UI_AR,UI_AN proc;
    class CTX sync;
```

---

## Key Capabilities

* **Dataset-Driven Investigation**: Upload real NetFlow (`.binetflow`, `.csv`), host event streams (`.jsonl`), or compressed archives (`.xz`, `.gz`, `.zip`). Once processed, telemetry immediately populates the entire investigation environment.
* **Temporal Heterogeneous Graphs**: Renders directional communication graphs with force-directed physics simulation, mapping communication volume to node radii and edge weights.
* **Granular Event Stream**: Filter hundreds of thousands of events by MITRE ATT&CK tactic, relation type, entity type, time window, or string query with sub-millisecond response.
* **Attack Chain Reconstruction**: Correlates disparate malicious actions into cohesive attack paths using three distinct graph traversal strategies:
  1. `entity_time`: Spatiotemporal correlation across communicating entities within configurable time windows.
  2. `chain_id`: Grouping via ground-truth campaign markers or scenario identifiers.
  3. `causal_parent`: Explicit causality tracing following parent-child process and socket hierarchies.
* **5-Stage Telemetry Ingestion Sequence**: Visualizes packet inspection progression: detecting package format, inspecting flow structure, validating temporal fields, extracting graph candidates, and confirming schema validity.
* **6-Stage GNN Pipeline Visualization**: Real-time telemetry pulse animating across the six pipeline stages during Parquet generation.
* **Dual-Mode Command Center**:
  - **Night Operations**: Obsidian/carbon surfaces (`#090d12`), restrained cyan signals (`#22d3ee`), and subtle topology background motion.
  - **Solarized Light Operations**: Warm ivory surface (`#fdf6e3`), matching Solarized base2 sidebar (`#eee8d5`), sandstone borders (`#dfd7c2`), and deep slate typography (`#073642`).

---

## Temporal Graph Representation

TGDetect constructs a typed, directed multigraph $G = (V, E, \mathcal{T}_V, \mathcal{T}_E)$ where:

### Entities (Nodes $v \in V$)
Nodes represent distinct entities in the computing and networking environment:
* `IP`: IPv4 or IPv6 network endpoints (e.g., `ip:147.32.84.165`, `ip:192.168.1.105`).
* `Host`: Computer endpoints identified by hostname or machine GUID.
* `Process`: Operating system processes qualified by process GUID and image path.
* `User`: System accounts or domain security identifiers (SIDs).
* `File`: Filesystem objects identified by canonical path or cryptographic hash.
* `Socket`: Local or remote protocol sockets (IP + port pairs).

### Relationships (Edges $e \in E$)
Edges represent directed interactions occurring at timestamp $t$:
* `NETWORK_FLOW`: Bidirectional or directional IP-to-IP network conversation carrying 37-dimensional flow features.
* `CONNECTS_TO`: Network socket establishment initiated by an endpoint process.
* `EXECUTES`: Parent process spawning a child process binary.
* `READS` / `WRITES` / `DELETES`: File system I/O initiated by a process.
* `AUTHENTICATES_TO` / `LOGON`: User credential authentication against a host.

> *Note: Available entity and relationship types vary depending on the active dataset schema (e.g., CTU-13 NetFlow focuses on IP entities and `NETWORK_FLOW` relations, while host telemetry encompasses processes, files, and users).*

---

## Dataset Switching Workflow

Switching the active telemetry partition is seamless and preserves operational continuity:

```
1. Select Target Partition    --> User selects partition in Datasets view or Top Rail
2. Trigger Activation        --> POST /api/datasets/{dataset_id}/activate
3. Synchronize Backend Cache  --> DataCache reloads graph Parquet, stats, and snapshots
4. Global Context Update      --> DatasetContext increments datasetVersion
5. Query Invalidation        --> SWR/Hooks detect version change and invalidate caches
6. Authoritative Refetch      --> All 6 view controllers refetch live dataset data
7. Synchronized Dashboard     --> Overview, Events, Graph, Chains, & Artifacts refresh
```

No full browser reload or hard refresh is required.

---

## Research & Model Foundation

TGDetect incorporates a spatiotemporal Graph Neural Network trained to detect botnet activity and Advanced Persistent Threats (APTs) under extreme class imbalance.

### Spatiotemporal Architecture (`TemporalGNN`)
The neural network integrates spatial graph convolution with temporal recurrence:
1. **Spatial Representation**: At each discrete time window $t$, a 2-layer **GraphSAGE** (`SAGEConv`) encoder aggregates structural neighborhood information with edge-feature projection:
   $$\mathbf{h}_v^{(t)} = 	ext{SAGEConv}\left(\left\{\mathbf{h}_u^{(t)} : u \in \mathcal{N}(v)
ight\}, \mathbf{e}_{uv}^{(t)}
ight)$$
2. **Temporal Recurrence**: A **Gated Recurrent Unit (GRU)** tracks entity state dynamics across sequenced temporal snapshots:
   $$\mathbf{s}_v^{(t)} = 	ext{GRU}\left(\mathbf{h}_v^{(t)}, \mathbf{s}_v^{(t-1)}
ight)$$
3. **Edge Classifier Head**: A multi-layer perceptron predicts maliciousness directly on directional communication edges:
   $$\hat{y}_{uv}^{(t)} = \sigma\left(\mathbf{W}_e \left[\mathbf{s}_u^{(t)} \,\|\, \mathbf{s}_v^{(t)} \,\|\, \mathbf{e}_{uv}^{(t)}
ight] + b_e
ight)$$

### Production Checkpoint (`ctu13_ho_c47`)
TGDetect operates with **exactly one authoritative production model**:

| Model Attribute | Specification | Verification Source |
| :--- | :--- | :--- |
| **Model Checkpoint** | `ctu13_ho_c47` | `backend/models/checkpoints/ctu13_ho_c47/best_model.pt` |
| **Architecture** | Spatiotemporal GNN (GraphSAGE + GRU) | `backend/models/tgnn.py` |
| **Target Classification** | **Edge** (Per-Flow Threat Classification) | Verified model config |
| **Trainable Parameters** | **38,787** | Verified via PyTorch `numel()` |
| **Input Node Dimension** | `1` (Scalar node density) | `in_channels=1` |
| **Edge Feature Dimension** | `37` (NetFlow statistical features) | `edge_dim=37` |
| **Hidden Embedding Dim** | `64` | `hidden_channels=64` |

### Held-Out Botnet Family Evaluation
The model was trained on 4 botnet families (Rbot, fast-flux/Virut, NSIS.ay, Sogou) and evaluated on a **completely unseen family (Donbot / Scenario 47)** to test true zero-day generalization:

| Evaluation Metric | Value | Operational Significance |
| :--- | :--- | :--- |
| **ROC-AUC** | **0.9983** | Threshold-free ranking quality across extreme class imbalance |
| **PR-AUC** | **0.7065** | Precision-Recall trade-off (baseline random prevalence: 0.0087) |
| **Best-F1** | **0.8388** | Balanced operating point (Precision: 0.7483, Recall: 0.9543) |
| **Recall @ 1% FPR** | **99.58%** | Fixed alert-budget point (catches 99.6% of threats at ≤1% false alerts) |
| **Accuracy** | **0.9972** | Overall classification accuracy on 1,068,851 test flows |

> **Authenticity Guardrail**: These evaluation metrics reflect the performance of `ctu13_ho_c47` on the CTU-13 benchmark test capture. They are **never** displayed as statistics of newly uploaded user telemetry.

---

## Technology Stack

### Backend Core
* **FastAPI**: Asynchronous high-performance RESTful API framework.
* **PyTorch 2.0+**: Deep learning compute engine with GPU and CPU execution support.
* **PyTorch Geometric (PyG)**: Graph neural network convolutions (`SAGEConv`).
* **PyArrow**: High-throughput columnar Parquet read/write serialization.
* **NetworkX**: In-memory graph algorithms and multi-strategy chain path traversal.
* **Pydantic v2**: Strict runtime data validation and contract enforcement.
* **Uvicorn**: Lightning-fast ASGI production web server.

### Frontend Application
* **Next.js 16 (App Router)**: Modern React framework with Turbopack compilation.
* **React 19**: Declarative UI component architecture.
* **TypeScript**: Strict type safety across API clients, models, and hooks.
* **Tailwind CSS v4**: High-performance CSS engine with dynamic theming.
* **Recharts**: Responsive SVG charting for temporal density and distribution analysis.
* **HTML5 Canvas**: Force-directed physics simulation for large-scale graph rendering.
* **Lucide React**: Clean, consistent technical iconography.

---

## Installation & Running

### Prerequisites
* **Python**: `3.10` or higher
* **Node.js**: `18.18` or higher
* **npm**: `9.0` or higher

### 1. Clone the Repository
```bash
git clone https://github.com/Pratham2511/TGDetect-Temporal-Graph.git
cd TGDetect-Temporal-Graph
```

### 2. Set Up Python Backend
```bash
# Create and activate Python virtual environment
python3 -m venv backend/.venv
source backend/.venv/bin/activate

# Install graph builder and machine learning dependencies
pip install -r backend/requirements-graph.txt
pip install -r backend/requirements-ml.txt
```

### 3. Set Up Frontend
```bash
cd frontend
npm install
cd ..
```

### 4. Launch the Platform

In terminal 1 (Backend Server):
```bash
PYTHONPATH=backend backend/.venv/bin/python3 -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

In terminal 2 (Frontend Interface):
```bash
cd frontend
npm run dev
```

Open your browser to **`http://localhost:3000`** to access the TGDetect Command Center.

---

## Project Structure

```text
TGDetect-Temporal-Graph/
├── backend/                        # Authoritative FastAPI backend & GNN core
│   ├── api/                        # API routes, dependencies, and services
│   │   ├── routes/                 # Endpoint routers (overview, events, graph, datasets)
│   │   └── services/               # Data services (graph_service, datasets_service)
│   ├── data/                       # Local data partitions
│   │   ├── processed/              # Processed Parquet artifacts (ctu13_c47, etc.)
│   │   └── uploads/                # Uploaded telemetry staging directory
│   ├── graph_builder/              # Streaming graph construction pipeline
│   │   ├── attack_tracker.py       # Multi-strategy attack chain reconstruction
│   │   ├── builder.py              # StreamingGraphBuilder core engine
│   │   ├── normalizer.py           # Canonical field normalization
│   │   └── parsers.py              # CTU-13 NetFlow, Sysmon, & synthetic parsers
│   ├── models/                     # GNN models and weights
│   │   ├── checkpoints/            # Model checkpoints (ctu13_ho_c47)
│   │   └── tgnn.py                 # GraphSAGE + GRU PyTorch module
│   ├── scripts/                    # Training, evaluation, and snapshot scripts
│   └── tests/                      # Python unit & integration tests
├── frontend/                       # Next.js 16 tactical command center
│   ├── public/                     # Static assets, icons, and branding
│   └── src/
│       ├── app/                    # Next.js App Router (layout.tsx, page.tsx, globals.css)
│       ├── components/tgdetect/    # TGDetect forensic views
│       │   ├── overview/           # Overview Command Deck
│       │   ├── graph/              # Temporal Heterogeneous Graph canvas
│       │   ├── events/             # Granular event investigation table
│       │   ├── chains/             # Attack chain reconstruction inspector
│       │   ├── datasets/           # Dataset ingestion & pipeline wizard
│       │   ├── artifacts/          # Parquet & JSON artifact explorer
│       │   └── shared/             # Tactical HUD badges, legends, and canvas
│       └── lib/                    # DatasetContext, hooks, and API client
└── docs/                           # Documentation, architectural references, & images
    └── images/                     # Screenshot gallery referenced in README
```

---

## Verification & Testing

Every commit to TGDetect is verified against four comprehensive automated test suites:

```bash
# 1. Backend Integration Tests (24 tests)
PYTHONPATH=backend backend/.venv/bin/python3 -m unittest discover -s backend/tests

# 2. CTU-13 Streaming Pipeline Tests (8 tests)
PYTHONPATH=backend backend/.venv/bin/python3 -m unittest backend/tests/test_ctu13_pipeline.py

# 3. Frontend TypeScript Typecheck (0 errors)
cd frontend && npx tsc --noEmit

# 4. Next.js Production Build
cd frontend && npm run build
```

---

## Design Philosophy

TGDetect is built to feel like an **authentic cybersecurity investigation instrument**, not a prototype dashboard mockup or generic SaaS interface.

* **Information Density**: Maximizes high-signal forensic indicators while preserving visual structure through three containment levels: *Command Surfaces*, *Instrument Panels*, and *Inline Metrics*.
* **Data Provenance**: Every metric, chart, and node displays its origin—clearly separating live operational telemetry from model benchmark evaluations.
* **Operational Clarity**: Interfaces use high-contrast monospace typography, technical corner brackets, and restrained signal indicators rather than generic floating card walls.
* **Purposeful Motion**: Animations are strictly functional—visualizing packet inspection scanning, temporal telemetry pulses, and force-directed graph physics.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
