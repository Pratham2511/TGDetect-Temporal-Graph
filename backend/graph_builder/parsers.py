"""Dataset-specific parsers. Every parser is a generator yielding TGEvent.

Parsers stream line-by-line and never materialize an entire file in memory.
Adding a new dataset = one generator function + one registry entry.
"""

from __future__ import annotations

import gzip
import io
import os
import tarfile
import zipfile
from typing import Any, Callable, Dict, Iterator, Optional

from .schema import NodeType, RelationType, TGEvent

try:  # orjson is much faster, but stdlib json is a fine fallback.
    import orjson as _json

    def _loads(raw: bytes | str) -> Any:
        return _json.loads(raw)

except ImportError:  # pragma: no cover
    import json as _json  # type: ignore

    def _loads(raw: bytes | str) -> Any:
        return _json.loads(raw)


# ──────────────────────────────────────────────────────────────────────
# Generic streaming line reader (plain / .gz / member of .zip)
# ──────────────────────────────────────────────────────────────────────
LOG_MEMBER_EXT = (".json", ".jsonl", ".ndjson", ".log", ".txt")


def _iter_text_lines(fh) -> Iterator[bytes]:
    for line in io.TextIOWrapper(fh, encoding="utf-8", errors="replace"):
        yield line.encode("utf-8")


def iter_lines(path: str, member: Optional[str] = None) -> Iterator[bytes]:
    """Stream lines from a plain file, .gz, .tar/.tar.gz/.tgz or .zip archive."""
    lower = path.lower()
    if lower.endswith(".zip"):
        with zipfile.ZipFile(path) as zf:
            names = [member] if member else [
                n for n in zf.namelist() if n.lower().endswith(LOG_MEMBER_EXT)
            ] or [n for n in zf.namelist() if not n.endswith("/")]
            for name in names:
                with zf.open(name) as fh:
                    yield from _iter_text_lines(fh)
    elif lower.endswith((".tar.gz", ".tgz", ".tar.bz2", ".tar")):
        # tar.gz members must be read via tarfile — gunzipping the whole file
        # yields raw tar blocks (headers + NUL padding), not JSON lines.
        mode = "r:*"
        with tarfile.open(path, mode) as tf:
            members = (
                [tf.getmember(member)]
                if member
                else [m for m in tf.getmembers()
                      if m.isfile() and m.name.lower().endswith(LOG_MEMBER_EXT)]
                or [m for m in tf.getmembers() if m.isfile()]
            )
            for m in members:
                fh = tf.extractfile(m)
                if fh is None:
                    continue
                inner = gzip.GzipFile(fileobj=fh) if m.name.lower().endswith(".gz") else fh
                yield from _iter_text_lines(inner)
    elif lower.endswith(".gz"):
        with gzip.open(path, "rb") as fh:
            for line in fh:
                yield line
    else:
        with open(path, "rb") as fh:
            for line in fh:
                yield line



def iter_json_records(path: str, member: Optional[str] = None) -> Iterator[Dict[str, Any]]:
    for raw in iter_lines(path, member):
        raw = raw.strip()
        if not raw:
            continue
        try:
            record = _loads(raw)
        except Exception:
            continue
        if isinstance(record, dict):
            yield record


# ──────────────────────────────────────────────────────────────────────
# PATH A — synthetic TG-Detect generator output (v6_ood_formal.jsonl)
# ──────────────────────────────────────────────────────────────────────
TACTIC_TO_RELATION: Dict[str, str] = {
    "Initial_Access": RelationType.EXPLOIT.value,
    "Execution": RelationType.EXECUTES.value,
    "Persistence": RelationType.WRITES.value,
    "Privilege_Escalation": RelationType.EXPLOIT.value,
    "Defense_Evasion": RelationType.DELETES.value,
    "Credential_Access": RelationType.READS.value,
    "Discovery": RelationType.DISCOVER.value,
    "Lateral_Movement": RelationType.LATERAL_MOVE.value,
    "Collection": RelationType.READS.value,
    "C2": RelationType.CONNECTS_TO.value,
    "Exfiltration": RelationType.EXFILTRATE.value,
    "Impact": RelationType.IMPACT.value,
}


