# TGDetect Backend

This directory contains the Python graph processing pipeline, Temporal Graph Neural Network (TemporalGNN) model architectures, CLI scripts, and FastAPI backend service for TGDetect.

For full architectural documentation, pipeline diagrams, and system specifications, see the root [README.md](../README.md).

## Quick Start

```bash
# 1. Create and activate a Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements-graph.txt
pip install -r requirements-ml.txt

# 3. Initialize or verify demonstration data
python scripts/init_demo_data.py

# 4. Run tests
python tests/test_api_integration.py

# 5. Start the FastAPI server
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

## Directory Layout

- `api/`: FastAPI server application, route controllers, and service handlers.
- `graph_builder/`: Streaming graph construction, entity normalizers, NetFlow and security log parsers, attack trackers, and exporters.
- `models/`: PyTorch Geometric TemporalGNN definitions, edge classification heads, and saved checkpoint artifacts (`mordor_mixed`, `ctu13_ho_c47`).
- `scripts/`: CLI pipelines for graph building, snapshot construction, training, evaluation, plotting, and demo data.
- `tests/`: Automated unit and integration test suite (`test_api_integration.py`, `test_ctu13_pipeline.py`).
- `data/`: Processed Parquet tables, graph statistics, and temporal snapshot sequence pickles.
- `reports/`: Generated distribution plots, training curves, timeline figures, and evaluation summaries.
- `results/`: Evaluation metric JSON files and parquet test split predictions.

## Running Tests

```bash
# Run full test suite (legacy integration + CTU-13 NetFlow pipeline tests)
PYTHONPATH=backend backend/.venv/bin/python3 -m unittest discover backend/tests

# Run smoke test
PYTHONPATH=backend backend/.venv/bin/python3 backend/scripts/smoke_test.py
```

## CTU-13 Pipeline Commands

```bash
# 1. Ingest CTU-13 binetflow capture into typed temporal graph
python scripts/build_graph.py \
    --dataset ctu13 \
    --input data/raw/ctu13/capture20110818.binetflow \
    --output data/processed/ctu13_c47 \
    --ctu13-background benign

# 2. Build temporal snapshots with 37-dim leakage-free flow features
python scripts/build_snapshots.py \
    --data data/processed/ctu13_c47 \
    --out data/snapshots/ctu13_c47 \
    --window-size 120.0 \
    --stride 60.0 \
    --node-feature-mode type_only \
    --edge-feature-mode flow \
    --scenario-id 47

# 3. Train edge-level TemporalGNN with scenario held-out split
python scripts/train_tgnn.py \
    --target edge \
    --snapshots-root data/snapshots/ctu13 \
    --train-scenarios 43 44 45 46 48 49 50 51 52 53 54 \
    --test-scenarios 47 \
    --pos-weight-cap 30.0 \
    --hidden-channels 64 \
    --out-channels 64 \
    --epochs 20 \
    --batch-size 8 \
    --out-dir models/checkpoints/ctu13_ho_c47

# 4. Evaluate with 3 operating points (saved, best-F1, 1% FPR)
python scripts/evaluate_tgnn.py \
    --checkpoint models/checkpoints/ctu13_ho_c47/best_model.pt \
    --out-dir models/checkpoints/ctu13_ho_c47/eval_test
```
