"""Temporal Graph Neural Network for multi-step attack detection.

This module uses PyTorch Geometric (PyG). If PyG is not installed the import
will fail with a clear error pointing to `requirements-ml.txt`.
"""

from __future__ import annotations

from typing import Optional, Tuple

import numpy as np

# Framework guard: provide a helpful message instead of a cryptic import error.
try:
    import torch
    import torch.nn as nn
    from torch_geometric.nn import GCNConv, SAGEConv, global_max_pool
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "TGNN models require PyTorch and PyTorch Geometric. "
        "Install them with: pip install -r requirements-ml.txt"
    ) from exc


class TemporalGNN(nn.Module):
    """Baseline TGNN: GNN per snapshot + GRU over node embeddings across time.

    The model processes a sequence of snapshot graphs and predicts a
    maliciousness score for every node (or edge) in the final snapshot.
    """

    def __init__(
        self,
        in_channels: int,
        edge_dim: int,
        hidden_channels: int = 64,
        out_channels: int = 64,
        num_gnn_layers: int = 2,
        num_rnn_layers: int = 1,
        dropout: float = 0.3,
        node_types: Optional[int] = None,
        num_relations: Optional[int] = None,
    ) -> None:
        super().__init__()

        self.in_channels = in_channels
        self.edge_dim = edge_dim
        self.hidden_channels = hidden_channels
        self.out_channels = out_channels
        self.num_gnn_layers = num_gnn_layers
        self.dropout = dropout

        # Optional learned embeddings for heterogeneous types.
        self.node_type_embedding: Optional[nn.Embedding] = None
        self.relation_embedding: Optional[nn.Embedding] = None

        # Node type is already one-hot encoded inside `x` by the snapshot
        # builder, so no extra embedding is concatenated here; the GNN input
        # width must match x exactly.
        gnn_input = in_channels
        if num_relations and edge_dim == 0:
            self.relation_embedding = nn.Embedding(num_relations, 16)
            edge_dim = 16


        # GNN layers operate on each snapshot independently.
        self.convs = nn.ModuleList()
        self.edge_encoders = nn.ModuleList()
        self.batch_norms = nn.ModuleList()

        for i in range(num_gnn_layers):
            in_ch = gnn_input if i == 0 else hidden_channels
            # GraphSAGE is robust to unseen nodes (OOD scenarios).
            self.convs.append(SAGEConv(in_ch, hidden_channels))
            if edge_dim > 0:
                self.edge_encoders.append(nn.Linear(edge_dim, hidden_channels))
            else:
                self.edge_encoders.append(None)
            self.batch_norms.append(nn.BatchNorm1d(hidden_channels))

        # RNN layers aggregate node embeddings across snapshots.
        # NOTE: `sequence` is shaped [T, N, H] = [time, nodes, features]. With
        # batch_first=False the GRU treats dim 0 as the SEQUENCE (time) axis and
        # dim 1 as the batch (nodes) — i.e. recurrence runs over time, per node,
        # which is the whole point of a temporal GNN. (batch_first=True made it
        # recur over nodes with time as the batch — a silent correctness bug.)
        self.gru = nn.GRU(
            input_size=hidden_channels,
            hidden_size=out_channels,
            num_layers=num_rnn_layers,
            batch_first=False,
            dropout=dropout if num_rnn_layers > 1 else 0.0,
        )

        # Final classifiers.
        self.node_classifier = nn.Linear(out_channels, 1)
        self.snapshot_classifier = nn.Linear(out_channels, 1)
        # Edge (per-flow) head: concat of the two endpoint embeddings. This is
        # the headline target for CTU-13 (thousands of positive flows).
        self.edge_classifier = nn.Linear(2 * out_channels, 1)

        self.dropout_layer = nn.Dropout(dropout)

    def _encode_snapshot(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: Optional[torch.Tensor],
    ) -> torch.Tensor:
        """Run the GNN stack on a single snapshot."""
        h = x

        num_nodes = x.size(0)
        for conv, edge_enc, bn in zip(self.convs, self.edge_encoders, self.batch_norms):
            h = conv(h, edge_index)  # [N, hidden]

            if (
                edge_attr is not None
                and edge_enc is not None
                and edge_index.numel() > 0
            ):
                # Encode each edge, then mean-aggregate messages onto BOTH
                # endpoints. Aggregating onto the destination only starves
                # pure-source actors (scanners / DDoS bots / C2 initiators) of
                # any edge signal — exactly the CTU-13 attacker profile.
                edge_msg = torch.relu(edge_enc(edge_attr))  # [E, hidden]
                agg = torch.zeros_like(h)
                counts = torch.zeros(num_nodes, 1, device=h.device)
                ones = torch.ones(edge_index.size(1), 1, device=h.device)
                for endpoint in (edge_index[0], edge_index[1]):
                    agg.index_add_(0, endpoint, edge_msg)
                    counts.index_add_(0, endpoint, ones)
                h = h + agg / counts.clamp(min=1.0)

            h = torch.relu(h)
            # BatchNorm needs >1 sample in train mode; tiny snapshots are common.
            if not (self.training and h.size(0) < 2):
                h = bn(h)
            h = self.dropout_layer(h)
        return h


    def forward(
        self,
        snapshots: list[dict],
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Forward pass over a sequence of snapshots.

        Args:
            snapshots: list of snapshot dicts with keys
                x, edge_index, edge_attr, node_labels, snapshot_label.

        Returns:
            node_logits: [N, 1] logits for nodes in the last snapshot
            snapshot_logit: [1] logit for the last snapshot
            edge_logits: [E, 1] logits for edges (flows) in the last snapshot
        """
        if not snapshots:
            raise ValueError("Empty snapshot sequence")

        # Keep every tensor on the same device as the model weights.
        device = next(self.parameters()).device

        # GNN over each snapshot -> list of [N_t, hidden] tensors.
        snapshot_embeddings = []
        for snap in snapshots:
            x = torch.from_numpy(snap["x"]).float().to(device)
            edge_index = torch.from_numpy(snap["edge_index"]).long().to(device)
            edge_attr = (
                torch.from_numpy(snap["edge_attr"]).float().to(device)
                if snap.get("edge_attr") is not None and snap["edge_attr"].size > 0
                else None
            )
            h = self._encode_snapshot(x, edge_index, edge_attr)
            snapshot_embeddings.append(h)

        # Pad/truncate to a common node set for the GRU.
        # Simplification: track only nodes that appear in the last snapshot.
        last_snap = snapshots[-1]
        last_node_ids = last_snap["node_ids"]

        T = len(snapshot_embeddings)
        N = len(last_node_ids)
        node_id_to_last_idx = {nid: i for i, nid in enumerate(last_node_ids)}
        sequence = torch.zeros(T, N, self.hidden_channels, device=device)

        # Vectorised scatter: build index pairs once per snapshot with numpy,
        # then do a single index_copy_ instead of a Python loop per node.
        for t, (snap, emb) in enumerate(zip(snapshots, snapshot_embeddings)):
            src_idx = []
            dst_idx = []
            for local_idx, nid in enumerate(snap["node_ids"]):
                j = node_id_to_last_idx.get(nid)
                if j is not None:
                    src_idx.append(local_idx)
                    dst_idx.append(j)
            if not dst_idx:
                continue
            src = torch.as_tensor(src_idx, dtype=torch.long, device=device)
            dst = torch.as_tensor(dst_idx, dtype=torch.long, device=device)
            sequence[t].index_copy_(0, dst, emb.index_select(0, src))

        # GRU over time for each node.
        rnn_out, _ = self.gru(sequence)  # [T, N, out_channels]
        final_node_emb = rnn_out[-1]  # [N, out_channels]

        node_logits = self.node_classifier(final_node_emb)  # [N, 1]
        # Plain max over nodes: same as global_max_pool for a single graph and
        # avoids the slow scatter fallback when torch-scatter is absent.
        snapshot_emb = final_node_emb.max(dim=0, keepdim=True).values
        snapshot_logit = self.snapshot_classifier(snapshot_emb)  # [1, 1]

        # Edge (per-flow) logits for the last snapshot. Its edge_index is in
        # local node indices aligned with last_node_ids, so it indexes
        # final_node_emb directly.
        last_edge_index = torch.from_numpy(last_snap["edge_index"]).long().to(device)
        if last_edge_index.numel() > 0:
            src_emb = final_node_emb.index_select(0, last_edge_index[0])
            dst_emb = final_node_emb.index_select(0, last_edge_index[1])
            edge_logits = self.edge_classifier(torch.cat([src_emb, dst_emb], dim=1))
        else:
            edge_logits = torch.zeros((0, 1), device=device)

        return node_logits, snapshot_logit.squeeze(-1), edge_logits

    def load_state_dict(self, state_dict, strict: bool = True, assign: bool = False):
        """Load state dict with backward compatibility for legacy checkpoints.

        Legacy checkpoints (e.g. Mordor) lack edge_classifier weights; if strict=True
        and edge_classifier is not present in state_dict, fall back to non-strict
        loading to allow legacy models to load seamlessly.
        """
        if strict and "edge_classifier.weight" not in state_dict:
            return super().load_state_dict(state_dict, strict=False, assign=assign)
        return super().load_state_dict(state_dict, strict=strict, assign=assign)

