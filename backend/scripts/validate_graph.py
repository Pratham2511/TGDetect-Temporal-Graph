#!/usr/bin/env python3
"""Validate the processed graph tables and print the full statistics report.

  python scripts/validate_graph.py --processed data/processed
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter

import pyarrow.parquet as pq

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def fmt_ts(value):
    if value is None:
        return "n/a"
    import datetime as dt

    try:
        iso = dt.datetime.fromtimestamp(value, dt.timezone.utc).isoformat()
        return f"{value:.3f} ({iso})"
    except (OverflowError, OSError, ValueError):
        return str(value)


def main() -> int:
    ap = argparse.ArgumentParser(description="TG-Detect graph validator")
    ap.add_argument("--processed", default="data/processed")
    ap.add_argument("--batch-size", type=int, default=100_000)
    ap.add_argument("--track-duplicates", action="store_true",
                    help="keep all event_ids in memory to detect duplicates exactly")
    args = ap.parse_args()

    events_path = os.path.join(args.processed, "events.parquet")
    nodes_path = os.path.join(args.processed, "nodes.parquet")
    chains_path = os.path.join(args.processed, "chains_summary.parquet")

    if not os.path.exists(events_path):
        print(f"ERROR: {events_path} not found. Run scripts/build_graph.py first.",
              file=sys.stderr)
        return 1

    total = 0
    labels = Counter()
    relations = Counter()
    src_types = Counter()
    dst_types = Counter()
    source_tags = Counter()
    min_ts = max_ts = None
    prev_ts = None
    out_of_order = 0
    bad_ts = 0
    empty_endpoints = 0
    unknown_types = 0
    missing_ids = 0
    event_ids: set[str] = set()
    duplicates = 0
    chain_ids = Counter()
    causal_children = 0
    causal_parents_seen: set[str] = set()

    pf = pq.ParquetFile(events_path)
    for batch in pf.iter_batches(batch_size=args.batch_size):
        cols = batch.to_pydict()
        for i in range(batch.num_rows):
            total += 1
            eid = cols["event_id"][i]
            ts = cols["ts"][i]
            src, dst = cols["src_id"][i], cols["dst_id"][i]
            st, dt_ = cols["src_type"][i], cols["dst_type"][i]

            if not eid:
                missing_ids += 1
            elif args.track_duplicates:
                if eid in event_ids:
                    duplicates += 1
                else:
                    event_ids.add(eid)

            if ts is None:
                bad_ts += 1
            else:
                min_ts = ts if min_ts is None else min(min_ts, ts)
                max_ts = ts if max_ts is None else max(max_ts, ts)
                if prev_ts is not None and ts < prev_ts:
                    out_of_order += 1
                prev_ts = ts

            if not src or not dst:
                empty_endpoints += 1
            if st == "UNKNOWN":
                unknown_types += 1
            if dt_ == "UNKNOWN":
                unknown_types += 1

            labels[int(cols["label"][i] or 0)] += 1
            relations[cols["relation"][i]] += 1
            src_types[st] += 1
            dst_types[dt_] += 1
            source_tags[cols["source_tag"][i]] += 1

            cid = cols["chain_id"][i]
            if cid:
                chain_ids[cid] += 1
            parent = cols["causal_parent"][i]
            if parent:
                causal_children += 1
                causal_parents_seen.add(parent)

    node_types = Counter()
    total_nodes = 0
    if os.path.exists(nodes_path):
        npf = pq.ParquetFile(nodes_path)
        for batch in npf.iter_batches(batch_size=args.batch_size):
            cols = batch.to_pydict()
            total_nodes += batch.num_rows
            for t in cols["node_type"]:
                node_types[t] += 1

    print("=" * 78)
    print("  TG-Detect — TEMPORAL HETEROGENEOUS GRAPH VALIDATION")
    print("=" * 78)
    print(f"Total events processed : {total:,}")
    print(f"Total unique nodes     : {total_nodes:,}")
    print(f"Total edges            : {total:,}")
    print(f"Benign events          : {labels[0]:,}")
    print(f"Malicious events       : {labels[1]:,}")
    ratio = (labels[1] / total * 100) if total else 0.0
    print(f"Malicious ratio        : {ratio:.4f}%")

    print("\nNODE TYPES")
    for t, c in node_types.most_common():
        print(f"  {t:<12} {c:>12,}")

    print("\nRELATION TYPES")
    for r, c in relations.most_common():
        print(f"  {r:<22} {c:>12,}")

    print("\nENDPOINT TYPE USAGE")
    for name, counter in (("src", src_types), ("dst", dst_types)):
        rendered = ", ".join(f"{t}={c:,}" for t, c in counter.most_common())
        print(f"  {name}: {rendered}")

    print("\nSOURCE TAGS")
    for tag, c in source_tags.most_common(15):
        print(f"  {tag:<28} {c:>12,}")

    print("\nTIMESTAMPS")
    print(f"  earliest : {fmt_ts(min_ts)}")
    print(f"  latest   : {fmt_ts(max_ts)}")
    if min_ts is not None and max_ts is not None:
        span = max_ts - min_ts
        print(f"  span     : {span:,.1f}s ({span / 86400.0:.2f} days)")
    print(f"  out-of-order rows (file order) : {out_of_order:,}")

    print("\nATTACK CHAINS")
    print(f"  distinct chain_id values : {len(chain_ids):,}")
    if chain_ids:
        sizes = sorted(chain_ids.values())
        print(f"  events per chain  min/median/max : "
              f"{sizes[0]} / {sizes[len(sizes) // 2]} / {sizes[-1]}")
        hist = Counter(sizes)
        print(f"  size histogram : {dict(sorted(hist.items())[:15])}")
    print(f"  events with causal_parent : {causal_children:,}")

    if os.path.exists(chains_path):
        ct = pq.read_table(chains_path).to_pydict()
        by_strategy = Counter(ct.get("strategy", []))
        print(f"  reconstructed chains : {len(ct.get('chain_id', [])):,} "
              f"{dict(by_strategy)}")

    dangling = 0
    if args.track_duplicates and causal_parents_seen:
        dangling = len(causal_parents_seen - event_ids)

    print("\nINTEGRITY CHECKS")
    checks = [
        ("missing event_id", missing_ids),
        ("unparseable / null timestamps", bad_ts),
        ("empty src or dst id", empty_endpoints),
        ("UNKNOWN endpoint types", unknown_types),
        ("duplicate event_ids", duplicates if args.track_duplicates else "not checked"),
        ("dangling causal_parent refs", dangling if args.track_duplicates else "not checked"),
        ("singleton chain_id groups", sum(1 for v in chain_ids.values() if v == 1)),
    ]
    failed = 0
    for name, value in checks:
        if isinstance(value, int):
            status = "OK  " if value == 0 else "WARN"
            if value != 0 and name in ("missing event_id", "unparseable / null timestamps",
                                       "empty src or dst id", "duplicate event_ids"):
                status = "FAIL"
                failed += 1
            print(f"  [{status}] {name:<34} {value:,}")
        else:
            print(f"  [SKIP] {name:<34} {value}")

    stats_path = os.path.join(args.processed, "graph_stats.json")
    if os.path.exists(stats_path):
        with open(stats_path, encoding="utf-8") as fh:
            stats = json.load(fh)
        print("\nBUILD STATS (graph_stats.json)")
        print(f"  normalization : {stats.get('normalization')}")
        print(f"  attacks       : {stats.get('attacks')}")

    print("\n" + ("VALIDATION PASSED" if failed == 0 else f"VALIDATION FAILED ({failed} checks)"))
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
