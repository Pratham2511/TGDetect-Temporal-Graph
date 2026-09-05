"""Temporal heterogeneous graph builders.

`TemporalGraphBuilder`  — NetworkX MultiDiGraph, for correctness work / small runs.
`StreamingGraphBuilder` — keeps only the node table in RAM; edges stream to disk.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, Iterable, Iterator, List, Optional

from .schema import TGEvent


class GraphStats:
    def __init__(self) -> None:
        self.total_events = 0
        self.benign_events = 0
        self.malicious_events = 0
        self.node_types: Counter = Counter()
        self.relation_types: Counter = Counter()
        self.source_tags: Counter = Counter()
        self.tactics: Counter = Counter()
        self.min_ts: Optional[float] = None
        self.max_ts: Optional[float] = None
        self.out_of_order_events = 0
        self._last_ts: Optional[float] = None

    def observe(self, event: TGEvent, new_nodes: Iterable[tuple[str, str]] = ()) -> None:
        self.total_events += 1
        if event.label == 1:
            self.malicious_events += 1
        else:
            self.benign_events += 1
        self.relation_types[event.relation] += 1
        self.source_tags[event.source_tag or "unknown"] += 1
        for tactic in event.tactics or []:
            self.tactics[tactic] += 1
        for _, node_type in new_nodes:
            self.node_types[node_type] += 1

        ts = event.ts
        self.min_ts = ts if self.min_ts is None else min(self.min_ts, ts)
        self.max_ts = ts if self.max_ts is None else max(self.max_ts, ts)
        if self._last_ts is not None and ts < self._last_ts:
            self.out_of_order_events += 1
        self._last_ts = ts

    def as_dict(self, num_nodes: int = 0) -> Dict[str, Any]:
        return {
            "total_events": self.total_events,
            "total_nodes": num_nodes,
            "total_edges": self.total_events,
            "benign_events": self.benign_events,
            "malicious_events": self.malicious_events,
            "node_types": dict(self.node_types),
            "relation_types": dict(self.relation_types),
            "source_tags": dict(self.source_tags),
            "tactics": dict(self.tactics),
            "earliest_timestamp": self.min_ts,
            "latest_timestamp": self.max_ts,
            "timestamp_span_s": (
                None if self.min_ts is None or self.max_ts is None else self.max_ts - self.min_ts
            ),
            "out_of_order_events": self.out_of_order_events,
        }


class StreamingGraphBuilder:
    """Memory use scales with the number of *distinct entities*, not events."""

    def __init__(self) -> None:
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.stats = GraphStats()

    def _touch(self, node_id: str, node_type: str, ts: float, *, out: bool,
               malicious: bool) -> bool:
        node = self.nodes.get(node_id)
        is_new = node is None
        if node is None:
            node = {
                "node_id": node_id,
                "node_type": node_type,
                "first_seen_ts": ts,
                "last_seen_ts": ts,
                "out_degree": 0,
                "in_degree": 0,
                "malicious_events": 0,
            }
            self.nodes[node_id] = node
        else:
            if ts < node["first_seen_ts"]:
                node["first_seen_ts"] = ts
            if ts > node["last_seen_ts"]:
                node["last_seen_ts"] = ts
            if node["node_type"] == "UNKNOWN" and node_type != "UNKNOWN":
                node["node_type"] = node_type
        node["out_degree" if out else "in_degree"] += 1
        if malicious:
            node["malicious_events"] += 1
        return is_new

    def add_event(self, event: TGEvent) -> None:
        malicious = event.label == 1
        new_nodes: List[tuple[str, str]] = []
        if self._touch(event.src_id, event.src_type, event.ts, out=True, malicious=malicious):
            new_nodes.append((event.src_id, event.src_type))
        if self._touch(event.dst_id, event.dst_type, event.ts, out=False, malicious=malicious):
            new_nodes.append((event.dst_id, event.dst_type))
        self.stats.observe(event, new_nodes)

    def add_events(self, events: Iterable[TGEvent]) -> Iterator[TGEvent]:
        """Pass-through generator so the builder can sit inside a stream."""
        for event in events:
            self.add_event(event)
            yield event

    def node_rows(self) -> Iterator[Dict[str, Any]]:
        return iter(self.nodes.values())

    def summary(self) -> Dict[str, Any]:
        return self.stats.as_dict(num_nodes=len(self.nodes))


class TemporalGraphBuilder(StreamingGraphBuilder):
    """Additionally materializes a NetworkX MultiDiGraph for debugging/analysis."""

    def __init__(self) -> None:
        super().__init__()
        import networkx as nx  # imported lazily: only needed for debug runs

        self.graph = nx.MultiDiGraph()

    def add_event(self, event: TGEvent) -> None:
        super().add_event(event)
        self.graph.add_node(
            event.src_id,
            node_type=event.src_type,
            first_seen_ts=self.nodes[event.src_id]["first_seen_ts"],
            last_seen_ts=self.nodes[event.src_id]["last_seen_ts"],
        )
        self.graph.add_node(
            event.dst_id,
            node_type=event.dst_type,
            first_seen_ts=self.nodes[event.dst_id]["first_seen_ts"],
            last_seen_ts=self.nodes[event.dst_id]["last_seen_ts"],
        )
        self.graph.add_edge(
            event.src_id,
            event.dst_id,
            key=event.event_id,
            event_id=event.event_id,
            ts=event.ts,
            relation=event.relation,
            label=event.label,
            tactics=list(event.tactics or []),
            apt_stage=event.apt_stage,
            chain_id=event.chain_id,
            causal_parent=event.causal_parent,
            source_tag=event.source_tag,
            attrs=event.attrs,
        )

    def summary(self) -> Dict[str, Any]:
        base = super().summary()
        base["networkx_nodes"] = self.graph.number_of_nodes()
        base["networkx_edges"] = self.graph.number_of_edges()
        return base
