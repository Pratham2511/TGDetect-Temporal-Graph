#!/usr/bin/env python3
"""Build temporal snapshots from a processed graph directory.

Example:
    python scripts/build_snapshots.py \
        --data data/processed/mordor_test \
        --window-size 60 \
        --stride 30 \
        --out data/snapshots/mordor_test
"""

from __future__ import annotations

import argparse
import json
import os
import pickle
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graph_builder.loader import load_graph
from graph_builder.temporal import SnapshotBuilder


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build temporal snapshots")
    parser.add_argument(
        "--data",
        type=Path,
        required=True,
        help="Processed graph directory",
    )
    parser.add_argument(
        "--out",
        type=Path,
        required=True,
        help="Output directory for snapshot pickles",
    )
    parser.add_argument(
        "--window-size",
        type=float,
        default=60.0,
        help="Snapshot window size in seconds",
    )
    parser.add_argument(
        "--stride",
        type=float,
        default=None,
        help="Stride between consecutive windows (default = window_size / 2)",
    )
    parser.add_argument(
        "--node-feature-mode",
        type=str,
        default="type_degree",
        choices=["type_degree", "type_only"],
        help="Node feature composition",
    )
    parser.add_argument(
        "--edge-feature-mode",
        type=str,
        default="relation_time",
        choices=["relation_time", "relation_only"],
        help="Edge feature composition",
    )
    parser.add_argument(
        "--max-snapshots",
        type=int,
        default=None,
        help="Stop after N snapshots (useful for large datasets)",
    )
    parser.add_argument(
        "--max-edges-per-snapshot",
        type=int,
        default=200_000,
        help="Truncate very dense windows to keep memory bounded",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    print(f"[1/3] loading graph from {args.data}")
    ds = load_graph(args.data)
    ds.print_summary()

    print(f"\n[2/3] building + writing snapshots (window={args.window_size}s, stride={args.stride or args.window_size/2}s)")
    builder = SnapshotBuilder(
        ds,
        window_size_s=args.window_size,
        stride_s=args.stride,
        node_feature_mode=args.node_feature_mode,
        edge_feature_mode=args.edge_feature_mode,
        max_snapshots=args.max_snapshots,
        max_edges_per_snapshot=args.max_edges_per_snapshot,
    )

    # Stream snapshots straight to disk: never hold them all in RAM.
    count = 0
    node_dim = 0
    edge_dim = 0
    for i, snap in enumerate(builder.iter_snapshots()):
        with open(args.out / f"snapshot_{i:06d}.pkl", "wb") as f:
            pickle.dump(snap.to_dict(), f)
        count += 1
        node_dim = int(snap.x.shape[1])
        edge_dim = int(snap.edge_attr.shape[1])
        if count % 250 == 0:
            print(f"  ... {count} snapshots written", flush=True)
    print(f"  -> {count} snapshots")

    print(f"\n[3/3] writing metadata to {args.out}")
    meta = {
        "source": str(args.data),
        "num_snapshots": count,
        "window_size_s": args.window_size,
        "stride_s": args.stride or args.window_size / 2,
        "node_feature_mode": args.node_feature_mode,
        "edge_feature_mode": args.edge_feature_mode,
        "node_feature_dim": node_dim,
        "edge_feature_dim": edge_dim,
        "num_node_types": len(ds.node_types),
        "num_relations": len(ds.relations),
        "node_type_map": ds.node_type_to_index,
        "relation_map": ds.relation_to_index,
    }
    with open(args.out / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print("\nDone. Metadata:")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
