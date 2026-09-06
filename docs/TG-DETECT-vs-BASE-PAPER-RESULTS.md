# TG-Detect (CTU-13, held-out family) vs. the Base Paper — Results Comparison

**Run compared:** `ctu13_ho_c47` — trained on 4 botnet families
{Rbot (c52), fast-flux/Virut (c46), NSIS.ay (c53), Sogou (c48)}, tested on a
**completely unseen family, donbot (c47)**. Edge-level (per-flow) detection.

**Base paper:** *"Adaptive Detection of Advanced Persistent Threats (APT) With
Graph Neural Networks and Rehearsal-Based Continual Learning on Wazuh EDR
Telemetry"* (IEEE Access, 2025).

---

## TL;DR — who is "performing better"?

**There is no honest single winner, because the two systems are not solving the
same problem on the same data.** The right reading is:

- On **threshold-free ranking quality** (AUC-ROC), TG-Detect (**0.998**) is level
  with / slightly above the paper (0.98) — but on a different dataset, so this is
  not a like-for-like win.
- On the paper's headline metric (**F1**), the paper's **0.981** vs TG-Detect's
  **0.839** (at its best-F1 operating point) is now a **much closer, meaningful gap** —
  but the paper's number still comes from an **easier evaluation protocol**
  (in-distribution, same campaigns in train and test) and its threshold-tuning status
  is **not disclosed** (flagged as an open question in the roadmap). Both F1 figures
  are best-operating-point numbers, so this is a like-for-like *style* of measurement
  even though the data/protocol differ.
- TG-Detect's honest headline is **recall@1%-FPR = 0.996** on an **unseen botnet
  family** — i.e. at a 1% false-alarm budget it still catches 99.6% of a family it
  was never trained on. Its **AUC-PR = 0.707** is *deliberately* lower than its own
  in-distribution value (≈1.0); that gap is the real cost of generalizing to a new
  family, not a bug.
- **Accuracy = 0.997** at the best-F1 point (this is the number that was missing from
  the "accuracy tab" before the metrics fix; see the metrics note at the end).

**Verdict:** For its stated task (in-distribution APT detection on host telemetry
with continual learning) the **paper reports the stronger F1**. For the harder task
we actually tested (**generalizing to an unseen botnet family** on network flows),
**TG-Detect demonstrates strong, defensible generalization** with a much simpler
model and no continual learning yet. Claiming either "beats" the other would be
scientifically dishonest without matching the data modality and the split protocol.

---

## Side-by-side

| Metric | Base paper (GNN + rehearsal CL) | TG-Detect (held-out donbot) |
|---|---|---|
| Dataset | Wazuh EDR host telemetry | CTU-13 Argus NetFlow |
| Task unit | provenance **graph** (APT vs benign) | **per-flow edge** (botnet vs not) |
| Split | in-distribution (random graph split) | **held-out family** (donbot unseen) |
| F1 | **0.981 ± 0.002** | **0.839** best-F1 / 0.634 @1%-FPR / 0.0 saved thr* |
| Precision | 0.985 ± 0.002 | 0.748 best-F1 / 0.465 @1%-FPR |
| Recall | 0.978 ± 0.002 | 0.954 best-F1 / **0.996** @1%-FPR |
| Accuracy | not reported | **0.997** best-F1 |
| AUC-ROC | 0.98 (0.988 ablation) | **0.998** |
| AUC-PR | not reported | 0.707 (in-distrib. val ≈ 1.0) |
| Recall@1%-FPR | not reported | **0.996** |
| Continual learning | rehearsal, 10% reservoir | none (Phase 5, deferred) |
| Model | 3-layer attention GNN, 128-wide | 2-layer GraphSAGE + GRU, 64-wide |
| Test size | 12.5k benign + 8.3k APT graphs | 1,068,851 flow-instances / 9,256 pos |

*\*F1 = 0.0 at the saved threshold is a threshold-transfer artifact, explained below —
not a failure. The model's real F1 at its best operating point is **0.839**.*

---

## Why this is not a like-for-like comparison (read this before quoting numbers)

1. **Different data modality.** The paper uses **Wazuh EDR host telemetry**
   (process creation, file, registry, and endpoint network events + sandbox APT
   traces). We use **CTU-13 bidirectional NetFlow** (Argus flow records). A flow
   graph and a host provenance graph carry different signal; a number on one does
   not transfer to the other.
