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
- `graph_builder/`: Streaming graph construction, entity normalizers, attack trackers, and exporters.
- `models/`: PyTorch Geometric TemporalGNN definitions and saved checkpoint artifacts.
- `scripts/`: CLI pipelines for graph building, snapshot construction, training, and evaluation.
- `tests/`: Automated unit and integration test suite.
- `data/`: Processed Parquet tables, graph statistics, and temporal snapshot sequence pickles.
- `reports/`: Generated distribution plots, training curves, and timeline figures.
- `results/`: Evaluation metric JSON files and parquet test split predictions.
