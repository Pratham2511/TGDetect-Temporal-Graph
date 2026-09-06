"""Load and inspect processed TG-Detect graph parquet files.

The loader is the bridge between the construction pipeline and the TGNN
training code. It reads `events.parquet`, `nodes.parquet`, and `edges.parquet`,
validates schemas, builds index mappings, and exposes a clean dataset object.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from .schema import EDGE_OPTIONAL_COLUMNS, EDGE_SCHEMA, EVENT_SCHEMA, NODE_SCHEMA


class TemporalGraphDataset:
    """In-memory view of a processed temporal heterogeneous graph.

    Keeps the full event/node/edge tables in memory as pandas DataFrames.
    For multi-GB datasets the TGNN dataloader should stream snapshots instead
    of materialising everything at once; this class is intended for inspection,
    validation, and modest-size experiments.
    """

    def __init__(
        self,
        events: pd.DataFrame,
        nodes: pd.DataFrame,
        edges: pd.DataFrame,
        stats: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.events = events
        self.nodes = nodes
        self.edges = edges
        self.stats = stats or {}

        # Canonical integer index for every node (used by TGNN models).
        self.node_id_to_index: Dict[str, int] = {
            nid: i for i, nid in enumerate(self.nodes["node_id"].tolist())
        }
        self.index_to_node_id: Dict[int, str] = {
            i: nid for nid, i in self.node_id_to_index.items()
        }

        # Categorical encoders for heterogeneous types and relations.
        self.node_types = sorted(self.nodes["node_type"].unique().tolist())
        self.relations = sorted(self.edges["relation"].unique().tolist())

        self.node_type_to_index: Dict[str, int] = {
            t: i for i, t in enumerate(self.node_types)
        }
        self.relation_to_index: Dict[str, int] = {
            r: i for i, r in enumerate(self.relations)
        }

    @property
    def num_nodes(self) -> int:
        return len(self.nodes)

    @property
    def num_edges(self) -> int:
        return len(self.edges)

    @property
    def num_events(self) -> int:
        return len(self.events)

    @property
    def temporal_span_s(self) -> Optional[float]:
        if self.events.empty:
            return None
        return float(self.events["ts"].max() - self.events["ts"].min())

    def summary(self) -> Dict[str, Any]:
        """Human-readable summary of the loaded graph."""
        label_counts = Counter()
        if "label" in self.events.columns:
            label_counts = Counter(self.events["label"].astype(int).tolist())

        chain_counts = Counter()
        if "chain_id" in self.events.columns and self.events["chain_id"].notna().any():
            chain_counts = Counter(self.events["chain_id"].dropna().tolist())

        return {
            "num_events": self.num_events,
            "num_nodes": self.num_nodes,
            "num_edges": self.num_edges,
            "temporal_span_s": self.temporal_span_s,
            "node_types": dict(self.nodes["node_type"].value_counts()),
            "relations": dict(self.edges["relation"].value_counts()),
            "labels": dict(label_counts),
            "malicious_events": int(label_counts.get(1, 0)),
            "benign_events": int(label_counts.get(0, 0)),
            "num_chains": len(chain_counts),
            "top_chains": dict(chain_counts.most_common(10)),
            "loaded_stats": self.stats,
        }

    def print_summary(self) -> None:
        s = self.summary()
        print("=" * 70)
        print("TEMPORAL GRAPH DATASET SUMMARY")
        print("=" * 70)
        print(f"Events : {s['num_events']:,}")
        print(f"Nodes  : {s['num_nodes']:,}")
        print(f"Edges  : {s['num_edges']:,}")
        print(f"Time span (s) : {s['temporal_span_s']}")
        print(f"Malicious : {s['malicious_events']:,}")
        print(f"Benign    : {s['benign_events']:,}")
        print(f"Chains    : {s['num_chains']}")
        print("-" * 70)
        print("Node types:")
        for t, c in s["node_types"].items():
            print(f"  {t}: {c}")
        print("-" * 70)
        print("Relations:")
        for r, c in s["relations"].items():
            print(f"  {r}: {c}")
        print("=" * 70)


def _validate_schema(
    table: pa.Table,
    expected: pa.Schema,
    name: str,
    optional: Optional[frozenset] = None,
) -> None:
    """Warn about missing fields but do not crash on extra fields.

    `optional` columns are tolerated when absent — used for edge columns added
    after the initial release so graphs built earlier still load.
    """
    expected_names = set(expected.names)
    if optional:
        expected_names -= set(optional)
    actual_names = set(table.schema.names)
    missing = expected_names - actual_names
    if missing:
        raise ValueError(f"{name} parquet is missing required columns: {sorted(missing)}")


def load_graph(
    data_dir: str | Path,
    validate: bool = True,
) -> TemporalGraphDataset:
    """Load a processed graph directory produced by `build_graph.py`.

    Expected files:
        {data_dir}/events.parquet
        {data_dir}/nodes.parquet
        {data_dir}/edges.parquet
        {data_dir}/graph_stats.json   (optional)
    """
    root = Path(data_dir)
    if not root.is_dir():
        raise FileNotFoundError(f"Graph directory not found: {root}")

    events_path = root / "events.parquet"
    nodes_path = root / "nodes.parquet"
    edges_path = root / "edges.parquet"
    stats_path = root / "graph_stats.json"

    for p in (events_path, nodes_path, edges_path):
        if not p.exists():
            raise FileNotFoundError(f"Required parquet file missing: {p}")

    events_table = pq.read_table(events_path)
    nodes_table = pq.read_table(nodes_path)
    edges_table = pq.read_table(edges_path)

    if validate:
        _validate_schema(events_table, EVENT_SCHEMA, "events")
        _validate_schema(nodes_table, NODE_SCHEMA, "nodes")
        _validate_schema(edges_table, EDGE_SCHEMA, "edges", optional=EDGE_OPTIONAL_COLUMNS)

    events = events_table.to_pandas()
    nodes = nodes_table.to_pandas()
    edges = edges_table.to_pandas()

    # Normalise dtypes for downstream code.
    events["ts"] = events["ts"].astype(float)
    edges["ts"] = edges["ts"].astype(float)
    nodes["first_seen_ts"] = nodes["first_seen_ts"].astype(float)
    nodes["last_seen_ts"] = nodes["last_seen_ts"].astype(float)

    if "label" in events.columns:
        events["label"] = events["label"].astype(int)
    if "label" in edges.columns:
        edges["label"] = edges["label"].astype(int)

    stats: Dict[str, Any] = {}
    if stats_path.exists():
        with open(stats_path, "r", encoding="utf-8") as f:
            stats = json.load(f)

    return TemporalGraphDataset(events, nodes, edges, stats)


def inspect_graph(data_dir: str | Path) -> Dict[str, Any]:
    """Convenience one-liner: load and return a summary dict."""
    ds = load_graph(data_dir)
    return ds.summary()