def parse_synthetic_jsonl(path: str, limit: Optional[int] = None) -> Iterator[TGEvent]:
    """Parse the project's own generated event stream.

    Node types are inferred downstream from the id prefixes
    (apt_actor_/user_ -> USER, internal_target_/sys_/critical_server_ -> HOST,
    external_ip_ -> IP); the relation is derived from the first tactic.
    """
    count = 0
    for record in iter_json_records(path):
        tactics = record.get("tactics") or []
        relation = (
            TACTIC_TO_RELATION.get(tactics[0], RelationType.GENERIC.value)
            if tactics
            else RelationType.GENERIC.value
        )

        attrs = dict(record.get("attrs") or {})
        if record.get("ood_type") is not None:
            attrs["ood_type"] = record["ood_type"]

        stage = record.get("apt_stage")
        yield TGEvent(
            event_id=str(record.get("event_id", "")),
            ts=record.get("ts"),
            src_id=str(record.get("src_id", "")),
            src_type="",  # inferred by the normalizer
            dst_id=str(record.get("dst_id", "")),
            dst_type="",
            relation=relation,
            label=int(record.get("label", 0) or 0),
            tactics=list(tactics),
            apt_stage=None if stage in (None, -1, "-1") else str(stage),
            source_tag=str(record.get("source_tag", "synthetic")),
            chain_id=record.get("chain_id"),
            causal_parent=record.get("causal_parent"),
            attrs=attrs,
        )
        count += 1
        if limit and count >= limit:
            return


# ──────────────────────────────────────────────────────────────────────
# PATH B — Mordor / OTRF Security-Datasets (Windows Sysmon + Security logs)
# ──────────────────────────────────────────────────────────────────────
def _first(record: Dict[str, Any], *keys: str) -> Optional[Any]:
    for key in keys:
        if key in record and record[key] not in (None, "", "-"):
            return record[key]
        for actual in record:
            if actual.lower() == key.lower() and record[actual] not in (None, "", "-"):
                return record[actual]
    return None


def load_mordor_metadata(metadata_dir: str) -> Dict[str, Dict[str, Any]]:
    """Load `_metadata/*.yaml` scenario descriptors -> label/tactics per dataset id.

    Security-Datasets has no per-row label column: ground truth lives in the
    scenario metadata (ATT&CK technique/tactic mappings).
    """
    try:
        import yaml
    except ImportError:  # pragma: no cover
        return {}

    catalog: Dict[str, Dict[str, Any]] = {}
    if not os.path.isdir(metadata_dir):
        return catalog

    for name in os.listdir(metadata_dir):
        if not name.lower().endswith((".yaml", ".yml")):
            continue
        try:
            with open(os.path.join(metadata_dir, name), "r", encoding="utf-8") as fh:
                doc = yaml.safe_load(fh) or {}
        except Exception:
            continue

        scenario_id = str(doc.get("id") or os.path.splitext(name)[0])
        tactics: list[str] = []
        techniques: list[str] = []
        for entry in doc.get("attack_mappings") or []:
            if not isinstance(entry, dict):
                continue
            for tac in entry.get("tactics") or []:
                tactics.append(str(tac))
            if entry.get("technique"):
                techniques.append(str(entry["technique"]))

        files = []
        for group in doc.get("files") or []:
            if isinstance(group, dict) and group.get("link"):
                files.append(os.path.basename(str(group["link"])))

        catalog[scenario_id] = {
            "scenario_id": scenario_id,
            "title": doc.get("title"),
            "tactics": sorted(set(tactics)),
            "techniques": sorted(set(techniques)),
            "label": 1 if tactics or techniques else 0,
            "files": files,
        }
    return catalog


def _mordor_context(record: Dict[str, Any]) -> Dict[str, Any]:
    host = _first(record, "Hostname", "Computer", "host", "ComputerName") or "unknown_host"
    user = _first(record, "SubjectUserName", "User", "TargetUserName", "AccountName")
    return {"host": str(host), "user": None if user is None else str(user)}


