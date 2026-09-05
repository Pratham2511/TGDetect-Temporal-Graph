"""Rule-based attack labeling for unlabeled captures (e.g. Mordor `compound/`).

Mordor compound captures are *full scenarios*: mostly normal background
activity with real attack chains embedded. Forcing `--label 0` over the whole
folder destroys the ground truth. This module derives per-event labels from
ATT&CK-style indicators, then propagates the label to nearby events that share
an entity (host / user / process) within a time window, so that the surrounding
steps of the same attack chain are also captured.

Design constraints
------------------
* Streaming: bounded memory, single pass, order-preserving output.
* Dataset agnostic: works on the unified `TGEvent` schema only.
"""

from __future__ import annotations

import re
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, Iterable, Iterator, List, Set, Tuple

from .schema import TGEvent

# --------------------------------------------------------------------------
# Indicator rules (case-insensitive substring / regex on the flattened event)
# --------------------------------------------------------------------------

SUSPICIOUS_PROCESSES: Tuple[str, ...] = (
    "mimikatz", "psexec", "procdump", "wce.exe", "lazagne", "rubeus",
    "sharphound", "bloodhound", "seatbelt", "koadic", "covenant",
    "powersploit", "invoke-", "empire", "meterpreter", "cobaltstrike",
    "beacon.exe", "nc.exe", "ncat.exe", "plink.exe", "winpeas",
)

LOLBINS: Tuple[str, ...] = (
    "rundll32.exe", "regsvr32.exe", "mshta.exe", "wmic.exe", "certutil.exe",
    "bitsadmin.exe", "installutil.exe", "msbuild.exe", "cmstp.exe",
    "odbcconf.exe", "control.exe", "msiexec.exe", "schtasks.exe",
    "at.exe", "sc.exe", "vssadmin.exe", "wbadmin.exe", "bcdedit.exe",
)

CMDLINE_PATTERNS: Tuple[re.Pattern, ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"-enc(odedcommand)?\s+[a-z0-9+/=]{40,}",   # base64 powershell
        r"frombase64string",
        r"downloadstring|downloadfile|invoke-webrequest|iwr\s",
        r"iex\s*\(|invoke-expression",
        r"-nop\b|-noprofile\b|-w\s+hidden|-windowstyle\s+hidden",
        r"lsass",
        r"sekurlsa|logonpasswords|dcsync|kerberoast",
        r"net\s+(user|group|localgroup)\s+.*\/add",
        r"reg\s+save\s+hk(lm|cu)\\sam|\\system\b",
        r"vssadmin.*delete\s+shadows",
        r"wevtutil\s+cl|clear-eventlog",
        r"add-mppreference|set-mppreference|disable.*realtimemonitoring",
        r"\\\\[\w.\-]+\\(admin\$|c\$|ipc\$)",       # admin share access
        r"whoami\s+/all|nltest|net\s+view|adfind",
    )
)

# Windows event ids that are attack-relevant on their own.
SUSPICIOUS_EVENT_IDS: Set[str] = {
    "1102",   # audit log cleared
    "4625",   # failed logon (brute force)
    "4648",   # explicit-credential logon
    "4672",   # special privileges assigned
    "4697",   # service installed
    "4698", "4699", "4700", "4701", "4702",  # scheduled task ops
    "4720", "4728", "4732", "4756",          # account/group manipulation
    "7045",   # new service
    "8",      # sysmon CreateRemoteThread
    "10",     # sysmon ProcessAccess (lsass dumping)
    "25",     # sysmon process tampering
}

SUSPICIOUS_RELATIONS: Set[str] = {
    "EXPLOIT", "LATERAL_MOVE", "EXFILTRATE", "IMPACT",
}


@dataclass
class LabelStats:
    total: int = 0
    seed_hits: int = 0
    propagated: int = 0
    malicious: int = 0
    reasons: Dict[str, int] = field(default_factory=dict)

    def bump(self, reason: str) -> None:
        self.reasons[reason] = self.reasons.get(reason, 0) + 1

    def as_dict(self) -> Dict[str, Any]:
        return {
            "total_events": self.total,
            "seed_indicator_hits": self.seed_hits,
            "propagated_events": self.propagated,
            "malicious_events": self.malicious,
            "benign_events": self.total - self.malicious,
            "malicious_ratio": round(self.malicious / self.total, 4) if self.total else 0.0,
            "top_reasons": dict(sorted(self.reasons.items(), key=lambda kv: -kv[1])[:15]),
        }


def _haystack(ev: TGEvent) -> str:
    parts: List[str] = [ev.src_id, ev.dst_id, ev.relation]
    for k, v in (ev.attrs or {}).items():
        if isinstance(v, (str, int, float)):
            parts.append(f"{k}={v}")
    return " ".join(parts).lower()


def _event_id_field(ev: TGEvent) -> str:
    a = ev.attrs or {}
    for k in ("event_id", "EventID", "event_code", "EventCode", "eventid"):
        if k in a and a[k] is not None:
            return str(a[k]).strip()
    return ""


