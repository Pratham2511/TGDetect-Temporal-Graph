#!/usr/bin/env python3
"""CLI to load and inspect a processed TG-Detect graph directory.

Example:
    python scripts/load_graph.py --data data/processed/mordor_test --inspect
    python scripts/load_graph.py --data data/processed/mordor_test --head 5
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graph_builder.loader import TemporalGraphDataset, load_graph


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load and inspect a TG-Detect graph")
    parser.add_argument(
        "--data",
        type=Path,
        required=True,
        help="Directory containing events.parquet, nodes.parquet, edges.parquet",
    )
    parser.add_argument(
        "--inspect",
        action="store_true",
        help="Print a human-readable summary of the graph",
    )
    parser.add_argument(
        "--head",
        type=int,
        default=0,
        help="Print the first N rows of events, nodes, and edges",
    )
    parser.add_argument(
        "--json-summary",
        type=Path,
        default=None,
        help="Write the summary JSON to this file",
    )
    parser.add_argument(
        "--no-validate",
        action="store_true",
        help="Skip schema validation",
    )
    return parser.parse_args()


def print_head(ds: TemporalGraphDataset, n: int) -> None:
    print("\n--- EVENTS (first %d) ---" % n)
    print(ds.events.head(n).to_string(index=False))
    print("\n--- NODES (first %d) ---" % n)
    print(ds.nodes.head(n).to_string(index=False))
    print("\n--- EDGES (first %d) ---" % n)
    print(ds.edges.head(n).to_string(index=False))


def main() -> None:
    args = parse_args()

    ds = load_graph(args.data, validate=not args.no_validate)

    if args.inspect:
        ds.print_summary()

    if args.head and args.head > 0:
        print_head(ds, args.head)

    if args.json_summary:
        summary = ds.summary()
        # Make Counter / pandas objects JSON serialisable.
        summary = json.loads(json.dumps(summary, default=str))
        with open(args.json_summary, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        print(f"\nSummary written to {args.json_summary}")

    # If no explicit action, at least print the summary.
    if not args.inspect and not args.head and not args.json_summary:
        ds.print_summary()


if __name__ == "__main__":
    main()