def mordor_record_to_events(
    record: Dict[str, Any],
    source_tag: str = "mordor",
    label: int = 0,
    tactics: Optional[list[str]] = None,
    chain_id: Optional[str] = None,
    seq: int = 0,
) -> Iterator[TGEvent]:
    """Fan a single Windows event record out into typed temporal edges."""
    tactics = tactics or []
    ts = _first(record, "@timestamp", "UtcTime", "TimeCreated", "EventTime", "timestamp")
    ctx = _mordor_context(record)
    host = ctx["host"]
    channel = str(_first(record, "Channel", "channel") or "")
    try:
        event_id_num = int(_first(record, "EventID", "event_id", "EventId") or 0)
    except (TypeError, ValueError):
        event_id_num = 0

    base_id = str(
        _first(record, "RecordNumber", "record_id", "EventRecordID") or f"{host}_{seq}"
    )

    def emit(idx: int, src: str, src_t: str, dst: str, dst_t: str, relation: str,
             extra: Optional[Dict[str, Any]] = None) -> TGEvent:
        attrs = {"event_id_num": event_id_num, "channel": channel, "host": host}
        if extra:
            attrs.update(extra)
        return TGEvent(
            event_id=f"{source_tag}_{base_id}_{idx}",
            ts=ts,
            src_id=src,
            src_type=src_t,
            dst_id=dst,
            dst_type=dst_t,
            relation=relation,
            label=label,
            tactics=list(tactics),
            source_tag=source_tag,
            chain_id=chain_id,
            attrs=attrs,
        )

    def proc_node(guid_keys: tuple[str, ...], image_keys: tuple[str, ...]) -> Optional[str]:
        guid = _first(record, *guid_keys)
        image = _first(record, *image_keys)
        if guid:
            return f"process:{guid}"
        if image:
            return f"process:{host}|{os.path.basename(str(image))}"
        return None

    idx = 0

    # Sysmon 1 — process creation: parent EXECUTES child
    if event_id_num == 1:
        child = proc_node(("ProcessGuid",), ("Image",))
        parent = proc_node(("ParentProcessGuid",), ("ParentImage",))
        if child and parent:
            yield emit(idx, parent, NodeType.PROCESS.value, child, NodeType.PROCESS.value,
                       RelationType.EXECUTES.value,
                       {"image": _first(record, "Image"),
                        "command_line": _first(record, "CommandLine")})
            idx += 1
        if child:
            yield emit(idx, child, NodeType.PROCESS.value, f"host:{host}",
                       NodeType.HOST.value, RelationType.GENERIC.value)
            idx += 1
        if ctx["user"] and child:
            yield emit(idx, f"user:{ctx['user']}", NodeType.USER.value, child,
                       NodeType.PROCESS.value, RelationType.EXECUTES.value)
            idx += 1

    # Sysmon 3 — network connection: process CONNECTS_TO ip
    elif event_id_num == 3:
        proc = proc_node(("ProcessGuid",), ("Image",))
        dst_ip = _first(record, "DestinationIp", "DestinationIP")
        if proc and dst_ip:
            yield emit(idx, proc, NodeType.PROCESS.value, f"ip:{dst_ip}", NodeType.IP.value,
                       RelationType.CONNECTS_TO.value,
                       {"dst_port": _first(record, "DestinationPort"),
                        "protocol": _first(record, "Protocol")})
            idx += 1
        dst_host = _first(record, "DestinationHostname")
        if proc and dst_host:
            yield emit(idx, proc, NodeType.PROCESS.value, f"domain:{dst_host}",
                       NodeType.DOMAIN.value, RelationType.CONNECTS_TO.value)
            idx += 1

    # Sysmon 11 (file create) / 23,26 (file delete) / 2 (file time change)
    elif event_id_num in (11, 15, 23, 26, 2):
        proc = proc_node(("ProcessGuid",), ("Image",))
        target = _first(record, "TargetFilename", "TargetObject")
        if proc and target:
            relation = (
                RelationType.DELETES.value
                if event_id_num in (23, 26)
                else RelationType.WRITES.value
            )
            yield emit(idx, proc, NodeType.PROCESS.value, f"file:{target}",
                       NodeType.FILE.value, relation)
            idx += 1

    # Sysmon 22 — DNS query
    elif event_id_num == 22:
        proc = proc_node(("ProcessGuid",), ("Image",))
        query = _first(record, "QueryName")
        if proc and query:
            yield emit(idx, proc, NodeType.PROCESS.value, f"domain:{query}",
                       NodeType.DOMAIN.value, RelationType.CONNECTS_TO.value)
            idx += 1

    # Security 4624/4625/4634 — logon
    elif event_id_num in (4624, 4625, 4634, 4672):
        user = _first(record, "TargetUserName", "SubjectUserName")
        if user:
            yield emit(idx, f"user:{user}", NodeType.USER.value, f"host:{host}",
                       NodeType.HOST.value, RelationType.LOGON.value,
                       {"logon_type": _first(record, "LogonType"),
                        "status": "failed" if event_id_num == 4625 else "success"})
            idx += 1
        src_ip = _first(record, "IpAddress", "SourceNetworkAddress")
        if src_ip and str(src_ip) not in ("-", "::1", "127.0.0.1"):
            yield emit(idx, f"ip:{src_ip}", NodeType.IP.value, f"host:{host}",
                       NodeType.HOST.value, RelationType.CONNECTS_TO.value)
            idx += 1

    # Security 4648/4768/4769/4776 — explicit-credential / Kerberos auth
    elif event_id_num in (4648, 4768, 4769, 4776):
        target_host = _first(record, "TargetServerName", "ServiceName", "TargetDomainName")
        if target_host:
            yield emit(idx, f"host:{host}", NodeType.HOST.value, f"host:{target_host}",
                       NodeType.HOST.value, RelationType.AUTHENTICATES_TO.value)
            idx += 1
        user = _first(record, "TargetUserName", "SubjectUserName")
        if user:
            yield emit(idx, f"user:{user}", NodeType.USER.value, f"host:{host}",
                       NodeType.HOST.value, RelationType.AUTHENTICATES_TO.value)
            idx += 1

    # Fallback: keep the record as a generic host-scoped event so nothing is lost.
    if idx == 0:
        actor = ctx["user"] or "system"
        yield emit(0, f"user:{actor}", NodeType.USER.value, f"host:{host}",
                   NodeType.HOST.value, RelationType.GENERIC.value)