def detect_indicator(ev: TGEvent) -> str | None:
    """Return the rule name that fired for this event, or None."""
    if ev.relation in SUSPICIOUS_RELATIONS:
        return f"relation:{ev.relation}"

    eid = _event_id_field(ev)
    if eid and eid in SUSPICIOUS_EVENT_IDS:
        return f"event_id:{eid}"

    hay = _haystack(ev)
    for name in SUSPICIOUS_PROCESSES:
        if name in hay:
            return f"tool:{name}"
    for pat in CMDLINE_PATTERNS:
        if pat.search(hay):
            return f"cmdline:{pat.pattern[:28]}"
    for lb in LOLBINS:
        # LOLBins alone are noisy: only count them with a network/remote hint.
        if lb in hay and any(t in hay for t in ("http", "\\\\", "-enc", "scrobj", "javascript:")):
            return f"lolbin:{lb}"
    return None


# HOST nodes are far too coarse to propagate on: in a lab capture every event
# shares the same host, which would mark the whole dataset malicious.
BROAD_TYPES: Set[str] = {"HOST", "DOMAIN", "UNKNOWN"}


def _entities(ev: TGEvent) -> Tuple[str, ...]:
    out: List[str] = []
    if ev.src_type not in BROAD_TYPES:
        out.append(ev.src_id)
    if ev.dst_type not in BROAD_TYPES:
        out.append(ev.dst_id)
    return tuple(out)


class HeuristicLabeler:
    """Streaming indicator labeler with entity+time propagation.

    Events are held in a bounded buffer covering `window_s` seconds. When an
    indicator fires, every buffered event that shares an entity with it is
    relabeled malicious, and the entity is marked "hot" for `window_s` seconds
    so subsequent related events inherit the label too.
    """

    def __init__(self, window_s: float = 300.0, max_buffer: int = 200_000,
                 propagate: bool = True) -> None:
        self.window_s = float(window_s)
        self.max_buffer = int(max_buffer)
        self.propagate = propagate
        self.stats = LabelStats()
        self._buf: Deque[TGEvent] = deque()
        self._hot: Dict[str, float] = {}          # entity -> expiry ts
        self._hot_chain: Dict[str, str] = {}      # entity -> chain id

    # -- internals ---------------------------------------------------------
    def _expire_hot(self, now: float) -> None:
        if len(self._hot) < 4096:
            dead = [e for e, exp in self._hot.items() if exp < now]
        else:
            dead = [e for e, exp in list(self._hot.items()) if exp < now]
        for e in dead:
            self._hot.pop(e, None)
            self._hot_chain.pop(e, None)

    def _mark(self, ev: TGEvent, reason: str, chain: str) -> None:
        if ev.label != 1:
            ev.label = 1
            self.stats.malicious += 1
            self.stats.propagated += 1
        if not ev.chain_id:
            ev.chain_id = chain
        ev.attrs = dict(ev.attrs or {})
        ev.attrs.setdefault("label_reason", reason)

    def _flush_ready(self, now: float) -> Iterator[TGEvent]:
        while self._buf and (now - self._buf[0].ts) > self.window_s:
            yield self._buf.popleft()
        while len(self._buf) > self.max_buffer:
            yield self._buf.popleft()

    # -- public ------------------------------------------------------------
    def process(self, events: Iterable[TGEvent]) -> Iterator[TGEvent]:
        seed_n = 0
        for ev in events:
            self.stats.total += 1
            now = float(ev.ts)
            self._expire_hot(now)

            reason = detect_indicator(ev)
            if reason:
                seed_n += 1
                self.stats.seed_hits += 1
                self.stats.bump(reason)
                chain = None
                for ent in _entities(ev):
                    if ent in self._hot_chain:
                        chain = self._hot_chain[ent]
                        break
                chain = chain or f"heur_chain_{seed_n:06d}"
                if ev.label != 1:
                    ev.label = 1
                    self.stats.malicious += 1
                ev.chain_id = ev.chain_id or chain
                ev.attrs = dict(ev.attrs or {})
                ev.attrs.setdefault("label_reason", reason)

                if self.propagate:
                    for ent in _entities(ev):
                        self._hot[ent] = now + self.window_s
                        self._hot_chain[ent] = chain
                    lo = now - self.window_s
                    for old in self._buf:
                        if old.label == 1 or old.ts < lo:
                            continue
                        seed_ents = set(_entities(ev))
                        if seed_ents & set(_entities(old)):
                            self._mark(old, f"propagated<-{reason}", chain)
            elif self.propagate:
                for ent in _entities(ev):
                    exp = self._hot.get(ent)
                    if exp is not None and now <= exp:
                        self._mark(ev, "propagated<-hot_entity", self._hot_chain.get(ent, "heur_chain"))
                        break

            self._buf.append(ev)
            yield from self._flush_ready(now)

        while self._buf:
            yield self._buf.popleft()


def label_stream(events: Iterable[TGEvent], window_s: float = 300.0,
                 propagate: bool = True) -> Tuple[Iterator[TGEvent], HeuristicLabeler]:
    lab = HeuristicLabeler(window_s=window_s, propagate=propagate)
    return lab.process(events), lab