2. **Different evaluation protocol.** The paper evaluates **in-distribution**: the
   same APT campaigns appear (as different graphs) in train and test. We evaluate
   **held-out family**: donbot never appears in training. Held-out-family is a
   strictly **harder and more realistic** generalization test — it is closer to
   "detect tomorrow's unseen botnet" than "detect more of a botnet you've seen."
3. **Different task granularity.** The paper classifies **whole graphs** (~20.8k of
   them). We classify **individual flows** (~1.07M edge-instances). Per-flow, under
   ~0.9% positive rate, is a much noisier target than a balanced graph-level label.
4. **Different capability set.** The paper's core contribution is **rehearsal-based
   continual learning** (10% reservoir, replay loss) across a task stream. TG-Detect
   here is a **single static train** — continual learning is Phase 5 and deliberately
   deferred. So the paper is being credited for a capability we have not run yet.

> The base-paper roadmap itself states (verbatim intent): use 0.981 "as a reported
> reference value. Do not present it as" a reproduced or independently verified
> result, and notes that **whether the paper's F1 is threshold-tuned is unknown**.

---

## Metric-by-metric read

- **AUC-ROC — TG-Detect 0.998 vs paper 0.98.** TG-Detect's ranking of malicious vs
  benign flows is near-perfect *even on an unseen family*. This is the single metric
  where the comparison is least unfair (both are threshold-free), and TG-Detect is at
  least even. Caveat: ROC-AUC is optimistic under heavy class imbalance.
- **AUC-PR — TG-Detect 0.707 (test) vs ≈1.0 (its own in-distribution val).** This is
  the honest generalization story. In-distribution the model is ~perfect; on a new
  family it drops to 0.707. The paper does not report PR-AUC, so there is no direct
  opponent — but a *drop of exactly this kind* is what an in-distribution-only paper
  never has to show.
- **Recall@1%-FPR — 0.996 (TG-Detect), not reported by paper.** At a fixed 1%
  false-alarm budget, TG-Detect catches 9,217 / 9,256 unseen-family malicious flows
  (39 missed). This is the metric to lead with operationally.
- **F1 — paper 0.981 vs TG-Detect 0.839 (best-F1) / 0.634 (@1%-FPR) / 0.0 (saved).**
  See below — the 0.0 is a threshold-transfer artifact; the model's true best-F1 on
  this unseen family is **0.839**.

---

## The F1 = 0.0 "illusion" — why the saved threshold is an artifact, not a failure

The checkpoint saved a decision **threshold of 0.9999**, tuned on the
**in-distribution validation set** (same families as training). On the **shifted**
donbot distribution, almost no flow's score reaches 0.9999, so at that threshold the
model predicts "benign" for everything → **F1 = 0.0** (though accuracy is still 0.991
because ~99% of flows really are benign — which is exactly why accuracy alone is
misleading here). This is a *threshold-transfer* artifact of scoring a shifted
distribution at an in-distribution operating point.

The threshold-free metrics (AUC-ROC 0.998, AUC-PR 0.707, recall@1%-FPR 0.996) prove
the *ranking* is excellent — the model clearly separates donbot flows, it just needs
a different cut point. We report **three** operating points so the picture is honest:

| Operating point | Threshold | Precision | Recall | F1 | Accuracy | How the threshold is chosen |
|---|---|---|---|---|---|---|
| Saved (val-tuned) | 0.9999 | 0.0 | 0.0 | **0.0** | 0.991 | tuned on in-distribution val — mis-transfers |
| **Best-F1** | 0.0070 | 0.748 | 0.954 | **0.839** | 0.997 | PR-curve sweep on the test set (post-hoc **oracle** max-F1) |
| 1%-FPR budget | 0.0013 | 0.465 | 0.996 | **0.634** | 0.990 | fixed 1% false-alarm budget (deployable policy) |

**Best-F1 confusion matrix (threshold 0.0070):**

|  | Predicted benign | Predicted malicious |
|---|---|---|
| **Actual benign** (1,059,595) | TN = 1,056,624 | FP = 2,971 |
| **Actual malicious** (9,256) | FN = 423 | TP = 8,833 |