DATA_FILE_EXT = (
    ".json", ".jsonl", ".ndjson", ".log", ".txt",
    ".gz", ".zip", ".tgz", ".tar", ".tar.gz", ".tar.bz2",
)


def iter_data_files(root: str) -> Iterator[str]:
    """Yield every parsable log file under `root` (recursively, sorted)."""
    if os.path.isfile(root):
        yield root
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        # skip metadata / docs folders
        if os.path.basename(dirpath).startswith("_"):
            continue
        for name in sorted(filenames):
            if name.lower().endswith(DATA_FILE_EXT):
                yield os.path.join(dirpath, name)




def parse_mordor_jsonl(
    path: str,
    limit: Optional[int] = None,
    label: int = 1,
    tactics: Optional[list[str]] = None,
    chain_id: Optional[str] = None,
    metadata_dir: Optional[str] = None,
    source_tag: str = "mordor",
) -> Iterator[TGEvent]:
    """Stream Security-Datasets logs into TGEvents.

    `path` may be a single log file OR a directory: directories are walked
    recursively and every log file becomes its own scenario/chain.
    """
    if os.path.isdir(path):
        emitted = 0
        for fpath in iter_data_files(path):
            rel = os.path.relpath(fpath, path)
            file_chain = chain_id or f"{source_tag}:{rel}"
            remaining = (limit - emitted) if limit else None
            try:
                for event in _parse_mordor_file(
                    fpath,
                    limit=remaining,
                    label=label,
                    tactics=tactics,
                    chain_id=file_chain,
                    metadata_dir=metadata_dir,
                    source_tag=source_tag,
                ):
                    yield event
                    emitted += 1
                    if limit and emitted >= limit:
                        return
            except Exception as exc:  # keep the batch alive on one bad archive
                print(f"  [warn] skipping {rel}: {type(exc).__name__}: {exc}")
        return
    yield from _parse_mordor_file(
        path,
        limit=limit,
        label=label,
        tactics=tactics,
        chain_id=chain_id,
        metadata_dir=metadata_dir,
        source_tag=source_tag,
    )


def _parse_mordor_file(
    path: str,
    limit: Optional[int] = None,
    label: int = 1,
    tactics: Optional[list[str]] = None,
    chain_id: Optional[str] = None,
    metadata_dir: Optional[str] = None,
    source_tag: str = "mordor",
) -> Iterator[TGEvent]:
    """Stream a single Security-Datasets host log file into TGEvents."""
    
    resolved_tactics = list(tactics or [])
    resolved_chain = chain_id
    resolved_label = label

    if metadata_dir:
        catalog = load_mordor_metadata(metadata_dir)
        basename = os.path.basename(path)
        for scenario in catalog.values():
            if basename in scenario.get("files", []):
                resolved_tactics = scenario["tactics"] or resolved_tactics
                resolved_chain = resolved_chain or scenario["scenario_id"]
                resolved_label = scenario["label"]
                break

    emitted = 0
    for seq, record in enumerate(iter_json_records(path)):
        for event in mordor_record_to_events(
            record,
            source_tag=source_tag,
            label=resolved_label,
            tactics=resolved_tactics,
            chain_id=resolved_chain,
            seq=seq,
        ):
            yield event
            emitted += 1
            if limit and emitted >= limit:
                return


# ──────────────────────────────────────────────────────────────────────
# Registry
# ──────────────────────────────────────────────────────────────────────
ParserFn = Callable[..., Iterator[TGEvent]]

PARSERS: Dict[str, ParserFn] = {
    "synthetic": parse_synthetic_jsonl,
    "mordor": parse_mordor_jsonl,
}


def get_parser(name: str) -> ParserFn:
    if name not in PARSERS:
        raise KeyError(f"Unknown dataset parser '{name}'. Available: {sorted(PARSERS)}")
    return PARSERS[name]
