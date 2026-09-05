#!/usr/bin/env python3
"""Evaluate a trained TGNN checkpoint and save predictions.

Example:
    python scripts/evaluate_tgnn.py \
        --checkpoint models/checkpoints/mordor_test/best_model.pt \
        --snapshots data/snapshots/mordor_test \
        --out results/mordor_test
"""

from __future__ import annotations

import argparse
import json
import os
import pickle
import sys
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import torch
    import torch.nn as nn
    from sklearn.metrics import (
        accuracy_score,
        average_precision_score,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "Evaluation requires the ML dependencies. "
        "Install them with: pip install -r requirements-ml.txt"
    ) from exc

from models.tgnn import TemporalGNN


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate a trained TGNN")
    parser.add_argument(
        "--checkpoint",
        type=Path,
        required=True,
        help="Path to best_model.pt or final_model.pt",
    )
    parser.add_argument(
        "--snapshots",
        type=Path,
        required=True,
        help="Directory containing snapshots used during training",
    )
    parser.add_argument(
        "--out",
        "--out-dir",
        dest="out",
        type=Path,
        required=True,
        help="Output directory for predictions and metrics",
    )
    parser.add_argument(
        "--split",
        type=str,
        default="test",
        choices=["train", "val", "test"],
        help="Which time-split partition to evaluate",
    )
    parser.add_argument(
        "--window-size",
        type=int,
        default=None,
        help="Override window size (defaults to checkpoint value)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Decision threshold (defaults to the tuned value in the checkpoint, else 0.5)",
    )
    return parser.parse_args()


def load_snapshots(snapshots_dir: Path) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    files = sorted(snapshots_dir.glob("snapshot_*.pkl"))
    snapshots = []
    for f in files:
        with open(f, "rb") as fh:
            snapshots.append(pickle.load(fh))
    with open(snapshots_dir / "meta.json", "r", encoding="utf-8") as fh:
        meta = json.load(fh)
    return snapshots, meta


def build_sequences(
    snapshots: List[Dict[str, Any]], window_size: int
) -> List[List[Dict[str, Any]]]:
    return [snapshots[i : i + window_size] for i in range(len(snapshots) - window_size + 1)]


def split_by_time(
    sequences: List[List[Dict[str, Any]]],
    val_ratio: float,
    test_ratio: float,
) -> tuple[List[List[Dict[str, Any]]], List[List[Dict[str, Any]]], List[List[Dict[str, Any]]]]:
    n = len(sequences)
    test_end = int(n * (1 - test_ratio))
    val_end = int(test_end * (1 - val_ratio))
    return sequences[:val_end], sequences[val_end:test_end], sequences[test_end:]


def load_model(
    checkpoint_path: Path, meta: Dict[str, Any], args: argparse.Namespace
) -> tuple[TemporalGNN, int, Dict[str, Any]]:
    # PyTorch 2.6 defaults to weights_only=True, but existing checkpoints may
    # contain pathlib objects saved from vars(args). Use weights_only=False for
    # checkpoints produced by this project.
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    saved_args = checkpoint.get("args", {})

    window_size = args.window_size or saved_args.get("window_size", 10)
    model = TemporalGNN(
        in_channels=meta["node_feature_dim"],
        edge_dim=meta["edge_feature_dim"],
        hidden_channels=saved_args.get("hidden_channels", 64),
        out_channels=saved_args.get("out_channels", 64),
        num_gnn_layers=saved_args.get("gnn_layers", 2),
        num_rnn_layers=saved_args.get("rnn_layers", 1),
        dropout=saved_args.get("dropout", 0.3),
        node_types=meta["num_node_types"],
        num_relations=meta["num_relations"],
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    return model, window_size, checkpoint


def evaluate(
    model: TemporalGNN,
    sequences: List[List[Dict[str, Any]]],
    threshold: float = 0.5,
) -> Dict[str, Any]:
    model.eval()
    all_probs = []
    all_labels = []
    records = []

    with torch.no_grad():
        for seq_idx, seq in enumerate(sequences):
            node_logits, snapshot_logit = model(seq)
            probs = torch.sigmoid(node_logits).cpu().numpy().ravel()
            labels = seq[-1]["node_labels"]
            node_ids = seq[-1]["node_ids"]
            snapshot_label = seq[-1]["snapshot_label"]

            all_probs.extend(probs.tolist())
            all_labels.extend(labels.tolist())

            for nid, prob, label in zip(node_ids, probs, labels):
                records.append(
                    {
                        "sequence": seq_idx,
                        "node_id": nid,
                        "probability": float(prob),
                        "prediction": int(prob >= threshold),
                        "ground_truth": int(label),
                        "snapshot_label": int(snapshot_label),
                    }
                )

    y_true = np.array(all_labels, dtype=np.int64)
    y_prob = np.array(all_probs, dtype=np.float32)
    y_pred = (y_prob >= threshold).astype(np.int64)

    metrics: Dict[str, Any] = {
        "threshold": float(threshold),
        "num_samples": int(len(y_true)),
        "num_positive": int(y_true.sum()),
        "num_negative": int((y_true == 0).sum()),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
    }

    if len(np.unique(y_true)) > 1:
        metrics["auc_roc"] = float(roc_auc_score(y_true, y_prob))
        metrics["auc_pr"] = float(average_precision_score(y_true, y_prob))
    else:
        metrics["auc_roc"] = None
        metrics["auc_pr"] = None

    metrics["confusion_matrix"] = confusion_matrix(y_true, y_pred).tolist()

    return metrics, pd.DataFrame(records)


def chain_level_metrics(predictions: pd.DataFrame, dataset: pd.DataFrame) -> Dict[str, Any]:
    """Placeholder for chain-level metrics once chain_id is joined back.

    The snapshot pickle currently stores node_ids but not chain_id. A future
    enhancement is to propagate chain_id into snapshots and compute per-chain
    detection rate here.
    """
    return {"note": "chain-level metrics require chain_id in snapshot metadata"}


def main() -> None:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    print(f"[1/3] loading checkpoint from {args.checkpoint}")
    snapshots, meta = load_snapshots(args.snapshots)
    model, window_size, checkpoint = load_model(args.checkpoint, meta, args)
    print(f"  -> window_size={window_size}")

    print("[2/3] building sequences")
    sequences = build_sequences(snapshots, window_size)
    train_seq, val_seq, test_seq = split_by_time(
        sequences,
        val_ratio=0.15,
        test_ratio=0.15,
    )
    split_map = {"train": train_seq, "val": val_seq, "test": test_seq}
    eval_seq = split_map[args.split]
    print(f"  evaluating {args.split} set ({len(eval_seq)} sequences)")

    print("[3/3] evaluating")
    thr = args.threshold
    if thr is None:
        thr = float(checkpoint.get("threshold", 0.5))
    print(f"Decision threshold: {thr:.3f}")
    metrics, predictions = evaluate(model, eval_seq, threshold=thr)

    print("\nMetrics:")
    print(json.dumps(metrics, indent=2))

    predictions.to_parquet(args.out / f"predictions_{args.split}.parquet", index=False)
    with open(args.out / f"metrics_{args.split}.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nPredictions saved to {args.out / f'predictions_{args.split}.parquet'}")
    print(f"Metrics saved to {args.out / f'metrics_{args.split}.json'}")


if __name__ == "__main__":
    main()
