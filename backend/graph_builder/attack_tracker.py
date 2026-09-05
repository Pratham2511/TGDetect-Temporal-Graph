"""Attack chain / attack subgraph reconstruction.

Three pluggable strategies, usable independently or in priority order:

  ChainIdTracker      ground-truth `chain_id` grouping
  CausalParentTracker `causal_parent` link walking
  EntityTimeTracker   shared-entity + temporal-proximity inference (no ground truth)
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence

from .schema import TGEvent


@dataclass
class AttackChain:
    chain_id: str
    strategy: str
    events: List[TGEvent] = field(default_factory=list)

    @property
    def ordered(self) -> List[TGEvent]:
        return sorted(self.events, key=lambda e: e.ts)

    def nodes(self) -> List[str]:
        seen: List[str] = []
        for event in self.ordered:
            for node in (event.src_id, event.dst_id):
                if node not in seen:
                    seen.append(node)
        return seen

    def to_row(self) -> Dict[str, Any]:
        ordered = self.ordered
        start = ordered[0].ts if ordered else 0.0
        end = ordered[-1].ts if ordered else 0.0
        nodes = self.nodes()
        tactic_sequence: List[str] = []
        for event in ordered:
            for tactic in event.tactics or []:
                if not tactic_sequence or tactic_sequence[-1] != tactic:
                    tactic_sequence.append(tactic)
        return {
            "chain_id": self.chain_id,
            "strategy": self.strategy,
            "num_events": len(ordered),
            "num_nodes": len(nodes),
            "start_ts": start,
            "end_ts": end,
            "duration_s": end - start,
            "tactic_sequence": tactic_sequence,
            "stage_sequence": [e.apt_stage or "" for e in ordered],
            "relation_sequence": [e.relation for e in ordered],
            "nodes": nodes,
            "event_ids": [e.event_id for e in ordered],
        }

    def to_subgraph(self) -> Dict[str, Any]:
        ordered = self.ordered
        node_types: Dict[str, str] = {}
        for event in ordered:
            node_types.setdefault(event.src_id, event.src_type)
            node_types.setdefault(event.dst_id, event.dst_type)
        return {
            "chain_id": self.chain_id,
            "strategy": self.strategy,
            "nodes": [{"id": n, "node_type": t} for n, t in node_types.items()],
            "edges": [e.edge_row() | {"tactics": e.tactics, "apt_stage": e.apt_stage}
                      for e in ordered],
        }


class BaseTracker:
    name = "base"

    def track(self, events: Sequence[TGEvent]) -> List[AttackChain]:  # pragma: no cover
        raise NotImplementedError


class ChainIdTracker(BaseTracker):
    """Group malicious events by ground-truth chain_id."""

    name = "chain_id"

    def track(self, events: Sequence[TGEvent]) -> List[AttackChain]:
        groups: Dict[str, AttackChain] = {}
        for event in events:
            if not event.chain_id:
                continue
            chain = groups.get(event.chain_id)
            if chain is None:
                chain = AttackChain(chain_id=event.chain_id, strategy=self.name)
                groups[event.chain_id] = chain
            chain.events.append(event)
        return sorted(groups.values(), key=lambda c: c.ordered[0].ts if c.events else 0.0)


class CausalParentTracker(BaseTracker):
    """Walk causal_parent links into ordered causal paths (union-find over links)."""

    name = "causal_parent"

    def __init__(self) -> None:
        self.dangling_parents: List[str] = []

    def track(self, events: Sequence[TGEvent]) -> List[AttackChain]:
        by_id = {e.event_id: e for e in events}
        parent: Dict[str, str] = {e.event_id: e.event_id for e in events}

        def find(x: str) -> str:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a: str, b: str) -> None:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[rb] = ra

        self.dangling_parents = []
        for event in events:
            if not event.causal_parent:
                continue
            if event.causal_parent in by_id:
                union(event.causal_parent, event.event_id)
            else:
                self.dangling_parents.append(event.event_id)

        groups: Dict[str, AttackChain] = {}
        for event in events:
            root = find(event.event_id)
            chain = groups.get(root)
            if chain is None:
                chain = AttackChain(chain_id=f"causal_{root}", strategy=self.name)
                groups[root] = chain
            chain.events.append(event)

        return [c for c in sorted(groups.values(), key=lambda c: c.ordered[0].ts)
                if len(c.events) > 1]


class EntityTimeTracker(BaseTracker):
    """Infer chains from shared entities within a time window (no ground truth needed).

    Seeds on malicious events, then expands to events that share an entity and
    occur within `window_s`, up to `max_hops` expansions.
    """

    name = "entity_time"

    def __init__(self, window_s: float = 86400.0, max_hops: int = 2) -> None:
        self.window_s = window_s
        self.max_hops = max_hops

    def track(self, events: Sequence[TGEvent]) -> List[AttackChain]:
        ordered = sorted(events, key=lambda e: e.ts)
        by_entity: Dict[str, List[TGEvent]] = defaultdict(list)
        for event in ordered:
            by_entity[event.src_id].append(event)
            by_entity[event.dst_id].append(event)

        visited: set[str] = set()
        chains: List[AttackChain] = []

        for seed in ordered:
            if seed.event_id in visited or seed.label != 1:
                continue
            cluster: Dict[str, TGEvent] = {seed.event_id: seed}
            frontier = [(seed, 0)]
            visited.add(seed.event_id)

            while frontier:
                current, hop = frontier.pop()
                if hop >= self.max_hops:
                    continue
                for entity in (current.src_id, current.dst_id):
                    for candidate in by_entity.get(entity, ()):
                        if candidate.event_id in cluster:
                            continue
                        if abs(candidate.ts - current.ts) > self.window_s:
                            continue
                        cluster[candidate.event_id] = candidate
                        visited.add(candidate.event_id)
                        frontier.append((candidate, hop + 1))

            if len(cluster) > 1:
                chain = AttackChain(
                    chain_id=f"inferred_{seed.event_id}", strategy=self.name
                )
                chain.events = list(cluster.values())
                chains.append(chain)

        return chains


class AttackTracker:
    """Collects malicious events while streaming, then reconstructs chains."""

    def __init__(
        self,
        strategies: Optional[Sequence[str]] = None,
        window_s: float = 86400.0,
        max_hops: int = 2,
        max_events: int = 2_000_000,
    ) -> None:
        self.strategies = list(strategies or ["chain_id", "causal_parent", "entity_time"])
        self.window_s = window_s
        self.max_hops = max_hops
        self.max_events = max_events
        self.malicious: List[TGEvent] = []
        self.dropped = 0

    def observe(self, event: TGEvent) -> None:
        if event.label != 1:
            return
        if len(self.malicious) >= self.max_events:
            self.dropped += 1
            return
        self.malicious.append(event)

    def observe_stream(self, events: Iterable[TGEvent]):
        for event in events:
            self.observe(event)
            yield event

    def build_chains(self) -> Dict[str, List[AttackChain]]:
        """Apply strategies in priority order; each strategy only sees the
        malicious events not already grouped by a higher-priority strategy."""
        results: Dict[str, List[AttackChain]] = {}
        remaining = list(self.malicious)
        self.dangling_parents: List[str] = []

        for name in self.strategies:
            if not remaining:
                results[name] = []
                continue
            if name == "chain_id":
                tracker: BaseTracker = ChainIdTracker()
            elif name == "causal_parent":
                tracker = CausalParentTracker()
            elif name == "entity_time":
                tracker = EntityTimeTracker(self.window_s, self.max_hops)
            else:
                raise KeyError(f"Unknown attack-tracking strategy '{name}'")

            chains = tracker.track(remaining)
            results[name] = chains
            if isinstance(tracker, CausalParentTracker):
                self.dangling_parents = tracker.dangling_parents

            grouped = {e.event_id for c in chains for e in c.events}
            remaining = [e for e in remaining if e.event_id not in grouped]

        self.ungrouped = remaining
        return results

    def summary(self, results: Dict[str, List[AttackChain]]) -> Dict[str, Any]:
        sizes = Counter()
        total_chains = 0
        for name, chains in results.items():
            total_chains += len(chains)
            for chain in chains:
                sizes[len(chain.events)] += 1
        return {
            "malicious_events_tracked": len(self.malicious),
            "malicious_events_dropped": self.dropped,
            "total_chains": total_chains,
            "chains_by_strategy": {k: len(v) for k, v in results.items()},
            "events_per_chain_histogram": dict(sorted(sizes.items())),
            "ungrouped_malicious_events": len(getattr(self, "ungrouped", [])),
            "dangling_causal_parents": len(getattr(self, "dangling_parents", [])),
        }
