"""Temporal snapshot construction for TGNN training.

Turns a processed `TemporalGraphDataset` into a sequence of time-windowed
snapshots. Each snapshot is a dictionary with:
  - edge_index: [2, E] int array of node indices
  - edge_attr:  [E, R] float array (relation one-hot + relative time)
  - x:          [N, F] float node feature matrix
  - y:          [N] int node labels (or [E] edge labels)
  - ts_start, ts_end: window boundaries
  - node_index_map: local node_id -> local index for this snapshot

Implementation notes
--------------------
The builder is fully vectorised with numpy. Windows are generated only where
events actually exist (an event-driven stride grid), so a dataset spanning
months but containing a few hundred thousand events produces a few thousand
snapshots instead of millions of empty ones.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, Iterator, List, Optional

import numpy as np
import pandas as pd

from .loader import TemporalGraphDataset

# Fixed 35-dim feature layout for NetFlow records:
# 9 numeric (log1p dur/bytes/pkts/rates) + 4 proto OH + 4 dir OH + 8 state flags + 10 port buckets
FLOW_FEATURE_DIM: int = 35


@dataclass
class TemporalSnapshot:
    """One time-windowed view of the graph."""

    ts_start: float
    ts_end: float
    node_ids: List[str]
    node_types: np.ndarray
    x: np.ndarray  # [N, F]
    edge_index: np.ndarray  # [2, E]
    edge_attr: np.ndarray  # [E, edge_feat_dim]
    edge_labels: np.ndarray  # [E]
    node_labels: np.ndarray  # [N]
    snapshot_label: int  # 1 if any malicious event in window
    num_events: int
    scenario_id: str = ""  # provenance tag (CTU-13 capture) for group splits

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ts_start": self.ts_start,
            "ts_end": self.ts_end,
            "node_ids": self.node_ids,
            "node_types": self.node_types,
            "x": self.x,
            "edge_index": self.edge_index,
            "edge_attr": self.edge_attr,
            "edge_labels": self.edge_labels,
            "node_labels": self.node_labels,
            "snapshot_label": self.snapshot_label,
            "num_events": self.num_events,
            "scenario_id": self.scenario_id,
        }


class SnapshotBuilder:
    """Build temporal snapshots from a loaded graph dataset."""

    def __init__(
        self,
        dataset: TemporalGraphDataset,
        window_size_s: float = 60.0,
        stride_s: Optional[float] = None,
        node_feature_mode: str = "type_degree",
        edge_feature_mode: str = "relation_time",
        max_snapshots: Optional[int] = None,
        max_edges_per_snapshot: Optional[int] = None,
        scenario_id: str = "",
    ) -> None:
        self.dataset = dataset
        self.window_size_s = float(window_size_s)
        self.stride_s = float(stride_s or window_size_s / 2.0)
        self.node_feature_mode = node_feature_mode
        self.edge_feature_mode = edge_feature_mode
        self.max_snapshots = max_snapshots
        self.max_edges_per_snapshot = max_edges_per_snapshot
        self.scenario_id = scenario_id

        self._prepare_node_features()
        self._prepare_edge_arrays()

    @property
    def edge_feature_dim(self) -> int:
        num_rel = len(self.dataset.relations)
        if self.edge_feature_mode == "relation_time":
            return num_rel + 1
        elif self.edge_feature_mode == "relation_only":
            return num_rel
        elif self.edge_feature_mode == "flow":
            return num_rel + FLOW_FEATURE_DIM + 1
        raise ValueError(f"Unknown edge_feature_mode: {self.edge_feature_mode}")

    # ------------------------------------------------------------------
    # Pre-computation
    # ------------------------------------------------------------------
    def _prepare_node_features(self) -> None:
        """Dense [num_nodes, F] feature matrix keyed by global node index.

        Modes:
          - ``type_only``     : node-type one-hot ONLY. Leakage-free. For CTU-13
            (every node is an IP) this is a constant all-ones column — exactly
            the E-GraphSAGE convention where all signal rides on the edges.
          - ``type_degree``   : one-hot + [degree, out_deg, in_deg, mal_ratio].
            WARNING — LEAKY: ``out/in_degree`` are full-stream totals and
            ``mal_ratio`` is derived from the labels, so both leak future/label
            information into every snapshot. Kept only for backward-compat with
            older Mordor experiments; never use it for a generalisation claim.
            CTU-13 uses ``type_only``.
        """
        nodes = self.dataset.nodes
        n = len(nodes)
        num_types = len(self.dataset.node_types)

        type_idx = (
            nodes["node_type"].map(self.dataset.node_type_to_index).fillna(0).to_numpy(dtype=np.int64)
        )
        onehot = np.zeros((n, num_types), dtype=np.float32)
        onehot[np.arange(n), type_idx] = 1.0

        if self.node_feature_mode == "type_degree":
            out_deg = nodes["out_degree"].to_numpy(dtype=np.float32)
            in_deg = nodes["in_degree"].to_numpy(dtype=np.float32)
            degree = out_deg + in_deg
            mal = nodes["malicious_events"].to_numpy(dtype=np.float32)
            mal_ratio = mal / np.where(degree == 0, 1.0, degree)  # LEAKY (labels)
            extra = np.stack([degree, out_deg, in_deg, mal_ratio], axis=1).astype(np.float32)
            self.node_features = np.concatenate([onehot, extra], axis=1)
        elif self.node_feature_mode == "type_only":
            self.node_features = onehot
        else:
            raise ValueError(f"Unknown node_feature_mode: {self.node_feature_mode}")

        self.node_type_index = type_idx
        self.node_ids_arr = nodes["node_id"].to_numpy()

    def _prepare_edge_arrays(self) -> None:
        """Sorted numpy views over the edge table (no pandas in the hot loop)."""
        edges = self.dataset.edges
        self.flow_feats: Optional[np.ndarray] = None
        if edges.empty:
            self.ts = np.zeros(0, dtype=np.float64)
            self.src = np.zeros(0, dtype=np.int64)
            self.dst = np.zeros(0, dtype=np.int64)
            self.rel = np.zeros(0, dtype=np.int64)
            self.elabel = np.zeros(0, dtype=np.int64)
            return

        order = np.argsort(edges["ts"].to_numpy(dtype=np.float64), kind="mergesort")
        id_map = self.dataset.node_id_to_index

        self.ts = edges["ts"].to_numpy(dtype=np.float64)[order]
        self.src = (
            edges["src_id"].map(id_map).fillna(0).to_numpy(dtype=np.int64)[order]
        )
        self.dst = (
            edges["dst_id"].map(id_map).fillna(0).to_numpy(dtype=np.int64)[order]
        )
        self.rel = (
            edges["relation"].map(self.dataset.relation_to_index).fillna(0).to_numpy(dtype=np.int64)[order]
        )
        if "label" in edges.columns:
            self.elabel = edges["label"].to_numpy(dtype=np.int64)[order]
        else:
            self.elabel = np.zeros(len(self.ts), dtype=np.int64)

        if self.edge_feature_mode == "flow":
            self.flow_feats = self._compute_flow_features(edges, order)

    # NetFlow edge-feature layout (fixed, leakage-free — see FLOW_FEATURE_DIM).
    _PROTO_VOCAB = ("tcp", "udp", "icmp")
    _DIR_VOCAB = ("->", "<->", "<-")

    @staticmethod
    def _compute_flow_features(edges: pd.DataFrame, order: np.ndarray) -> np.ndarray:
        """Vectorised per-flow numeric/categorical features (CTU-13).

        All features are either scale-stable transforms (``log1p`` of
        volumes/rates) or fixed-vocabulary buckets, so nothing is fit on the
        data and nothing leaks the label. Raw ports are deliberately NOT used
        (a raw C2 port memorises one scenario and never transfers) — only
        well-known/ephemeral flags and coarse service buckets.
        """
        required = ("flow_tot_bytes", "flow_src_bytes", "flow_tot_pkts", "flow_dur")
        for col in required:
            if col not in edges.columns:
                raise ValueError(
                    "edge_feature_mode='flow' needs NetFlow columns (e.g. "
                    f"'{col}') on edges.parquet. Rebuild the graph with the "
                    "ctu13 parser, or pick a different --edge-feature-mode."
                )

        def num(col: str) -> np.ndarray:
            arr = pd.to_numeric(edges[col], errors="coerce").to_numpy(dtype=np.float64)[order]
            return np.nan_to_num(arr, nan=0.0)

        dur = np.clip(num("flow_dur"), 0.0, None)
        tb = np.clip(num("flow_tot_bytes"), 0.0, None)
        sb = np.clip(num("flow_src_bytes"), 0.0, None)
        tp = np.clip(num("flow_tot_pkts"), 0.0, None)
        db = np.clip(tb - sb, 0.0, None)

        safe_tp = np.where(tp > 0, tp, 1.0)
        safe_dur = np.where(dur > 0, dur, 1.0)
        safe_tb = np.where(tb > 0, tb, 1.0)

        numeric = np.stack(
            [
                np.log1p(dur),
                np.log1p(tb),
                np.log1p(sb),
                np.log1p(db),
                np.log1p(tp),
                np.log1p(tb / safe_tp),   # bytes per packet
                np.log1p(tb / safe_dur),  # bytes per second
                np.log1p(tp / safe_dur),  # packets per second
                sb / safe_tb,             # source byte ratio, already in [0, 1]
            ],
            axis=1,
        ).astype(np.float32)

        # Robust string column -> real numpy unicode array (None/NaN -> "").
        # pandas .astype("U")/.astype(str) yields an OBJECT ndarray, which the
        # np.char.* ufuncs reject ("string operation on non-string array");
        # coerce through np.asarray(dtype="U") to get a genuine <U array.
        def strcol(col: str) -> np.ndarray:
            if col not in edges.columns:
                return np.full(len(order), "", dtype="U")
            return np.asarray(edges[col].fillna("").to_numpy()[order], dtype="U")

        # proto / dir fixed one-hots (+ "other").
        def onehot_vocab(col: str, vocab: tuple) -> np.ndarray:
            vals = strcol(col)
            vals = np.char.strip(np.char.lower(vals)) if col == "flow_proto" else np.char.strip(vals)
            oh = np.zeros((len(order), len(vocab) + 1), dtype=np.float32)
            matched = np.zeros(len(order), dtype=bool)
            for i, token in enumerate(vocab):
                m = vals == token
                oh[m, i] = 1.0
                matched |= m
            oh[~matched, len(vocab)] = 1.0  # "other"
            return oh

        proto_oh = onehot_vocab("flow_proto", SnapshotBuilder._PROTO_VOCAB)
        dir_oh = onehot_vocab("flow_dir", SnapshotBuilder._DIR_VOCAB)

        # state TCP-flag flags (vocab-free: robust across scenarios).
        state = np.char.upper(strcol("flow_state"))

        def has(sub: str) -> np.ndarray:
            return (np.char.find(state, sub) >= 0).astype(np.float32)

        state_flags = np.stack(
            [
                (state == "CON").astype(np.float32),
                has("INT"),
                has("URP"),
                has("S"),
                has("F"),
                has("R"),
                has("A"),
                has("P"),
            ],
            axis=1,
        ).astype(np.float32)

        # port service buckets (never raw port ints).
        def port(col: str) -> np.ndarray:
            if col not in edges.columns:
                return np.full(len(order), np.nan)
            return pd.to_numeric(edges[col], errors="coerce").to_numpy(dtype=np.float64)[order]

        sport = port("flow_sport")
        dport = port("flow_dport")

        dns = dport == 53
        http = (dport == 80) | (dport == 8080)
        https = dport == 443
        smtp = (dport == 25) | (dport == 465) | (dport == 587)
        irc = (dport >= 6660) & (dport <= 7000)
        other = ~(dns | http | https | smtp | irc)

        port_feats = np.stack(
            [
                (sport < 1024).astype(np.float32),
                (sport >= 49152).astype(np.float32),
                (dport < 1024).astype(np.float32),
                (dport >= 49152).astype(np.float32),
                dns.astype(np.float32),
                http.astype(np.float32),
                https.astype(np.float32),
                smtp.astype(np.float32),
                irc.astype(np.float32),
                other.astype(np.float32),
            ],
            axis=1,
        ).astype(np.float32)

        return np.concatenate([numeric, proto_oh, dir_oh, state_flags, port_feats], axis=1)

    # ------------------------------------------------------------------
    # Snapshot generation
    # ------------------------------------------------------------------
    def _window_starts(self, start_ts: Optional[float], end_ts: Optional[float]) -> np.ndarray:
        ts = self.ts
        t_min = float(ts[0]) if start_ts is None else float(start_ts)
        t_max = float(ts[-1]) if end_ts is None else float(end_ts)

        # Grid cell of every event, then expand backwards so that each event is
        # also covered by the earlier overlapping windows.
        cells = np.floor((ts - t_min) / self.stride_s).astype(np.int64)
        cells = cells[(ts >= t_min) & (ts <= t_max)]
        if cells.size == 0:
            return np.zeros(0, dtype=np.float64)

        span = max(1, int(math.ceil(self.window_size_s / self.stride_s)))
        candidates = np.unique(
            np.concatenate([cells - k for k in range(span)])
        )
        candidates = candidates[candidates >= 0]
        return t_min + candidates.astype(np.float64) * self.stride_s

    def iter_snapshots(
        self,
        start_ts: Optional[float] = None,
        end_ts: Optional[float] = None,
    ) -> Iterator[TemporalSnapshot]:
        """Yield sliding-window snapshots over the graph edges."""
        if self.ts.size == 0:
            return

        emitted = 0
        for w_start in self._window_starts(start_ts, end_ts):
            w_end = w_start + self.window_size_s
            lo = int(np.searchsorted(self.ts, w_start, side="left"))
            hi = int(np.searchsorted(self.ts, w_end, side="left"))
            if hi <= lo:
                continue
            if self.max_edges_per_snapshot and (hi - lo) > self.max_edges_per_snapshot:
                hi = lo + self.max_edges_per_snapshot

            yield self._build_snapshot(lo, hi, float(w_start), float(w_end))
            emitted += 1
            if self.max_snapshots and emitted >= self.max_snapshots:
                return

    def _build_snapshot(
        self,
        lo: int,
        hi: int,
        window_start: float,
        window_end: float,
    ) -> TemporalSnapshot:
        src = self.src[lo:hi]
        dst = self.dst[lo:hi]
        rel = self.rel[lo:hi]
        ts = self.ts[lo:hi]
        lab = self.elabel[lo:hi]

        # Local re-indexing of the nodes touched in this window.
        globals_, inverse = np.unique(np.concatenate([src, dst]), return_inverse=True)
        n_edges = hi - lo
        src_local = inverse[:n_edges]
        dst_local = inverse[n_edges:]
        edge_index = np.stack([src_local, dst_local]).astype(np.int64)

        # Edge features: relation one-hot (+ normalised in-window time).
        num_rel = len(self.dataset.relations)
        rel_onehot = np.zeros((n_edges, num_rel), dtype=np.float32)
        rel_onehot[np.arange(n_edges), rel] = 1.0
        denom = window_end - window_start
        rel_time = ((ts - window_start) / denom if denom > 0 else np.zeros(n_edges))
        rel_time = rel_time.astype(np.float32).reshape(-1, 1)
        if self.edge_feature_mode == "relation_time":
            edge_attr = np.concatenate([rel_onehot, rel_time], axis=1)
        elif self.edge_feature_mode == "relation_only":
            edge_attr = rel_onehot
        elif self.edge_feature_mode == "flow":
            # relation one-hot (constant for CTU-13) + per-flow numeric/categorical
            # features + relative in-window time.
            flow = self.flow_feats[lo:hi]
            edge_attr = np.concatenate([rel_onehot, flow, rel_time], axis=1)
        else:
            raise ValueError(f"Unknown edge_feature_mode: {self.edge_feature_mode}")

        # Node features / types straight from the precomputed matrix.
        x = self.node_features[globals_]
        node_types = self.node_type_index[globals_]
        node_ids = self.node_ids_arr[globals_].tolist()

        # Node label = 1 iff the node is the SOURCE of a malicious edge in this
        # window. Marking both endpoints (the old behaviour) mislabels every
        # victim / scanned host / C2 destination as an attacker. For CTU-13 the
        # bot originates the malicious flow, so source-only is the correct
        # (auxiliary) node target; edge-level is the headline metric.
        node_labels = np.zeros(len(globals_), dtype=np.int64)
        np.maximum.at(node_labels, src_local, lab)

        snapshot_label = int(lab.max()) if n_edges else 0

        return TemporalSnapshot(
            ts_start=window_start,
            ts_end=window_end,
            node_ids=node_ids,
            node_types=node_types,
            x=x.astype(np.float32),
            edge_index=edge_index,
            edge_attr=edge_attr.astype(np.float32),
            edge_labels=lab.astype(np.int64),
            node_labels=node_labels,
            snapshot_label=snapshot_label,
            num_events=n_edges,
            scenario_id=self.scenario_id,
        )

    def build_all(
        self,
        start_ts: Optional[float] = None,
        end_ts: Optional[float] = None,
    ) -> List[TemporalSnapshot]:
        return list(self.iter_snapshots(start_ts, end_ts))
