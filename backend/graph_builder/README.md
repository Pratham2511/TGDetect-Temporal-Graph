# TG-Detect — Graph Construction Layer

Turns raw security logs into a **directed, heterogeneous, temporal, multi-relational**
graph and reconstructs attack chains. Independent of the TGNN training code; the
parquet outputs are the handoff point.

```
RAW LOGS -> dataset parser -> TGEvent -> normalizer -> temporal graph
         -> malicious event tracking -> attack chains/subgraphs -> parquet
```

## Install

```bash
pip install -r requirements-graph.txt
```

## Path A — synthetic data (`v6_ood_formal.jsonl`)

```bash
# small slice first
head -n 100000 data/raw/v6_ood_formal.jsonl > data/raw/sample_100k.jsonl

python scripts/build_graph.py --dataset synthetic \
  --input data/raw/sample_100k.jsonl --out data/processed --networkx

python scripts/validate_graph.py --processed data/processed --track-duplicates

# then the full file (drop --networkx: streaming mode, RAM scales with entities)
python scripts/build_graph.py --dataset synthetic \
  --input data/raw/v6_ood_formal.jsonl --out data/processed
```

## Path B — real dataset (Mordor / OTRF Security-Datasets)

```bash
# 1. inspect without extracting
python scripts/inspect_dataset.py ~/dataset.zip --max-files 10 --sample 200

# 2. build from one scenario log (labels/tactics joined from the scenario YAML)
python scripts/build_graph.py --dataset mordor \
  --input path/to/scenario.json \
  --metadata-dir path/to/Security-Datasets/datasets/atomic/_metadata \
  --out data/processed/mordor --graphs-out data/graphs/mordor

# 3. many files: loop, one file at a time, separate output dirs
for f in path/to/atomic/windows/**/*.json; do
  python scripts/build_graph.py --dataset mordor --input "$f" \
    --metadata-dir path/to/_metadata --out "data/processed/$(basename "$f" .json)"
done
```

`.gz` and `.zip` inputs stream directly — no extraction needed.

## Outputs

| File | Contents |
| --- | --- |
| `data/processed/events.parquet` | full unified event schema (one row per typed timestamped edge) |
| `data/processed/edges.parquet` | thin edge projection for fast graph loads |
| `data/processed/nodes.parquet` | node_id, node_type, first/last seen, degrees, malicious count |
| `data/processed/chains_summary.parquet` | one row per reconstructed attack chain |
| `data/processed/graph_stats.json` | normalization + graph + attack statistics |
| `data/graphs/chains/<chain_id>.json` | per-attack subgraph (nodes + ordered edges) |

## Modules

| Module | Role |
| --- | --- |
| `schema.py` | `TGEvent`, `NodeType`/`RelationType`, arrow schemas |
| `parsers.py` | `parse_synthetic_jsonl`, `parse_mordor_jsonl`, `PARSERS` registry |
| `normalizer.py` | entity typing, `type:value` ids, ts coercion (epoch/ISO/FILETIME), validation |
| `builder.py` | `StreamingGraphBuilder` (scalable) and `TemporalGraphBuilder` (NetworkX) |
| `attack_tracker.py` | `ChainIdTracker`, `CausalParentTracker`, `EntityTimeTracker` |
| `exporters.py` | incremental parquet writers, subgraph + stats export |

## Adding a dataset

```python
def parse_mydataset(path, limit=None):
    for row in stream(path):
        yield TGEvent(event_id=..., ts=..., src_id=..., src_type="IP",
                      dst_id=..., dst_type="IP", relation="NETWORK_FLOW",
                      label=..., source_tag="mydataset", attrs={...})

PARSERS["mydataset"] = parse_mydataset
```

Everything downstream (normalizer, builder, tracker, exporters, validator) works unchanged.

## Attack tracking strategies

Applied in priority order (`--strategies`); each strategy only sees malicious
events not already grouped by a higher-priority one.

1. `chain_id` — ground-truth grouping.
2. `causal_parent` — union-find over causal links; reports dangling parents.
3. `entity_time` — shared entity + temporal proximity (`--window`, `--max-hops`),
   for datasets with no chain ground truth.

## Scalability notes

- Everything is a generator: parse → normalize → build → track → export in one pass.
- RAM scales with **distinct entities**, not event count; edges flush every `--chunk-size` rows.
- `--networkx` materializes the full MultiDiGraph — debug/small runs only.
- `attrs` is stored as a JSON string so per-dataset keys never break the arrow schema.
