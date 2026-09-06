#!/usr/bin/env python3
"""Evaluate a trained TGNN checkpoint on the SAME partition it was trained with.

Instead of re-deriving a split (which silently disagreed with training), this
loads the split manifest saved in the checkpoint and reconstructs the exact
train/val/test partition. Reports imbalance-aware, per-scenario metrics
(PR-AUC + recall@fixed-FPR) which are the meaningful numbers for CTU-13.

Example:
    python scripts/evaluate_tgnn.py \
        --checkpoint models/checkpoints/ctu13_c52/best_model.pt \
        --snapshots data/snapshots/ctu13_c52 \
        --out results/ctu13_c52
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import torch
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "Evaluation requires the ML dependencies. "
        "Install them with: pip install -r requirements-ml.txt"
    ) from exc

from models.tgnn import TemporalGNN

# Reuse the exact sequence/metric machinery training used, so the two agree.
import train_tgnn  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate a trained TGNN")
    parser.add_argument("--checkpoint", type=Path, required=True,
                        help="Path to best_model.pt")
    parser.add_argument("--snapshots", type=Path, default=None,
                        help="Single snapshot dir (single-dir checkpoints). "
                             "Defaults to the path saved in the manifest.")
    parser.add_argument("--snapshots-root", type=Path, default=None,
                        help="Parent dir of per-scenario snapshot subdirs "
                             "(scenario-held-out checkpoints).")
    parser.add_argument("--out", "--out-dir", dest="out", type=Path, required=True,
                        help="Output directory for predictions and metrics")
    parser.add_argument("--split", type=str, default="test",
                        choices=["train", "val", "test"],
                        help="Which partition to evaluate (single-dir only; "
                             "scenario checkpoints always score the held-out "
                             "test scenarios)")
    parser.add_argument("--threshold", type=float, default=None,
                        help="Decision threshold (defaults to the checkpoint's)")
    return parser.parse_args()


def load_model(checkpoint: Dict[str, Any], meta: Dict[str, Any]) -> TemporalGNN:
    a = checkpoint.get("args", {})
    model = TemporalGNN(
        in_channels=meta["node_feature_dim"],
        edge_dim=meta["edge_feature_dim"],
        hidden_channels=int(a.get("hidden_channels", 64)),
        out_channels=int(a.get("out_channels", 64)),
        num_gnn_layers=int(a.get("gnn_layers", 2)),
        num_rnn_layers=int(a.get("rnn_layers", 1)),
        dropout=float(a.get("dropout", 0.3)),
        node_types=meta["num_node_types"],
        num_relations=meta["num_relations"],
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    return model


def reconstruct_eval_sequences(
    manifest: Dict[str, Any], args: argparse.Namespace
) -> List[List[Dict[str, Any]]]:
    """Rebuild the requested partition exactly as training defined it."""
    window = int(manifest.get("window_size", 10))
    stride = int(manifest.get("seq_stride", 1))
    kind = manifest.get("kind", "single")

    if kind == "scenario":
        root = args.snapshots_root
        if root is None:
            raise SystemExit(
                "This checkpoint used a scenario-held-out split; pass "
                "--snapshots-root <parent dir of scenario subdirs>."
            )
        names = (manifest["test_scenarios"] if args.split == "test"
                 else manifest["train_scenarios"])
        seqs: List[List[Dict[str, Any]]] = []
        for name in names:
            s, _m, _sid = train_tgnn.load_scenario_sequences(root / name, window, stride)
            seqs.extend(s)
        print(f"  scenario split={args.split} scenarios={names} sequences={len(seqs)}")
        return seqs

    # single-dir: rebuild + apply the saved split, then pick the partition.
    snaps_dir = args.snapshots or Path(manifest.get("snapshots", ""))
    snapshots, _meta = train_tgnn.load_snapshots(snaps_dir)
    sequences = train_tgnn.build_sequences(snapshots, window, stride)
    if manifest.get("split_mode", "block") == "block":
        tr, va, te = train_tgnn.split_by_block(
            sequences, manifest.get("val_ratio", 0.15),
            manifest.get("test_ratio", 0.15), manifest.get("block_size", 10))
    else:
        tr, va, te = train_tgnn.split_by_time(
            sequences, manifest.get("val_ratio", 0.15), manifest.get("test_ratio", 0.15))
    part = {"train": tr, "val": va, "test": te}[args.split]
    print(f"  single-dir split={args.split} sequences={len(part)} (of {len(sequences)})")
    return part


def main() -> None:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    device = torch.device("cpu")

    print(f"[1/3] loading checkpoint from {args.checkpoint}")
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    meta = checkpoint["meta"]
    target = checkpoint.get("target", "node")
    manifest = checkpoint.get("split_manifest", {"kind": "single",
                                                 "window_size": int(checkpoint.get("args", {}).get("window_size", 10)),
                                                 "seq_stride": 1})
    model = load_model(checkpoint, meta).to(device)
    print(f"  target={target}  split_kind={manifest.get('kind')}")

    print("[2/3] reconstructing evaluation partition")
    eval_seq = reconstruct_eval_sequences(manifest, args)
    if not eval_seq:
        raise SystemExit("empty evaluation partition")

    thr = args.threshold if args.threshold is not None else float(checkpoint.get("threshold", 0.5))
    print(f"[3/3] evaluating ({target}) @ threshold {thr:.3f}")
    y_true, y_prob, scen = train_tgnn.predict(model, eval_seq, target, device)

    overall = train_tgnn.scored_metrics(y_true, y_prob, thr)
    overall["threshold"] = thr  # saved (checkpoint) threshold, kept for the plot's degeneracy check
    per_scenario: Dict[str, Any] = {}
    for sid in sorted(set(scen.tolist())):
        m = scen == sid
        per_scenario[sid] = train_tgnn.scored_metrics(y_true[m], y_prob[m], thr)

    metrics = {"target": target, "split": args.split,
               "overall": overall, "per_scenario": per_scenario}
    print("\nMetrics:")
    print(json.dumps(metrics, indent=2))

    # Headline f1/precision/recall/accuracy are reported at the best-F1 operating
    # point; label the saved parquet predictions there too so they agree.
    op_thr = float(overall.get("threshold_best", thr))
    predictions = pd.DataFrame({
        "scenario": scen.astype(str),
        "probability": y_prob,
        "prediction": (y_prob >= op_thr).astype(int),
        "ground_truth": y_true,
    })
    predictions.to_parquet(args.out / f"predictions_{args.split}.parquet", index=False)
    with open(args.out / f"metrics_{args.split}.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nPredictions saved to {args.out / f'predictions_{args.split}.parquet'}")
    print(f"Metrics saved to {args.out / f'metrics_{args.split}.json'}")


if __name__ == "__main__":
    main()