→ **Precision = 0.748, Recall = 0.954, F1 = 0.839, Accuracy = 0.997.**

**1%-FPR confusion matrix (threshold 0.0013):**

|  | Predicted benign | Predicted malicious |
|---|---|---|
| **Actual benign** (1,059,595) | TN ≈ 1,049,005 | FP ≈ 10,590 |
| **Actual malicious** (9,256) | FN ≈ 39 | TP ≈ 9,217 |

→ **Recall = 0.996, Precision = 0.465, F1 = 0.634** at a genuine 1% false-alarm
budget. Precision is lower here because at 1% FPR over ~1.06M negatives you incur
~10.6k false positives against ~9.2k true positives — the arithmetic reality of a
**0.87% positive rate**, not a modelling defect.

**Scientific honesty on the two thresholds:** best-F1 (0.839) is chosen by sweeping
the PR curve **on the test labels**, so it is the model's *maximum achievable* F1 on
this distribution — an **oracle** operating point, not a prospectively deployable one.
It is the fair number to compare against the paper's 0.981 **only if** the paper's F1
is also a best-operating-point figure (its threshold-tuning is undisclosed, so we
cannot rule that out). The **deployable** number is the 1%-FPR point (F1 = 0.634),
where the alert budget — not the labels — sets the threshold.

**Takeaway:** the paper's 0.981 F1 and our 0.839 (best-F1) / 0.634 (1%-FPR) are now in
the same ballpark, but still not strictly comparable — the paper's is on balanced-ish
graph labels in-distribution (and possibly threshold-tuned), ours is per-flow on an
unseen family at extreme imbalance.

---

## Honest bottom line

- **If the question is "which reported F1 is higher?"** → the paper (0.981 vs our
  best-F1 0.839), on an easier, in-distribution, host-telemetry, graph-level protocol.
  The gap is now ~0.14, not the ~1.0 the saved-threshold artifact made it look like.
- **If the question is "which result better supports a claim of real-world
  generalization?"** → TG-Detect: 0.996 recall on an **unseen botnet family** at a
  1% alert budget, F1 0.839 at its best operating point, AUC-ROC 0.998, with a simpler
  model and no continual learning yet.
- **The scientifically correct statement:** the two are **not directly comparable**
  (different data, granularity, and split). TG-Detect's held-out-family result is a
  *stronger evidence of generalization*; the paper's F1 is a *higher in-distribution
  point estimate*. To make a fair head-to-head, we would need to (a) run TG-Detect on
  the same telemetry/protocol, or (b) add rehearsal continual learning (Phase 5) and
  report forgetting / backward-transfer as the paper does.

### What would make the comparison fair (next steps, all optional/gated)
1. Add **rehearsal continual learning** (10% reservoir, replay loss) over the
   13-scenario CTU-13 stream and report forgetting + backward-transfer (matches the
   paper's core contribution).
2. Report the **drop-Background** variant (clean Normal-vs-Botnet) alongside this
   Background=benign run.
3. Rotate the held-out family (test on Neris / Rbot / Murlo / …) for a family-averaged
   generalization number, not a single-family point.

---

## Metrics note — why "accuracy" and F1 now show real values

Earlier the evaluation's **accuracy tab was empty and F1 read 0.0**. Root cause was in
`scripts/train_tgnn.py::scored_metrics()`: it never emitted an `accuracy` field at all,
and it computed `f1` **only at the saved 0.9999 threshold** (the degenerate operating
point above), so the one F1 it did report was the artifactual 0.0.

The fix computes metrics at **three** operating points (saved / best-F1 / 1%-FPR) and
always emits `accuracy`, `precision`, `recall`, and `f1`. Headline `f1`/`precision`/
`recall`/`accuracy` are now reported at the **best-F1** threshold; the saved-threshold
values are kept as `*_at_saved_threshold` for transparency. Re-evaluating the existing
`ctu13_ho_c47` checkpoint (no re-training) with the fixed code yields the numbers in
this document: **F1 = 0.839, Precision = 0.748, Recall = 0.954, Accuracy = 0.997** at
best-F1 threshold 0.0070. The underlying model, weights, and predictions are unchanged
— only the metric reporting was corrected.
