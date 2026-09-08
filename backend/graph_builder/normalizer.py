"""Entity typing, ID canonicalization, timestamp coercion and validation."""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Iterable, Iterator, Optional, Tuple

from .schema import (
    NODE_TYPE_PREFIX,
    PREFIX_TO_NODE_TYPE,
    NodeType,
    RelationType,
    TGEvent,
)

_IPV4 = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
_IPV6 = re.compile(r"^[0-9A-Fa-f:]+:[0-9A-Fa-f:]*$")
_DOMAIN = re.compile(r"^(?=.{1,253}$)([A-Za-z0-9_-]+\.)+[A-Za-z]{2,}$")

# Windows FILETIME epoch offset (100ns intervals since 1601-01-01).
_FILETIME_OFFSET = 116444736000000000
_FILETIME_PER_SEC = 10_000_000


def infer_node_type(raw_id: str, hint: Optional[str] = None) -> str:
    """Best-effort node typing from an untyped entity string."""
    if hint:
        h = hint.strip().upper()
        if h in NodeType.__members__:
            return h

    if not raw_id:
        return NodeType.UNKNOWN.value

    value = raw_id.strip()
    lowered = value.lower()

    # Already canonical `type:value`.
    if ":" in value:
        prefix = lowered.split(":", 1)[0]
        if prefix in PREFIX_TO_NODE_TYPE:
            return PREFIX_TO_NODE_TYPE[prefix]

    if _IPV4.match(value) or (_IPV6.match(value) and value.count(":") >= 2):
        return NodeType.IP.value

    if lowered.startswith(("apt_actor", "user_", "usr_", "account_")):
        return NodeType.USER.value
    if lowered.startswith(("external_ip", "ip_", "src_ip", "dst_ip")):
        return NodeType.IP.value
    if lowered.startswith(
        ("internal_target", "critical_server", "sys_", "host_", "server_", "workstation")
    ):
        return NodeType.HOST.value
    if lowered.startswith(("process_", "proc_", "pid_")) or lowered.endswith(
        (".exe", ".dll", ".ps1", ".bat", ".vbs")
    ):
        return NodeType.PROCESS.value
    if value.startswith(("/", "\\", "C:\\", "c:\\")) or lowered.startswith("file_"):
        return NodeType.FILE.value
    if lowered.startswith("domain_") or _DOMAIN.match(value):
        return NodeType.DOMAIN.value
    if lowered.startswith("socket"):
        return NodeType.SOCKET.value

    return NodeType.UNKNOWN.value


def canonical_id(raw_id: str, node_type: str) -> str:
    """Return a stable `type:value` node id."""
    value = (raw_id or "").strip()
    prefix = NODE_TYPE_PREFIX.get(node_type, "entity")
    if ":" in value:
        head, tail = value.split(":", 1)
        if head.lower() in PREFIX_TO_NODE_TYPE and tail:
            return f"{prefix}:{tail}"
    return f"{prefix}:{value}"


def coerce_ts(value: Any) -> Optional[float]:
    """Coerce epoch seconds/ms, Windows FILETIME, ISO-8601 or common date formats into epoch seconds."""
    if value is None or value == "":
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        num = float(value)
    else:
        text = str(value).strip()
        try:
            num = float(text)
        except ValueError:
            # Normalize slashes to dashes and Z to UTC offset
            iso = text.replace("/", "-").replace("Z", "+00:00")
            # Trim sub-microsecond precision that fromisoformat rejects.
            iso = re.sub(r"(\.\d{6})\d+", r"\1", iso)
            try:
                dt = datetime.fromisoformat(iso)
            except ValueError:
                # Fallback to common date and time formats
                dt = None
                for fmt in (
                    "%Y-%m-%d %H:%M:%S",
                    "%Y-%m-%d %H:%M:%S.%f",
                    "%d/%b/%Y:%H:%M:%S %z",
                    "%Y-%m-%dT%H:%M:%S",
                    "%m-%d-%Y %H:%M:%S",
                    "%m/%d/%Y %H:%M:%S",
                ):
                    try:
                        dt = datetime.strptime(text, fmt)
                        break
                    except ValueError:
                        continue
                if dt is None:
                    return None
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.timestamp()

    if num > 1e16:  # Windows FILETIME
        return (num - _FILETIME_OFFSET) / _FILETIME_PER_SEC
    if num > 1e14:  # microseconds
        return num / 1e6
    if num > 1e11:  # milliseconds
        return num / 1e3
    return num


def normalize_relation(relation: Any) -> str:
    if not relation:
        return RelationType.GENERIC.value
    text = str(relation).strip().upper().replace(" ", "_").replace("-", "_")
    if text in RelationType.__members__:
        return text
    return text  # dataset-specific relations are allowed, kept upper-cased


class NormalizationStats:
    def __init__(self) -> None:
        self.seen = 0
        self.accepted = 0
        self.rejected = 0
        self.reject_reasons: Counter = Counter()

    def reject(self, reason: str) -> None:
        self.rejected += 1
        self.reject_reasons[reason] += 1

    def as_dict(self) -> dict:
        return {
            "seen": self.seen,
            "accepted": self.accepted,
            "rejected": self.rejected,
            "reject_reasons": dict(self.reject_reasons),
        }


def normalize_event(event: TGEvent) -> Tuple[Optional[TGEvent], Optional[str]]:
    """Validate + canonicalize a single event. Returns (event, reject_reason)."""
    if not event.event_id:
        return None, "missing_event_id"

    ts = coerce_ts(event.ts)
    if ts is None:
        return None, "unparseable_timestamp"

    if not event.src_id or not str(event.src_id).strip():
        return None, "missing_src_id"
    if not event.dst_id or not str(event.dst_id).strip():
        return None, "missing_dst_id"

    src_type = infer_node_type(str(event.src_id), event.src_type)
    dst_type = infer_node_type(str(event.dst_id), event.dst_type)

    event.ts = ts
    event.src_type = src_type
    event.dst_type = dst_type
    event.src_id = canonical_id(str(event.src_id), src_type)
    event.dst_id = canonical_id(str(event.dst_id), dst_type)
    event.relation = normalize_relation(event.relation)
    event.label = 1 if int(event.label or 0) == 1 else 0
    event.tactics = [str(t) for t in (event.tactics or [])]
    if event.apt_stage is not None:
        event.apt_stage = str(event.apt_stage)
    if event.chain_id is not None:
        event.chain_id = str(event.chain_id)
    if event.causal_parent is not None:
        event.causal_parent = str(event.causal_parent)

    return event, None


def normalize_stream(
    events: Iterable[TGEvent], stats: Optional[NormalizationStats] = None
) -> Iterator[TGEvent]:
    """Streaming normalization; nothing is dropped silently."""
    stats = stats if stats is not None else NormalizationStats()
    for event in events:
        stats.seen += 1
        normalized, reason = normalize_event(event)
        if normalized is None:
            stats.reject(reason or "unknown")
            continue
        stats.accepted += 1
        yield normalized
