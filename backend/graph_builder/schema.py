"""Unified event schema for TG-Detect temporal heterogeneous graph construction.

Every dataset-specific parser must emit `TGEvent` objects so that all downstream
code (normalizer, builder, attack tracker, exporters) stays dataset-agnostic.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

import pyarrow as pa


class NodeType(str, Enum):
    USER = "USER"
    HOST = "HOST"
    PROCESS = "PROCESS"
    FILE = "FILE"
    IP = "IP"
    DOMAIN = "DOMAIN"
    SOCKET = "SOCKET"
    UNKNOWN = "UNKNOWN"


class RelationType(str, Enum):
    LOGON = "LOGON"
    EXECUTES = "EXECUTES"
    READS = "READS"
    WRITES = "WRITES"
    DELETES = "DELETES"
    CONNECTS_TO = "CONNECTS_TO"
    AUTHENTICATES_TO = "AUTHENTICATES_TO"
    NETWORK_FLOW = "NETWORK_FLOW"
    EXPLOIT = "EXPLOIT"
    LATERAL_MOVE = "LATERAL_MOVE"
    EXFILTRATE = "EXFILTRATE"
    DISCOVER = "DISCOVER"
    IMPACT = "IMPACT"
    GENERIC = "GENERIC"


NODE_TYPES = [t.value for t in NodeType]
RELATION_TYPES = [t.value for t in RelationType]

# Canonical short prefix used when building `type:value` node ids.
NODE_TYPE_PREFIX: Dict[str, str] = {
    NodeType.USER.value: "user",
    NodeType.HOST.value: "host",
    NodeType.PROCESS.value: "process",
    NodeType.FILE.value: "file",
    NodeType.IP.value: "ip",
    NodeType.DOMAIN.value: "domain",
    NodeType.SOCKET.value: "socket",
    NodeType.UNKNOWN.value: "entity",
}

PREFIX_TO_NODE_TYPE: Dict[str, str] = {v: k for k, v in NODE_TYPE_PREFIX.items()}


@dataclass
class TGEvent:
    """A single normalized temporal graph event (one typed, timestamped edge)."""

    event_id: str
    ts: float

    src_id: str
    src_type: str

    dst_id: str
    dst_type: str

    relation: str

    label: int = 0
    tactics: List[str] = field(default_factory=list)

    apt_stage: Optional[str] = None
    source_tag: str = ""
    chain_id: Optional[str] = None
    causal_parent: Optional[str] = None

    attrs: Dict[str, Any] = field(default_factory=dict)

    def to_row(self) -> Dict[str, Any]:
        """Flatten for columnar (parquet) storage.

        `attrs` is serialized to a JSON string so that heterogeneous per-dataset
        keys can never break the arrow schema across row groups.
        """
        return {
            "event_id": self.event_id,
            "ts": float(self.ts),
            "src_id": self.src_id,
            "src_type": self.src_type,
            "dst_id": self.dst_id,
            "dst_type": self.dst_type,
            "relation": self.relation,
            "label": int(self.label),
            "tactics": list(self.tactics or []),
            "apt_stage": None if self.apt_stage is None else str(self.apt_stage),
            "source_tag": self.source_tag or "",
            "chain_id": self.chain_id,
            "causal_parent": self.causal_parent,
            "attrs": json.dumps(self.attrs, default=str),
        }

    def edge_row(self) -> Dict[str, Any]:
        """Thinner projection used for the edge table."""
        return {
            "event_id": self.event_id,
            "src_id": self.src_id,
            "dst_id": self.dst_id,
            "relation": self.relation,
            "ts": float(self.ts),
            "label": int(self.label),
            "chain_id": self.chain_id,
            "causal_parent": self.causal_parent,
            "source_tag": self.source_tag or "",
        }


EVENT_SCHEMA = pa.schema(
    [
        pa.field("event_id", pa.string()),
        pa.field("ts", pa.float64()),
        pa.field("src_id", pa.string()),
        pa.field("src_type", pa.string()),
        pa.field("dst_id", pa.string()),
        pa.field("dst_type", pa.string()),
        pa.field("relation", pa.string()),
        pa.field("label", pa.int8()),
        pa.field("tactics", pa.list_(pa.string())),
        pa.field("apt_stage", pa.string()),
        pa.field("source_tag", pa.string()),
        pa.field("chain_id", pa.string()),
        pa.field("causal_parent", pa.string()),
        pa.field("attrs", pa.string()),
    ]
)

EDGE_SCHEMA = pa.schema(
    [
        pa.field("event_id", pa.string()),
        pa.field("src_id", pa.string()),
        pa.field("dst_id", pa.string()),
        pa.field("relation", pa.string()),
        pa.field("ts", pa.float64()),
        pa.field("label", pa.int8()),
        pa.field("chain_id", pa.string()),
        pa.field("causal_parent", pa.string()),
        pa.field("source_tag", pa.string()),
    ]
)

NODE_SCHEMA = pa.schema(
    [
        pa.field("node_id", pa.string()),
        pa.field("node_type", pa.string()),
        pa.field("first_seen_ts", pa.float64()),
        pa.field("last_seen_ts", pa.float64()),
        pa.field("out_degree", pa.int64()),
        pa.field("in_degree", pa.int64()),
        pa.field("malicious_events", pa.int64()),
    ]
)

CHAIN_SCHEMA = pa.schema(
    [
        pa.field("chain_id", pa.string()),
        pa.field("strategy", pa.string()),
        pa.field("num_events", pa.int64()),
        pa.field("num_nodes", pa.int64()),
        pa.field("start_ts", pa.float64()),
        pa.field("end_ts", pa.float64()),
        pa.field("duration_s", pa.float64()),
        pa.field("tactic_sequence", pa.list_(pa.string())),
        pa.field("stage_sequence", pa.list_(pa.string())),
        pa.field("relation_sequence", pa.list_(pa.string())),
        pa.field("nodes", pa.list_(pa.string())),
        pa.field("event_ids", pa.list_(pa.string())),
    ]
)
