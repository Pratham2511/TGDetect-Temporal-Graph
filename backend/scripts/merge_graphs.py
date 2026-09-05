#!/usr/bin/env python3
"""Merge several processed graph directories into one training-ready graph.

Use this to combine an attack capture (label=1) with a benign capture (label=0)
so the TGNN actually has two classes to learn from.

Example
-------
  python scripts/merge_graphs.py \
      --inputs data/processed/mordor_full data/processed/mordor_benign \
      --out data/processed/mordor_mixed

Node degrees and malicious counts are recomputed from the merged edge table,
so the output directory is a valid input for build_snapshots.py.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd  # noqa: E402
import pyarrow as pa  # noqa: E402
import pyarrow.parquet as pq  # noqa: E402

from graph_builder.schema import EDGE_SCHEMA, EVENT_SCHEMA, NODE_SCHEMA  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Merge processed TG-Detect graphs")
    p.add_argument("--inputs", nargs="+", required=True, help="processed graph directories")
    p.add_argument("--out", type=Path, required=True, help="merged output directory")
    p.add_argument("--labels", nargs="*", type=int, default=None,
                   help="optional per-input label override (0/1), same order as --inputs")
    p.add_argument("--rebase-time", action="store_true",
                   help="shift each input so their timelines interleave from t=0 "
                        "(useful when captures come from different years)")
    return p.parse_args()


def _read(d: Path, name: str) -> pd.DataFrame:
    path = d / name
    if not path.exists():
        raise FileNotFoundError(f"missing {path}")
    return pq.read_table(path).to_pandas()


def main() -> None:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    dirs = [Path(d) for d in args.inputs]
    if args.labels and len(args.labels) != len(dirs):
        raise SystemExit("--labels must have the same length as --inputs")

    all_events, all_edges = [], []
    for i, d in enumerate(dirs):
        ev = _read(d, "events.parquet")
        ed = _read(d, "edges.parquet")
        tag = d.name
        if args.labels:
            lab = int(args.labels[i])
            ev["label"] = lab
            ed["label"] = lab
        if args.rebase_time:
            t0 = min(ev["ts"].min(), ed["ts"].min())
            ev["ts"] = ev["ts"] - t0
            ed["ts"] = ed["ts"] - t0
        # keep ids unique across sources
        for df in (ev, ed):
            df["event_id"] = tag + ":" + df["event_id"].astype(str)
            if "chain_id" in df.columns:
                df["chain_id"] = df["chain_id"].where(
                    df["chain_id"].isna(), tag + ":" + df["chain_id"].astype(str))
        if "source_tag" in ev.columns:
            ev["source_tag"] = ev["source_tag"].replace("", tag).fillna(tag)
            ed["source_tag"] = ed["source_tag"].replace("", tag).fillna(tag)
        print(f"  {d}: {len(ev):,} events  malicious={int(ev['label'].sum()):,}")
        all_events.append(ev)
        all_edges.append(ed)

    events = pd.concat(all_events, ignore_index=True).sort_values("ts").reset_index(drop=True)
    edges = pd.concat(all_edges, ignore_index=True).sort_values("ts").reset_index(drop=True)

    # Recompute the node table from the merged edges.
    src = events[["src_id", "src_type", "ts", "label"]].rename(
        columns={"src_id": "node_id", "src_type": "node_type"})
    dst = events[["dst_id", "dst_type", "ts", "label"]].rename(
        columns={"dst_id": "node_id", "dst_type": "node_type"})
    endpoints = pd.concat([src, dst], ignore_index=True)
    grouped = endpoints.groupby("node_id").agg(
        node_type=("node_type", "first"),
        first_seen_ts=("ts", "min"),
        last_seen_ts=("ts", "max"),
        malicious_events=("label", "sum"),
    ).reset_index()
    out_deg = events.groupby("src_id").size().rename("out_degree")
    in_deg = events.groupby("dst_id").size().rename("in_degree")
    nodes = (grouped.set_index("node_id")
             .join(out_deg).join(in_deg).fillna(0).reset_index())
    nodes["out_degree"] = nodes["out_degree"].astype("int64")
    nodes["in_degree"] = nodes["in_degree"].astype("int64")
    nodes["malicious_events"] = nodes["malicious_events"].astype("int64")
    nodes = nodes[[f.name for f in NODE_SCHEMA]]

    events["label"] = events["label"].astype("int8")
    edges["label"] = edges["label"].astype("int8")

    pq.write_table(pa.Table.from_pandas(events[[f.name for f in EVENT_SCHEMA]],
                                        schema=EVENT_SCHEMA, preserve_index=False),
                   args.out / "events.parquet", compression="snappy")
    pq.write_table(pa.Table.from_pandas(edges[[f.name for f in EDGE_SCHEMA]],
                                        schema=EDGE_SCHEMA, preserve_index=False),
                   args.out / "edges.parquet", compression="snappy")
    pq.write_table(pa.Table.from_pandas(nodes, schema=NODE_SCHEMA, preserve_index=False),
                   args.out / "nodes.parquet", compression="snappy")

    stats = {
        "merged_from": [str(d) for d in dirs],
        "num_events": int(len(events)),
        "num_edges": int(len(edges)),
        "num_nodes": int(len(nodes)),
        "malicious_events": int((events["label"] == 1).sum()),
        "benign_events": int((events["label"] == 0).sum()),
        "temporal_span_s": float(events["ts"].max() - events["ts"].min()),
    }
    with open(args.out / "graph_stats.json", "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

    print("\nMerged graph written to", args.out)
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
