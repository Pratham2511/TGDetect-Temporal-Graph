#!/usr/bin/env python3
"""Plot TG-Detect evaluation results.

Examples
--------
  python scripts/plot_evaluation.py \
      --predictions results/mordor_mixed/eval_test/predictions_test.parquet \
      --metrics results/mordor_mixed/eval_test/metrics_test.json \
      --out reports/mordor_mixed/evaluation_plots.png
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
import pandas as pd  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    average_precision_score,
    precision_recall_curve,
    roc_auc_score,
    roc_curve,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Plot TG-Detect evaluation results")
    p.add_argument("--predictions", type=Path, required=True,
                   help="path to predictions_*.parquet")
    p.add_argument("--metrics", type=Path, required=True,
                   help="path to metrics_*.json")
    p.add_argument("--out", type=Path, required=True, help="output PNG path")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)

    df = pd.read_parquet(args.predictions)
    with open(args.metrics, "r", encoding="utf-8") as fh:
        metrics = json.load(fh)

    y_true = df["ground_truth"].to_numpy()
    y_prob = df["probability"].to_numpy()
    y_pred = df["prediction"].to_numpy()

    fig, axes = plt.subplots(2, 2, figsize=(14, 12))

    # 1. Confusion matrix
    ax = axes[0, 0]
    tp = int(((y_true == 1) & (y_pred == 1)).sum())
    fp = int(((y_true == 0) & (y_pred == 1)).sum())
    tn = int(((y_true == 0) & (y_pred == 0)).sum())
    fn = int(((y_true == 1) & (y_pred == 0)).sum())
    cm = np.array([[tn, fp], [fn, tp]])
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(["Predicted 0", "Predicted 1"])
    ax.set_yticklabels(["Actual 0", "Actual 1"])
    ax.set_xlabel("Predicted label")
    ax.set_ylabel("True label")
    ax.set_title("Confusion Matrix")
    for i in range(2):
        for j in range(2):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black",
                    fontsize=14, weight="bold")
    plt.colorbar(im, ax=ax, shrink=0.8)

    # 2. Prediction distribution
    ax = axes[0, 1]
    ax.hist(y_prob[y_true == 0], bins=50, color="#36B37E", alpha=0.7,
            label="benign", density=True)
    ax.hist(y_prob[y_true == 1], bins=50, color="#D64545", alpha=0.7,
            label="malicious", density=True)
    ax.axvline(metrics.get("threshold", 0.5), color="#FF8B00", linestyle="--",
               label=f"threshold={metrics.get('threshold', 0.5):.3f}")
    ax.set_xlabel("predicted probability")
    ax.set_ylabel("density")
    ax.set_title("Prediction Distribution")
    ax.legend()

    # 3. ROC curve
    ax = axes[1, 0]
    if len(np.unique(y_true)) > 1:
        fpr, tpr, _ = roc_curve(y_true, y_prob)
        auc = roc_auc_score(y_true, y_prob)
        ax.plot(fpr, tpr, color="#4C9AFF", lw=2,
                label=f"ROC curve (AUC = {auc:.3f})")
        ax.plot([0, 1], [0, 1], color="#97A0AF", lw=1, linestyle="--")
        ax.set_xlabel("False Positive Rate")
        ax.set_ylabel("True Positive Rate")
        ax.set_title("ROC Curve")
        ax.legend(loc="lower right")
        ax.grid(True, alpha=0.3)
    else:
        ax.set_title("ROC Curve (only one class present)")

    # 4. Precision-Recall curve
    ax = axes[1, 1]
    if len(np.unique(y_true)) > 1:
        precision, recall, _ = precision_recall_curve(y_true, y_prob)
        ap = average_precision_score(y_true, y_prob)
        ax.plot(recall, precision, color="#FF8B00", lw=2,
                label=f"PR curve (AP = {ap:.3f})")
        baseline = y_true.sum() / len(y_true)
        ax.axhline(baseline, color="#97A0AF", linestyle="--",
                   label=f"baseline = {baseline:.3f}")
        ax.set_xlabel("Recall")
        ax.set_ylabel("Precision")
        ax.set_title("Precision-Recall Curve")
        ax.legend(loc="lower left")
        ax.grid(True, alpha=0.3)
    else:
        ax.set_title("Precision-Recall Curve (only one class present)")

    fig.suptitle(
        f"TG-Detect Evaluation\n"
        f"F1={metrics.get('f1', 0):.3f}  "
        f"Precision={metrics.get('precision', 0):.3f}  "
        f"Recall={metrics.get('recall', 0):.3f}  "
        f"AUC-PR={metrics.get('auc_pr', 0):.3f}",
        fontsize=14,
    )
    fig.tight_layout()
    fig.savefig(args.out, dpi=200)
    plt.close(fig)
    print(f"saved -> {args.out}")


if __name__ == "__main__":
    main()
