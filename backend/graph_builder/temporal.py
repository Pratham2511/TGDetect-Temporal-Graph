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
    ) -> None:
        self.dataset = dataset
        self.window_size_s = float(window_size_s)
        self.stride_s = float(stride_s or window_size_s / 2.0)
        self.node_feature_mode = node_feature_mode
        self.edge_feature_mode = edge_feature_mode
        self.max_snapshots = max_snapshots
        self.max_edges_per_snapshot = max_edges_per_snapshot

        self._prepare_node_features()
        self._prepare_edge_arrays()

    # ------------------------------------------------------------------
    # Pre-computation
    # ------------------------------------------------------------------
    def _prepare_node_features(self) -> None:
        """Dense [num_nodes, F] feature matrix keyed by global node index."""
        nodes = self.dataset.nodes
        n = len(nodes)
        num_types = len(self.dataset.node_types)

        type_idx = (
            nodes["node_type"].map(self.dataset.node_type_to_index).fillna(0).to_numpy(dtype=np.int64)
        )
        onehot = np.zeros((n, num_types), dtype=np.float32)
        onehot[np.arange(n), type_idx] = 1.0

        out_deg = nodes["out_degree"].to_numpy(dtype=np.float32)
        in_deg = nodes["in_degree"].to_numpy(dtype=np.float32)
        degree = out_deg + in_deg
        mal = nodes["malicious_events"].to_numpy(dtype=np.float32)
        mal_ratio = mal / np.where(degree == 0, 1.0, degree)

        if self.node_feature_mode == "type_degree":
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
        if self.edge_feature_mode == "relation_time":
            denom = window_end - window_start
            rel_time = ((ts - window_start) / denom if denom > 0 else np.zeros(n_edges))
            edge_attr = np.concatenate(
                [rel_onehot, rel_time.astype(np.float32).reshape(-1, 1)], axis=1
            )
        elif self.edge_feature_mode == "relation_only":
            edge_attr = rel_onehot
        else:
            raise ValueError(f"Unknown edge_feature_mode: {self.edge_feature_mode}")

        # Node features / types straight from the precomputed matrix.
        x = self.node_features[globals_]
        node_types = self.node_type_index[globals_]
        node_ids = self.node_ids_arr[globals_].tolist()

        # Node label = 1 if the node touches any malicious edge in this window.
        node_labels = np.zeros(len(globals_), dtype=np.int64)
        np.maximum.at(node_labels, src_local, lab)
        np.maximum.at(node_labels, dst_local, lab)

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
        )

    def build_all(
        self,
        start_ts: Optional[float] = None,
        end_ts: Optional[float] = None,
    ) -> List[TemporalSnapshot]:
        return list(self.iter_snapshots(start_ts, end_ts))
