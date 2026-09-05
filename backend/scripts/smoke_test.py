#!/usr/bin/env python3
"""End-to-end smoke test for the graph construction + snapshot pipeline.

Generates a tiny synthetic graph, runs it through the loader and snapshot
builder, and asserts that output shapes are sane. This script does NOT
require PyTorch / PyTorch Geometric.

Example:
    python scripts/smoke_test.py
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graph_builder.builder import StreamingGraphBuilder
from graph_builder.exporters import GraphExporter, write_stats
from graph_builder.loader import load_graph
from graph_builder.schema import TGEvent
from graph_builder.temporal import SnapshotBuilder


def generate_events(num_events: int = 500) -> list[TGEvent]:
    """Generate a tiny synthetic stream with a recurring attack chain."""
    events = []
    base_ts = 1_700_000_000.0
    for i in range(num_events):
        ts = base_ts + i
        if i % 50 == 0:
            e = TGEvent(
                event_id=f"evt-{i}",
                ts=ts,
                src_id="host-A",
                src_type="HOST",
                dst_id="process-p",
                dst_type="PROCESS",
                relation="EXECUTES",
                label=1,
                tactics=["execution"],
                apt_stage="execution",
                source_tag="smoke",
                chain_id="chain-1",
                causal_parent=None,
                attrs={"pid": i},
            )
        else:
            e = TGEvent(
                event_id=f"evt-{i}",
                ts=ts,
                src_id=f"host-{i % 5}",
                src_type="HOST",
                dst_id=f"process-{i % 10}",
                dst_type="PROCESS",
                relation="LOGON" if i % 3 == 0 else "NETWORK_FLOW",
                label=0,
                tactics=[],
                source_tag="smoke",
                chain_id=None,
                causal_parent=None,
                attrs={"pid": i},
            )
        events.append(e)
    return events


def main() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)

        print("[1/4] generating synthetic events")
        events = generate_events(500)

        print("[2/4] building graph and writing parquet")
        builder = StreamingGraphBuilder()
        exporter = GraphExporter(str(root), write_edges=True)
        for event in exporter.stream_events(builder.add_events(events)):
            pass
        exporter.write_nodes(builder.node_rows())
        exporter.close()
        write_stats(str(root), builder.summary())

        print("[3/4] loading graph")
        ds = load_graph(root)
        ds.print_summary()

        assert ds.num_events == 500
        assert ds.num_nodes > 0
        assert ds.num_edges == 500
        print("  -> loader assertions passed")

        print("[4/4] building temporal snapshots")
        snap_builder = SnapshotBuilder(ds, window_size_s=30.0, stride_s=15.0)
        snapshots = snap_builder.build_all()
        assert len(snapshots) > 0
        snap = snapshots[0]
        assert snap.x.shape[0] == len(snap.node_ids)
        assert snap.edge_index.shape[1] == snap.num_events
        assert snap.edge_attr.shape[0] == snap.num_events
        print(f"  -> {len(snapshots)} snapshots generated")
        print("  -> snapshot assertions passed")

    print("\nSmoke test passed.")


if __name__ == "__main__":
    main()
