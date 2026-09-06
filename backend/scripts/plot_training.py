#!/usr/bin/env python3
"""Plot TG-Detect training history curves.

Examples
--------
  python scripts/plot_training.py \
      --history results/mordor_mixed/history.json \
      --out reports/mordor_mixed/training_curves.png
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Plot TG-Detect training history")
    p.add_argument("--history", type=Path, required=True, help="path to history.json")
    p.add_argument("--out", type=Path, required=True, help="output PNG path")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)

    with open(args.history, "r", encoding="utf-8") as fh:
        history = json.load(fh)

    # Normalize history to dict-of-lists format.
    if isinstance(history, list):
        # train_tgnn.py stores each epoch's *validation* metrics under the bare
        # keys ("loss"/"auc_pr"/"f1") plus "train_loss"; older runs may use
        # explicit "val_*" keys. Prefer val_* and fall back to the bare key.
        def series(*keys: str) -> list:
            for k in keys:
                vals = [r.get(k) for r in history]
                if any(v is not None for v in vals):
                    return vals
            return []

        hist = {
            "train_loss": series("train_loss"),
            "val_loss": series("val_loss", "loss"),
            "val_auc_pr": series("val_auc_pr", "auc_pr"),
            "val_f1": series("val_f1", "f1"),
            "best_val_metric": history[-1].get("best_val_metric") if history else None,
            "early_stopped": history[-1].get("early_stopped") if history else False,
        }
    elif isinstance(history, dict):
        hist = history
    else:
        raise TypeError(f"unexpected history type: {type(history)}")

    epochs = np.arange(1, len(hist.get("train_loss", [])) + 1)
    train_loss = hist.get("train_loss", [])
    val_loss = hist.get("val_loss", [])
    val_auc_pr = hist.get("val_auc_pr", [])
    val_f1 = hist.get("val_f1", [])


    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    ax = axes[0, 0]
    ax.plot(epochs, train_loss, marker="o", label="train loss", color="#4C9AFF")
    if val_loss:
        ax.plot(epochs, val_loss, marker="s", label="val loss", color="#FF8B00")
    ax.set_xlabel("epoch")
    ax.set_ylabel("loss")
    ax.set_title("Training / Validation Loss")
    ax.legend()
    ax.grid(True, alpha=0.3)

    ax = axes[0, 1]
    if val_auc_pr:
        ax.plot(epochs, val_auc_pr, marker="o", color="#36B37E")
        ax.set_title("Validation AUC-PR")
        ax.set_xlabel("epoch")
        ax.set_ylabel("AUC-PR")
        ax.grid(True, alpha=0.3)
    else:
        ax.set_title("Validation AUC-PR (not recorded)")

    ax = axes[1, 0]
    if val_f1:
        ax.plot(epochs, val_f1, marker="o", color="#8777D9")
        ax.set_title("Validation F1")
        ax.set_xlabel("epoch")
        ax.set_ylabel("F1")
        ax.grid(True, alpha=0.3)
    else:
        ax.set_title("Validation F1 (not recorded)")

    ax = axes[1, 1]
    ax.axis("off")
    summary_lines = [
        f"epochs: {len(epochs)}",
        f"best val metric: {hist.get('best_val_metric', 'N/A')}",
        f"early stopped: {hist.get('early_stopped', False)}",
    ]

    if train_loss and train_loss[-1] is not None:
        summary_lines.append(f"final train loss: {train_loss[-1]:.4f}")
    if val_loss and val_loss[-1] is not None:
        summary_lines.append(f"final val loss: {val_loss[-1]:.4f}")

    ax.text(0.1, 0.5, "\n".join(summary_lines), fontsize=12, va="center",
            family="monospace", transform=ax.transAxes)

    fig.suptitle("TG-Detect Training History", fontsize=16)
    fig.tight_layout()
    fig.savefig(args.out, dpi=200)
    plt.close(fig)
    print(f"saved -> {args.out}")


if __name__ == "__main__":
    main()
