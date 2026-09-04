# TGDetect — Temporal Graph Threat Detection Platform

[![Version](https://img.shields.io/badge/Version-1.0.0-green.svg)](https://github.com/Pratham2511/TGDetect-Temporal-Graph/releases)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141-teal?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PyTorch Geometric](https://img.shields.io/badge/PyG-TGNN-orange)](https://pytorch-geometric.readthedocs.io/)

A complete, locally runnable temporal heterogeneous graph cybersecurity research platform. Integrates the **Next.js frontend** (`localhost:3000`) with the **TGDetect FastAPI backend** (`localhost:8000`), operating on real parquet and JSON graph artifacts and real TGNN (GraphSAGE + GRU) model checkpoints.

---

## 🏛️ System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     NEXT.JS FRONTEND                         │
│                     localhost:3000                           │
│                                                             │
│ Overview │ Events │ Graph │ Chains │ Datasets │ Artifacts   │
│                         │ TGNN │ Analytics                   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              │ HTTP / JSON (CORS localhost:3000)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TGDETECT API                              │
│                    localhost:8000                            │
│                                                             │
│ Health │ Overview │ Events │ Graph │ Chains                 │
│ Datasets │ Artifacts │ Model │ Analytics                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 EXISTING TGDETECT BACKEND                    │
│                                                             │
│ Parsers │ Normalization │ Labeling │ StreamingGraphBuilder  │
│ AttackTracker │ SnapshotBuilder │ TemporalGNN (SAGE+GRU)    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL DATA & ARTIFACTS                  │
│                                                             │
│ events.parquet │ edges.parquet │ nodes.parquet              │
│ chains_summary.parquet │ graph_stats.json                   │
│ attack subgraphs (*.json) │ snapshot pickles │ checkpoints   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Running Locally)

### Prerequisites
- Python 3.10+ (tested on Python 3.12 / 3.14)
- Node.js 20+ (or 18+) & npm

---

### Step 1: Start the Backend (Port 8000)

```bash
cd tgdetect_backend

# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install fastapi uvicorn pydantic pandas pyarrow networkx pyyaml tqdm httpx

# 3. Initialize / generate demo processed graph artifacts (events, nodes, edges, chains, snapshots)
python scripts/init_demo_data.py

# 4. Start the FastAPI server
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

* API Health Check: `http://localhost:8000/api/health`
* Interactive API Docs (Swagger): `http://localhost:8000/docs`

---

### Step 2: Start the Frontend (Port 3000)

In a separate terminal:

```bash
cd TGDetect

# 1. Setup environment variables (default is MOCK_MODE=false)
cp .env.example .env.local

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_TGDETECT_API_URL` | `http://localhost:8000` | Backend API base URL |
| `NEXT_PUBLIC_TGDETECT_MOCK_MODE` | `false` | When `false`, uses real API backend. Set to `true` only for offline static mock testing. |

---

## 🛡️ Correct Offline Failure Behavior

When `NEXT_PUBLIC_TGDETECT_MOCK_MODE=false`, the platform **never silently falls back to mocks** on network or API failures. If the backend is unavailable or stopped:
1. The top navigation shell displays a red `● API OFFLINE` indicator.
2. The UI renders a dedicated `TGDetect API OFFLINE` panel with connection diagnostics and a **Retry Connection** button.
3. No fabricated data, mock events, or mock graphs are ever displayed.

---

## 📡 Implemented API Endpoints

| Category | Method & Endpoint | Description |
|---|---|---|
| **Health** | `GET /api/health` | Service health, version, and local status |
| **Overview** | `GET /api/overview` | Pipeline aggregate statistics from `graph_stats.json` |
| **Events** | `GET /api/events` | Paginated and filtered `TGEvent` stream from `events.parquet` |
| | `GET /api/events/recent-malicious` | Latest malicious event detections |
| | `GET /api/events/{event_id}` | Detailed single event with causal links and metadata |
| **Graph** | `GET /api/graph` | Heterogeneous graph nodes and edges for canvas rendering |
| | `GET /api/graph/stats` | Raw `graph_stats.json` summary |
| | `GET /api/graph/nodes` | List of all graph nodes |
| | `GET /api/graph/edges` | List of graph edges |
| | `GET /api/graph/nodes/{node_id}` | Node inspector details and incident events |
| **Attack Chains** | `GET /api/chains` | Reconstructed chains from `chains_summary.parquet` |
| | `GET /api/chains/strategies` | Chains grouped by strategy (`chain_id`, `causal_parent`, `entity_time`) |
| | `GET /api/chains/{chain_id}` | Single attack chain summary |
| | `GET /api/chains/{chain_id}/subgraph` | Attack chain subgraph JSON (`data/graphs/chains/*.json`) |
| | `GET /api/chains/{chain_id}/events` | Events belonging to the selected chain |
| **Datasets & Jobs** | `GET /api/datasets` | Available local datasets from filesystem |
| | `GET /api/datasets/{dataset_id}` | Dataset configuration and metrics |
| | `GET /api/jobs` | Processing pipeline job status |
| **Artifacts** | `GET /api/artifacts` | Discovered parquet and JSON artifacts |
| | `GET /api/artifacts/{id}/schema` | Column names, data types, and nullable constraints |
| | `GET /api/artifacts/{id}/preview` | Real preview rows from parquet/JSON files |
| **Model (TGNN)** | `GET /api/model/config` | Real `TemporalGNN` hyperparameters (`SAGEConv` + `GRU`) |
| | `GET /api/model/summary` | Layer topology and parameter counts |
| | `GET /api/model/snapshots` | Temporal snapshots from `data/snapshots/mordor_empire` |
| | `GET /api/model/training` | Training run history from `models/checkpoints/mordor_mixed/history.json` |
| | `GET /api/model/evaluation` | Real evaluation metrics from `eval/metrics_test.json` |
| | `GET /api/model/predictions` | Prediction rows from `eval/predictions_test.parquet` |
| **Analytics** | `GET /api/analytics/events` | Time-series timeline, tactics, and source distributions |
| | `GET /api/analytics/graph` | Node types, relations, and degree distributions |
| | `GET /api/analytics/attacks` | Attack strategy breakdown and duration histograms |
| | `GET /api/analytics/datasets` | Normalization drop rates and heuristic labeling stats |

---

## 🧪 Validation & Testing

```bash
# Frontend type check
npx tsc --noEmit

# Frontend lint check
npm run lint

# Frontend production build
npm run build

# Backend direct endpoint tests
curl http://localhost:8000/api/health
curl http://localhost:8000/api/overview
curl http://localhost:8000/api/events?limit=5
curl http://localhost:8000/api/graph
curl http://localhost:8000/api/chains
curl http://localhost:8000/api/model/evaluation?split=test
```

---

## 🔒 Security & Git Hygiene

- No credentials, tokens, passwords, or personal access tokens are committed or logged.
- Secret `.env` files are ignored via `.gitignore` (`.env*`, with exception `!.env.example`).
- All communications are strictly local (`localhost:3000` / `localhost:8000`).
