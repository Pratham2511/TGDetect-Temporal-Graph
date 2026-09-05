#!/usr/bin/env python3
"""Inspect an unknown dataset (directory, .zip or .tar.gz) without full extraction.

Reports the file inventory, then samples records from candidate log files and
infers which fields hold timestamps, entities, event types and labels.

  python scripts/inspect_dataset.py ~/dataset.zip
  python scripts/inspect_dataset.py /path/to/dataset --max-files 15 --sample 200
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import os
import tarfile
import zipfile
from collections import Counter, defaultdict
from typing import Any, Dict, Iterator, List, Optional, Tuple

LOG_EXT = (".json", ".jsonl", ".csv", ".tsv", ".log", ".txt", ".gz", ".ndjson")

TS_HINTS = ("time", "ts", "date", "@timestamp", "utctime", "epoch", "created")
ENTITY_HINTS = ("user", "host", "computer", "ip", "addr", "process", "image", "file",
                "src", "dst", "source", "destination", "account", "domain", "guid", "pid")
ACTION_HINTS = ("event", "action", "type", "operation", "task", "opcode", "channel",
                "protocol", "relation", "cmd", "command")
LABEL_HINTS = ("label", "malicious", "attack", "is_attack", "class", "category",
               "ground_truth", "verdict", "tactic", "technique")


def human(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024 or unit == "TB":
            return f"{size:,.1f}{unit}"
        size /= 1024.0
    return f"{size}"


# ── inventory ──────────────────────────────────────────────────────────
def inventory(path: str) -> List[Tuple[str, int]]:
    entries: List[Tuple[str, int]] = []
    if os.path.isdir(path):
        for root, _dirs, files in os.walk(path):
            for name in files:
                full = os.path.join(root, name)
                try:
                    entries.append((os.path.relpath(full, path), os.path.getsize(full)))
                except OSError:
                    pass
    elif path.lower().endswith(".zip"):
        with zipfile.ZipFile(path) as zf:
            entries = [(i.filename, i.file_size) for i in zf.infolist() if not i.is_dir()]
    elif path.lower().endswith((".tar.gz", ".tgz", ".tar")):
        mode = "r:gz" if path.lower().endswith((".tar.gz", ".tgz")) else "r"
        with tarfile.open(path, mode) as tf:
            entries = [(m.name, m.size) for m in tf.getmembers() if m.isfile()]
    else:
        entries = [(path, os.path.getsize(path))]
    return entries


def open_member(container: str, member: str):
    """Return a binary file-like object for a member of dir/zip/tar."""
    if os.path.isdir(container):
        return open(os.path.join(container, member) if not os.path.isabs(member)
                    else member, "rb")
    if container.lower().endswith(".zip"):
        return zipfile.ZipFile(container).open(member)
    if container.lower().endswith((".tar.gz", ".tgz", ".tar")):
        mode = "r:gz" if container.lower().endswith((".tar.gz", ".tgz")) else "r"
        tf = tarfile.open(container, mode)
        fh = tf.extractfile(member)
        if fh is None:
            raise FileNotFoundError(member)
        return fh
    return open(container, "rb")


def sample_lines(container: str, member: str, n: int) -> List[str]:
    lines: List[str] = []
    raw = open_member(container, member)
    try:
        stream = gzip.GzipFile(fileobj=raw) if member.lower().endswith(".gz") else raw
        text = io.TextIOWrapper(stream, encoding="utf-8", errors="replace")
        for i, line in enumerate(text):
            if i >= n:
                break
            line = line.strip()
            if line:
                lines.append(line)
    finally:
        try:
            raw.close()
        except Exception:
            pass
    return lines


# ── field analysis ─────────────────────────────────────────────────────
def flatten(obj: Any, prefix: str = "") -> Iterator[Tuple[str, Any]]:
    if isinstance(obj, dict):
        for key, value in obj.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            if isinstance(value, (dict,)):
                yield from flatten(value, path)
            else:
                yield path, value
    else:
        yield prefix, obj


def classify(field: str) -> List[str]:
    low = field.lower()
    tags = []
    if any(h in low for h in TS_HINTS):
        tags.append("TIMESTAMP?")
    if any(h in low for h in ENTITY_HINTS):
        tags.append("ENTITY?")
    if any(h in low for h in ACTION_HINTS):
        tags.append("ACTION?")
    if any(h in low for h in LABEL_HINTS):
        tags.append("LABEL?")
    return tags


def analyze_records(records: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    fields: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"count": 0, "types": Counter(), "examples": []}
    )
    for record in records:
        for key, value in flatten(record):
            info = fields[key]
            info["count"] += 1
            info["types"][type(value).__name__] += 1
            if value not in (None, "", "-") and len(info["examples"]) < 3:
                text = str(value)
                info["examples"].append(text[:70])
    return fields


def report_file(container: str, member: str, sample: int) -> None:
    print(f"\n── {member}")
    try:
        lines = sample_lines(container, member, sample)
    except Exception as exc:
        print(f"   (unreadable: {exc})")
        return
    if not lines:
        print("   (empty)")
        return

    records: List[Dict[str, Any]] = []
    fmt = "unknown"
    if lines[0].lstrip().startswith(("{", "[")):
        fmt = "json-lines"
        for line in lines:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                records.append(obj)
            elif isinstance(obj, list):
                records.extend(x for x in obj if isinstance(x, dict))
    else:
        delimiter = "\t" if "\t" in lines[0] and lines[0].count("\t") > lines[0].count(",") else ","
        fmt = f"delimited('{delimiter}')"
        reader = csv.DictReader(lines, delimiter=delimiter)
        for row in reader:
            records.append(dict(row))

    print(f"   format: {fmt}   sampled records: {len(records)}")
    if not records:
        print(f"   first line: {lines[0][:200]}")
        return

    fields = analyze_records(records)
    print(f"   fields ({len(fields)}):")
    for name, info in sorted(fields.items(), key=lambda kv: -kv[1]["count"])[:60]:
        tags = " ".join(classify(name))
        types = ",".join(sorted(info["types"]))
        example = info["examples"][0] if info["examples"] else ""
        coverage = f"{info['count']}/{len(records)}"
        print(f"     {name:<42} {coverage:>9}  {types:<12} {tags:<28} e.g. {example}")

    for role, hints in (("timestamp", TS_HINTS), ("entity", ENTITY_HINTS),
                        ("action", ACTION_HINTS), ("label", LABEL_HINTS)):
        matches = [f for f in fields if any(h in f.lower() for h in hints)]
        print(f"   {role:<10} candidates: {matches[:12] if matches else 'NONE FOUND'}")


def main() -> int:
    ap = argparse.ArgumentParser(description="TG-Detect dataset inspector")
    ap.add_argument("path", help="directory, .zip, .tar.gz or single file")
    ap.add_argument("--sample", type=int, default=100, help="records sampled per file")
    ap.add_argument("--max-files", type=int, default=8, help="how many log files to profile")
    ap.add_argument("--filter", default=None, help="only profile members containing this string")
    args = ap.parse_args()

    entries = inventory(args.path)
    total = sum(size for _n, size in entries)
    print("=" * 100)
    print(f"DATASET: {args.path}")
    print(f"files: {len(entries):,}   uncompressed total: {human(total)}")
    print("=" * 100)

    by_ext: Counter = Counter()
    ext_bytes: Counter = Counter()
    for name, size in entries:
        ext = os.path.splitext(name)[1].lower() or "(none)"
        by_ext[ext] += 1
        ext_bytes[ext] += size
    print("\nBY EXTENSION")
    for ext, count in by_ext.most_common(20):
        print(f"  {ext:<12} {count:>8,} files   {human(ext_bytes[ext]):>12}")

    print("\nLARGEST FILES")
    for name, size in sorted(entries, key=lambda kv: -kv[1])[:20]:
        print(f"  {human(size):>12}  {name}")

    candidates = [
        (n, s) for n, s in entries
        if n.lower().endswith(LOG_EXT) and s > 0
        and (args.filter is None or args.filter in n)
    ]
    candidates.sort(key=lambda kv: -kv[1])

    print(f"\nPROFILING TOP {min(args.max_files, len(candidates))} LOG FILES")
    for name, _size in candidates[: args.max_files]:
        report_file(args.path, name, args.sample)

    print("\nNEXT: use the reported timestamp/entity/action/label fields to write or "
          "adjust the parser in graph_builder/parsers.py, then run scripts/build_graph.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
