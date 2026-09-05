#!/usr/bin/env python3
"""Build a temporal heterogeneous graph from raw logs.

Examples
--------
  python scripts/build_graph.py --dataset synthetic \
      --input data/raw/v6_ood_formal.jsonl --out data/processed --limit 100000

  python scripts/build_graph.py --dataset mordor \
      --input data/raw/mordor/.../scenario.json \
      --metadata-dir data/raw/mordor/Security-Datasets/datasets/atomic/_metadata \
      --out data/processed/mordor
"""

from __future__ import annotations

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graph_builder.attack_tracker import AttackTracker  # noqa: E402
from graph_builder.builder import StreamingGraphBuilder, TemporalGraphBuilder  # noqa: E402
from graph_builder.exporters import (  # noqa: E402
    GraphExporter,
    write_chain_subgraphs,
    write_chain_summary,
    write_stats,
)
from graph_builder.labeler import HeuristicLabeler  # noqa: E402
from graph_builder.normalizer import NormalizationStats, normalize_stream  # noqa: E402
from graph_builder.parsers import get_parser  # noqa: E402

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    def tqdm(it, **_kw):
        return it


def main() -> int:
    ap = argparse.ArgumentParser(description="TG-Detect graph builder")
    ap.add_argument("--dataset", required=True, help="parser key: synthetic | mordor")
    ap.add_argument("--input", required=True, help="input log file (.jsonl/.json/.gz/.zip)")
    ap.add_argument("--out", default="data/processed", help="processed output directory")
    ap.add_argument("--graphs-out", default="data/graphs", help="attack subgraph directory")
    ap.add_argument("--limit", type=int, default=None, help="stop after N raw events")
    ap.add_argument("--chunk-size", type=int, default=100_000, help="parquet flush cadence")
    ap.add_argument("--networkx", action="store_true",
                    help="also hold an in-memory MultiDiGraph (debug/small runs)")
    ap.add_argument("--strategies", default="chain_id,causal_parent,entity_time",
                    help="comma-separated attack tracking strategies, in priority order")
    ap.add_argument("--window", type=float, default=86400.0,
                    help="entity_time strategy window in seconds")
    ap.add_argument("--max-hops", type=int, default=2, help="entity_time expansion hops")
    ap.add_argument("--max-subgraphs", type=int, default=1000,
                    help="max attack subgraph JSON files to write (0 = none)")
    ap.add_argument("--metadata-dir", default=None,
                    help="Mordor _metadata directory for label/tactic ground truth")
    ap.add_argument("--source-tag", default=None, help="override source_tag")
    ap.add_argument("--label", type=int, default=None, choices=[0, 1],
                    help="force the label for every parsed event (0=benign, 1=malicious). "
                         "Use 0 for background/normal captures, 1 for attack captures.")
    ap.add_argument("--label-mode", default="parser",
                    choices=["parser", "force", "heuristic"],
                    help="parser = use dataset/metadata labels; force = use --label for all; "
                         "heuristic = derive labels from ATT&CK indicators (best for "
                         "compound/mixed captures)")
    ap.add_argument("--label-window", type=float, default=300.0,
                    help="heuristic mode: seconds to propagate a detection across "
                         "events sharing a host/user/process")
    ap.add_argument("--no-label-propagation", action="store_true",
                    help="heuristic mode: label only the exact indicator hits")
    args = ap.parse_args()

    if args.label_mode == "force" and args.label is None:
        print("ERROR: --label-mode force requires --label 0|1", file=sys.stderr)
        return 1


    if not os.path.exists(args.input):
        print(f"ERROR: input not found: {args.input}", file=sys.stderr)
        return 1

    parser_fn = get_parser(args.dataset)
    parser_kwargs = {"limit": args.limit}
    if args.dataset == "mordor":
        if args.metadata_dir:
            parser_kwargs["metadata_dir"] = args.metadata_dir
        if args.source_tag:
            parser_kwargs["source_tag"] = args.source_tag
        if args.label_mode == "force":
            parser_kwargs["label"] = args.label
        elif args.label_mode == "heuristic":
            parser_kwargs["label"] = 0  # start benign, indicators promote to 1
        elif args.label is not None:
            parser_kwargs["label"] = args.label

    print(f"[1/5] parsing   : {args.input}  (dataset={args.dataset}, "
          f"label_mode={args.label_mode})")
    raw_events = parser_fn(args.input, **parser_kwargs)

    norm_stats = NormalizationStats()
    builder = TemporalGraphBuilder() if args.networkx else StreamingGraphBuilder()
    tracker = AttackTracker(
        strategies=[s.strip() for s in args.strategies.split(",") if s.strip()],
        window_s=args.window,
        max_hops=args.max_hops,
    )
    exporter = GraphExporter(args.out, chunk_size=args.chunk_size)

    started = time.time()
    normalized = normalize_stream(raw_events, norm_stats)
    labeler = None
    if args.label_mode == "heuristic":
        labeler = HeuristicLabeler(
            window_s=args.label_window,
            propagate=not args.no_label_propagation,
        )
        normalized = labeler.process(normalized)

    pipeline = exporter.stream_events(
        tracker.observe_stream(builder.add_events(normalized))
    )


    print("[2/5] normalize + build + export (streaming)…")
    for _ in tqdm(pipeline, unit="evt", mininterval=1.0):
        pass
    exporter.close()

    print("[3/5] writing nodes.parquet…")
    num_nodes = exporter.write_nodes(builder.node_rows(), chunk_size=args.chunk_size)

    print("[4/5] reconstructing attack chains…")
    results = tracker.build_chains()
    all_chains = [c for chains in results.values() for c in chains]
    write_chain_summary(args.out, all_chains)
    subgraphs = 0
    if args.max_subgraphs:
        subgraphs = write_chain_subgraphs(args.graphs_out, all_chains, args.max_subgraphs)

    stats = {
        "dataset": args.dataset,
        "input": args.input,
        "elapsed_s": round(time.time() - started, 2),
        "normalization": norm_stats.as_dict(),
        "labeling": {"mode": args.label_mode,
                     **(labeler.stats.as_dict() if labeler else {})},
        "graph": builder.summary(),
        "attacks": tracker.summary(results),
        "outputs": {
            "events": os.path.join(args.out, "events.parquet"),
            "edges": os.path.join(args.out, "edges.parquet"),
            "nodes": os.path.join(args.out, "nodes.parquet"),
            "chains": os.path.join(args.out, "chains_summary.parquet"),
            "subgraphs_written": subgraphs,
        },
    }
    stats_path = write_stats(args.out, stats)

    graph = stats["graph"]
    print("[5/5] done")
    print(f"  events processed : {graph['total_events']:,}")
    print(f"  unique nodes     : {num_nodes:,}")
    print(f"  malicious/benign : {graph['malicious_events']:,} / {graph['benign_events']:,}")
    print(f"  attack chains    : {stats['attacks']['total_chains']:,}")
    if labeler:
        ls = labeler.stats.as_dict()
        print(f"  heuristic labels : {ls['malicious_events']:,} malicious "
              f"({ls['malicious_ratio']*100:.1f}%) from {ls['seed_indicator_hits']:,} indicator hits")
        for r, c in list(ls["top_reasons"].items())[:8]:
            print(f"      {r:<40} {c:,}")
    print(f"  rejected records : {norm_stats.rejected:,} {dict(norm_stats.reject_reasons)}")
    print(f"  stats written to : {stats_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
