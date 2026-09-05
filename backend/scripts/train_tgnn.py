#!/usr/bin/env python3
"""Train the TGNN on temporal snapshots.

Example:
    python scripts/train_tgnn.py \
        --snapshots data/snapshots/mordor_test \
        --epochs 20 \
        --batch-size 8 \
        --out models/checkpoints/mordor_test
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

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Framework guard.
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from sklearn.metrics import average_precision_score, f1_score, roc_auc_score
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "Training requires the ML dependencies. "
        "Install them with: pip install -r requirements-ml.txt"
    ) from exc

from models.tgnn import TemporalGNN


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train TGNN on snapshots")
    parser.add_argument(
        "--snapshots",
        type=Path,
        required=True,
        help="Directory containing snapshot_*.pkl files and meta.json",
    )
    parser.add_argument(
        "--out",
        type=Path,
        required=True,
        help="Checkpoint output directory",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=20,
        help="Number of training epochs",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=8,
        help="Snapshots per training batch",
    )
    parser.add_argument(
        "--lr",
        type=float,
        default=1e-3,
        help="Learning rate",
    )
    parser.add_argument(
        "--hidden-channels",
        type=int,
        default=64,
        help="GNN hidden dimension",
    )
    parser.add_argument(
        "--out-channels",
        type=int,
        default=64,
        help="RNN hidden / classifier input dimension",
    )
    parser.add_argument(
        "--gnn-layers",
        type=int,
        default=2,
        help="Number of GNN layers",
    )
    parser.add_argument(
        "--rnn-layers",
        type=int,
        default=1,
        help="Number of GRU layers",
    )
    parser.add_argument(
        "--dropout",
        type=float,
        default=0.3,
        help="Dropout probability",
    )
    parser.add_argument(
        "--window-size",
        type=int,
        default=10,
        help="Number of consecutive snapshots in each input sequence",
    )
    parser.add_argument(
        "--seq-stride",
        type=int,
        default=1,
        help="Step between sequence start offsets (>1 = fewer, faster steps)",
    )
    parser.add_argument(
        "--val-ratio",
        type=float,
        default=0.15,
        help="Fraction of snapshots used for validation",
    )

    parser.add_argument(
        "--test-ratio",
        type=float,
        default=0.15,
        help="Fraction of snapshots used for testing",
    )
    parser.add_argument(
        "--split-mode",
        choices=["time", "block"],
        default="block",
        help="time = chronological split; block = interleaved blocks so all "
             "splits see comparable scenario mixes (better generalisation signal)",
    )
    parser.add_argument(
        "--block-size",
        type=int,
        default=10,
        help="Sequences per block when --split-mode block",
    )
    parser.add_argument(
        "--weight-decay",
        type=float,
        default=5e-4,
        help="L2 regularisation strength (AdamW)",
    )
    parser.add_argument(
        "--grad-clip",
        type=float,
        default=1.0,
        help="Gradient-norm clipping value (0 disables)",
    )
    parser.add_argument(
        "--patience",
        type=int,
        default=5,
        help="Early-stopping patience in epochs (0 disables)",
    )
    parser.add_argument(
        "--select-metric",
        choices=["auc_pr", "f1", "auc_roc"],
        default="auc_pr",
        help="Validation metric used to pick the best checkpoint. auc_pr is "
             "threshold-free and far less prone to the F1=0.99 illusion.",
    )
    parser.add_argument(
        "--no-threshold-tuning",
        action="store_true",
        help="keep a fixed 0.5 decision threshold instead of maximising val F1",
    )
    parser.add_argument(
        "--pos-weight",
        type=float,
        default=None,
        help="Positive-class weight for BCE loss (auto-computed if omitted)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed",
    )
    return parser.parse_args()



def load_snapshots(snapshots_dir: Path) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    files = sorted(snapshots_dir.glob("snapshot_*.pkl"))
    if not files:
        raise FileNotFoundError(f"No snapshot_*.pkl files found in {snapshots_dir}")

    snapshots = []
    for f in files:
        with open(f, "rb") as fh:
            snapshots.append(pickle.load(fh))

    with open(snapshots_dir / "meta.json", "r", encoding="utf-8") as fh:
        meta = json.load(fh)

    return snapshots, meta


def build_sequences(
    snapshots: List[Dict[str, Any]], window_size: int, seq_stride: int = 1
) -> List[List[Dict[str, Any]]]:
    """Create sequences of `window_size` consecutive snapshots.

    `seq_stride > 1` skips overlapping offsets, which cuts training time
    almost linearly with very little accuracy loss.
    """
    sequences = []
    for i in range(0, len(snapshots) - window_size + 1, max(1, seq_stride)):
        sequences.append(snapshots[i : i + window_size])
    return sequences



def split_by_time(
    sequences: List[List[Dict[str, Any]]],
    val_ratio: float,
    test_ratio: float,
) -> tuple[List[List[Dict[str, Any]]], List[List[Dict[str, Any]]], List[List[Dict[str, Any]]]]:
    """Time-ordered train/val/test split."""
    n = len(sequences)
    test_end = int(n * (1 - test_ratio))
    val_end = int(test_end * (1 - val_ratio))

    train = sequences[:val_end]
    val = sequences[val_end:test_end]
    test = sequences[test_end:]
    return train, val, test


def split_by_block(
    sequences: List[List[Dict[str, Any]]],
    val_ratio: float,
    test_ratio: float,
    block_size: int = 10,
) -> tuple[List[List[Dict[str, Any]]], List[List[Dict[str, Any]]], List[List[Dict[str, Any]]]]:
    """Interleaved-block split.

    Chronological splits on Mordor put whole scenarios in a single split, so
    the test set can contain attack types the model never saw -> the huge
    val/test gap. Blocks keep temporal locality inside a block (no leakage of
    adjacent overlapping windows) while giving every split a comparable mix.
    """
    block_size = max(1, block_size)
    blocks = [sequences[i : i + block_size] for i in range(0, len(sequences), block_size)]
    train, val, test = [], [], []
    n_val = max(1, int(round(1 / max(val_ratio, 1e-6)))) if val_ratio > 0 else 0
    n_test = max(1, int(round(1 / max(test_ratio, 1e-6)))) if test_ratio > 0 else 0
    for i, block in enumerate(blocks):
        if n_test and i % n_test == n_test - 1:
            test.extend(block)
        elif n_val and i % n_val == n_val - 2:
            val.extend(block)
        else:
            train.extend(block)
    if not val:
        val = test[: max(1, len(test) // 2)]
    return train, val, test




def compute_pos_weight(sequences: List[List[Dict[str, Any]]]) -> torch.Tensor:
    """Balance BCE loss using the inverse label frequency across node labels."""
    labels = []
    for seq in sequences:
        labels.extend(seq[-1]["node_labels"].tolist())
    labels = np.array(labels, dtype=np.int64)
    pos = int(labels.sum())
    neg = int((labels == 0).sum())
    if pos == 0:
        return torch.tensor(1.0)
    weight = max(1.0, neg / pos)
    return torch.tensor(weight, dtype=torch.float32)


def train_epoch(
    model: TemporalGNN,
    sequences: List[List[Dict[str, Any]]],
    optimizer: optim.Optimizer,
    criterion: nn.Module,
    device: torch.device,
    grad_clip: float = 0.0,
    shuffle: bool = True,
) -> float:
    model.train()
    total_loss = 0.0
    count = 0

    order = np.random.permutation(len(sequences)) if shuffle else np.arange(len(sequences))
    for idx in order:
        seq = sequences[int(idx)]
        optimizer.zero_grad()
        node_logits, snapshot_logit = model(seq)
        node_logits = node_logits.to(device)

        labels = torch.from_numpy(seq[-1]["node_labels"]).float().unsqueeze(1).to(device)
        loss = criterion(node_logits, labels)
        loss.backward()
        if grad_clip and grad_clip > 0:
            nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
        optimizer.step()



        total_loss += loss.item()
        count += 1
        if count % 100 == 0:
            print(f"    step {count}/{len(sequences)} loss={total_loss/count:.4f}", flush=True)


    return total_loss / max(count, 1)


def evaluate(
    model: TemporalGNN,
    sequences: List[List[Dict[str, Any]]],
    criterion: nn.Module,
    device: torch.device,
    threshold: float | None = None,
    tune_threshold: bool = False,
) -> Dict[str, float]:
    model.eval()
    total_loss = 0.0
    count = 0

    all_probs = []
    all_labels = []

    with torch.no_grad():
        for seq in sequences:
            node_logits, _ = model(seq)
            node_logits = node_logits.to(device)
            labels = torch.from_numpy(seq[-1]["node_labels"]).float().unsqueeze(1).to(device)
            loss = criterion(node_logits, labels)
            total_loss += loss.item()
            count += 1

            probs = torch.sigmoid(node_logits).cpu().numpy().ravel()
            all_probs.extend(probs.tolist())
            all_labels.extend(labels.cpu().numpy().ravel().tolist())

    all_probs = np.array(all_probs)
    all_labels = np.array(all_labels)

    metrics: Dict[str, float] = {"loss": total_loss / max(count, 1)}
    if len(np.unique(all_labels)) > 1:
        metrics["auc_roc"] = float(roc_auc_score(all_labels, all_probs))
        metrics["auc_pr"] = float(average_precision_score(all_labels, all_probs))
    else:
        metrics["auc_roc"] = float("nan")
        metrics["auc_pr"] = float("nan")

    thr = 0.5 if threshold is None else float(threshold)
    if tune_threshold and len(np.unique(all_labels)) > 1:
        best_thr, best_f1 = thr, -1.0
        for cand in np.unique(np.quantile(all_probs, np.linspace(0.01, 0.99, 99))):
            cand_f1 = f1_score(all_labels, (all_probs >= cand).astype(int), zero_division=0)
            if cand_f1 > best_f1:
                best_f1, best_thr = cand_f1, float(cand)
        thr = best_thr
    metrics["threshold"] = float(thr)
    preds = (all_probs >= thr).astype(int)
    metrics["f1"] = float(f1_score(all_labels, preds, zero_division=0))
    metrics["accuracy"] = float((preds == all_labels).mean())
    metrics["precision"] = float(
        (preds[all_labels == 1] == 1).sum() / max(preds.sum(), 1)
    )
    metrics["recall"] = float(
        (preds[all_labels == 1] == 1).sum() / max(all_labels.sum(), 1)
    )

    return metrics


def main() -> None:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    print(f"[1/4] loading snapshots from {args.snapshots}")
    snapshots, meta = load_snapshots(args.snapshots)
    print(f"  -> {len(snapshots)} snapshots")

    print("[2/4] building sequences")
    sequences = build_sequences(snapshots, args.window_size, args.seq_stride)
    if args.split_mode == "block":
        train_seq, val_seq, test_seq = split_by_block(
            sequences, args.val_ratio, args.test_ratio, args.block_size
        )
    else:
        train_seq, val_seq, test_seq = split_by_time(sequences, args.val_ratio, args.test_ratio)
    print(f"  split={args.split_mode} train={len(train_seq)} val={len(val_seq)} test={len(test_seq)}")


    in_channels = meta["node_feature_dim"]
    edge_dim = meta["edge_feature_dim"]
    num_node_types = meta["num_node_types"]
    num_relations = meta["num_relations"]

    print(f"[3/4] initialising model")
    model = TemporalGNN(
        in_channels=in_channels,
        edge_dim=edge_dim,
        hidden_channels=args.hidden_channels,
        out_channels=args.out_channels,
        num_gnn_layers=args.gnn_layers,
        num_rnn_layers=args.rnn_layers,
        dropout=args.dropout,
        node_types=num_node_types,
        num_relations=num_relations,
    ).to(device)
    print(f"  parameters: {sum(p.numel() for p in model.parameters()):,}")

    pos_weight = (
        torch.tensor(args.pos_weight, dtype=torch.float32)
        if args.pos_weight
        else compute_pos_weight(train_seq)
    )
    print(f"  pos_weight for BCE: {pos_weight.item():.2f}")
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight.to(device))
    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=2, factor=0.5)

    print("[4/4] training")
    best_score = -1.0
    best_val_f1 = -1.0
    epochs_since_best = 0
    history: List[Dict[str, float]] = []

    for epoch in range(1, args.epochs + 1):
        train_loss = train_epoch(
            model, train_seq, optimizer, criterion, device, grad_clip=args.grad_clip
        )
        val_metrics = evaluate(model, val_seq, criterion, device,
                               tune_threshold=not args.no_threshold_tuning)
        val_metrics["epoch"] = epoch
        val_metrics["train_loss"] = train_loss
        history.append(val_metrics)

        print(
            f"Epoch {epoch:03d} | train_loss={train_loss:.4f} | "
            f"val_loss={val_metrics['loss']:.4f} | "
            f"val_f1={val_metrics['f1']:.4f} | "
            f"val_auc_pr={val_metrics['auc_pr']:.4f} | "
            f"val_auc_roc={val_metrics['auc_roc']:.4f}",
            flush=True,
        )

        scheduler.step(val_metrics["loss"])

        # Select on a threshold-free metric by default: a tuned-threshold F1
        # can hit 0.99 on val while the model generalises poorly.
        score = val_metrics.get(args.select_metric, float("nan"))
        if score != score:  # NaN (single-class val split)
            score = val_metrics["f1"]

        if score > best_score:
            best_score = score
            best_val_f1 = val_metrics["f1"]
            epochs_since_best = 0
            # Convert Path objects to strings so the checkpoint is pickle-safe
            # with PyTorch 2.6+ weights_only loading.
            args_dict = {k: str(v) if isinstance(v, Path) else v for k, v in vars(args).items()}
            checkpoint = {
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "args": args_dict,
                "meta": meta,
                "best_val_f1": best_val_f1,
                "best_score": float(best_score),
                "select_metric": args.select_metric,
                "threshold": float(val_metrics.get("threshold", 0.5)),
            }
            torch.save(checkpoint, args.out / "best_model.pt")
        else:
            epochs_since_best += 1
            if args.patience and epochs_since_best >= args.patience:
                print(f"Early stopping: no {args.select_metric} improvement "
                      f"for {args.patience} epochs.")
                break

    # Save final model and training history.
    torch.save(model.state_dict(), args.out / "final_model.pt")
    with open(args.out / "history.json", "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)


    if test_seq:
        best = torch.load(args.out / "best_model.pt", map_location=device, weights_only=False)
        model.load_state_dict(best["model_state_dict"])
        test_metrics = evaluate(model, test_seq, criterion, device,
                                threshold=best.get("threshold", 0.5))
        print("Test metrics @ tuned threshold "
              f"{best.get('threshold', 0.5):.3f}: " +
              ", ".join(f"{k}={v:.4f}" for k, v in test_metrics.items()
                        if isinstance(v, float)))
        with open(args.out / "test_metrics.json", "w", encoding="utf-8") as f:
            json.dump(test_metrics, f, indent=2)

    print(f"\nTraining complete. Best val {args.select_metric}: {best_score:.4f} "
          f"(val F1 at that epoch: {best_val_f1:.4f})")
    print(f"Checkpoint saved to {args.out / 'best_model.pt'}")



if __name__ == "__main__":
    main()
