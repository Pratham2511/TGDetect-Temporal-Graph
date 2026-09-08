"""Dataset-specific parsers. Every parser is a generator yielding TGEvent.

Parsers stream line-by-line and never materialize an entire file in memory.
Adding a new dataset = one generator function + one registry entry.
"""

import bz2
import csv
import gzip
import io
import lzma
import os
import tarfile
import zipfile
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterator, List, Optional

from .schema import NodeType, RelationType, TGEvent
from .normalizer import canonical_id, coerce_ts, infer_node_type
import re
import time

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
    elif lower.endswith(".xz"):
        # CTU-13 Argus captures ship as `*.binetflow.xz` (single-stream LZMA).
        with lzma.open(path, "rb") as fh:
            for line in fh:
                yield line
    elif lower.endswith(".bz2"):
        with bz2.open(path, "rb") as fh:
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


# ──────────────────────────────────────────────────────────────────────
# PATH C — CTU-13 botnet NetFlow (Argus bidirectional *.binetflow[.xz])
# ──────────────────────────────────────────────────────────────────────
# Canonical 15-column header of the labeled binetflow files. Used as a
# fallback when a file has no header row (some mirrors strip it).
CTU13_FIELDS: List[str] = [
    "StartTime", "Dur", "Proto", "SrcAddr", "Sport", "Dir", "DstAddr",
    "Dport", "State", "sTos", "dTos", "TotPkts", "TotBytes", "SrcBytes", "Label",
]


def _ctu13_int(raw: str) -> Optional[int]:
    """Parse an int that may be empty or hex (`0x1234`, ~12% of CTU-13 ports)."""
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return int(raw, 0)  # base 0 -> honours a 0x prefix, else decimal
    except ValueError:
        try:
            return int(float(raw))
        except ValueError:
            return None


def _ctu13_float(raw: str) -> Optional[float]:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _ctu13_ts(raw: str) -> Optional[float]:
    """CTU-13 stamps are `2011/08/18 15:40:53.826372` (slash date, not ISO).

    `normalizer.coerce_ts` rejects that format, so the parser must emit epoch
    seconds itself. Treated as UTC for deterministic ordering across machines
    (only relative order within a scenario matters for windowing).
    """
    raw = (raw or "").strip()
    if not raw:
        return None
    try:  # some mirrors already store epoch floats
        return float(raw)
    except ValueError:
        pass
    for fmt in ("%Y/%m/%d %H:%M:%S.%f", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
    return None


def parse_ctu13_binetflow(
    path: str,
    limit: Optional[int] = None,
    source_tag: Optional[str] = None,
    background: str = "benign",
) -> Iterator[TGEvent]:
    """Stream a CTU-13 labeled Argus NetFlow file into per-flow TGEvents.

    One edge per flow: `ip:SrcAddr --NETWORK_FLOW--> ip:DstAddr`. Every flow
    attribute (bytes/pkts/dur/proto/state/dir/ports) rides on `attrs` so the
    snapshot builder can turn it into numeric edge features — all CTU-13 nodes
    are IPs, so the node-type one-hot is constant and the signal must live on
    the edges (E-GraphSAGE convention).

    Labeling: `malicious = 1 iff "botnet" in Label.lower()` (the CTU-13 Label
    column has 50+ distinct strings; only a substring match is robust).
    `background`: "benign" keeps Background/Normal flows as label 0 (realistic
    imbalance); "drop" discards Background flows entirely (clean Normal-vs-Bot).
    """
    tag = source_tag or "ctu13"
    count = 0

    lines = (raw.decode("utf-8", errors="replace") for raw in iter_lines(path))
    reader = csv.reader(lines)
    try:
        header = next(reader)
    except StopIteration:
        return

    stripped = [h.strip() for h in header]
    if any(h == "StartTime" for h in stripped):
        field_index = {name: i for i, name in enumerate(stripped)}
        pending_first_row = None
    else:  # no header row: the line we just read is data
        field_index = {name: i for i, name in enumerate(CTU13_FIELDS)}
        pending_first_row = header

    def rows() -> Iterator[List[str]]:
        if pending_first_row is not None:
            yield pending_first_row
        yield from reader

    def col(row: List[str], name: str) -> str:
        i = field_index.get(name)
        if i is None or i >= len(row):
            return ""
        return row[i].strip()

    for row in rows():
        if len(row) < len(CTU13_FIELDS):
            continue  # malformed / truncated line

        ts = _ctu13_ts(col(row, "StartTime"))
        if ts is None:
            continue

        label_str = col(row, "Label")
        low = label_str.lower()
        if background == "drop" and "background" in low:
            continue
        label = 1 if "botnet" in low else 0

        src = col(row, "SrcAddr")
        dst = col(row, "DstAddr")
        if not src or not dst:
            continue

        attrs: Dict[str, Any] = {
            "dur": _ctu13_float(col(row, "Dur")),
            "proto": col(row, "Proto").lower(),
            "sport": _ctu13_int(col(row, "Sport")),
            "dport": _ctu13_int(col(row, "Dport")),
            "dir": col(row, "Dir"),
            "state": col(row, "State"),
            "stos": _ctu13_int(col(row, "sTos")),
            "dtos": _ctu13_int(col(row, "dTos")),
            "tot_pkts": _ctu13_int(col(row, "TotPkts")),
            "tot_bytes": _ctu13_int(col(row, "TotBytes")),
            "src_bytes": _ctu13_int(col(row, "SrcBytes")),
            "label_str": label_str,
        }

        yield TGEvent(
            event_id=f"{tag}_{count}",
            ts=ts,
            src_id=f"ip:{src}",
            src_type=NodeType.IP.value,
            dst_id=f"ip:{dst}",
            dst_type=NodeType.IP.value,
            relation=RelationType.NETWORK_FLOW.value,
            label=label,
            source_tag=tag,
            attrs=attrs,
        )
        count += 1
        if limit and count >= limit:
            return


DATA_FILE_EXT = (
    ".json", ".jsonl", ".ndjson", ".log", ".txt", ".csv", ".binetflow",
    ".gz", ".zip", ".tgz", ".tar", ".tar.gz", ".tar.bz2", ".xz", ".bz2",
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


# ──────────────────────────────────────────────────────────────────────
# PATH D — Universal Tabular & Flow Parser (CSV, TSV, JSON, NetFlow, Zeek, Any Format)
# ──────────────────────────────────────────────────────────────────────
CANONICAL_PATTERNS: Dict[str, List[str]] = {
    "src": [
        r"^src(_id|_ip|_addr|addr)?$", r"^source(_id|_ip|_addr|_address|_host)?$",
        r"^client(_ip|_host|_addr)?$", r"^orig_h$", r"^id\.orig_h$", r"^saddr$",
        r"^sender.*$", r"^ip_src$", r"^srcip$", r"^src_name$", r"^from_ip$",
        r"^source_node$", r"^src_entity$", r"^src_host$"
    ],
    "dst": [
        r"^dst(_id|_ip|_addr|addr)?$", r"^dest(_id|_ip|_addr|_address|_host)?$",
        r"^destination(_id|_ip|_addr|_address|_host)?$", r"^server(_ip|_host|_addr)?$",
        r"^target(_ip|_host|_addr)?$", r"^resp_h$", r"^id\.resp_h$", r"^daddr$",
        r"^receiver.*$", r"^ip_dst$", r"^dstip$", r"^dst_name$", r"^to_ip$",
        r"^target_node$", r"^dst_entity$", r"^dst_host$"
    ],
    "ts": [
        r"^ts(_start)?$", r"^timestamp.*$", r"^time.*$", r"^start_?time$", r"^date_?time$",
        r"^date.*$", r"^event_?time$", r"^@timestamp$", r"^utctime$", r"^timecreated$",
        r"^seen$", r"^ts_start$", r"^recorded_?at$", r"^occurred_?at$", r"^created_?at$",
        r".*timestamp.*", r".*datetime.*"
    ],
    "proto": [
        r"^proto(col)?$", r"^service$", r"^event_?type$", r"^action$", r"^activity$",
        r"^conn_state$", r"^relation$", r"^app(lication)?_?proto.*$"
    ],
    "sport": [
        r"^s(rc_?)?port$", r"^source_?port$", r"^client_?port$", r"^orig_p(ort)?$",
        r"^id\.orig_p$", r"^s_port$", r".*sport.*"
    ],
    "dport": [
        r"^d(st_?)?port$", r"^dest(ination)?_?port$", r"^target_?port$", r"^server_?port$",
        r"^resp_p(ort)?$", r"^id\.resp_p$", r"^d_port$", r".*dport.*"
    ],
    "dur": [
        r"^dur(ation)?.*$", r"^elapsed.*$"
    ],
    "tot_bytes": [
        r"^tot(al)?_?bytes$", r"^bytes?(_transferred|_total|_count)?$", r"^length$",
        r"^size$", r"^flow_bytes$"
    ],
    "src_bytes": [
        r"^src_?bytes$", r"^bytes?_sent$", r"^orig_bytes$", r"^out_bytes$"
    ],
    "tot_pkts": [
        r"^tot(al)?_?pkts$", r"^tot(al)?_?packets$", r"^pkts?$", r"^packets?(_count)?$",
        r"^flow_pkts$"
    ],
    "label": [
        r"^label$", r"^is_?attack$", r"^attack.*$", r"^malicious$", r"^class$",
        r"^threat.*$", r"^is_?malicious$", r"^target$", r"^anomaly$", r"^alert.*$",
        r"^threat_detected$", r"^verdict$", r"^status$"
    ],
    "tactics": [
        r"^tactics?$", r"^mitre.*$", r"^technique.*$", r"^phase$", r"^stage$"
    ]
}


def match_column(col_name: str) -> Optional[str]:
    """Match a raw column header to a canonical TGDetect role."""
    clean = re.sub(r"[^a-z0-9_.]", "", str(col_name).lower().strip())
    for canonical, patterns in CANONICAL_PATTERNS.items():
        for pat in patterns:
            if re.match(pat, clean):
                return canonical
    return None


def detect_column_mapping(columns: List[str]) -> Dict[str, str]:
    """Map canonical dimensions (src, dst, ts, proto, etc.) to actual column names."""
    mapping: Dict[str, str] = {}
    assigned_cols = set()
    for canonical in ["src", "dst", "ts", "label", "proto", "sport", "dport", "tot_bytes", "tot_pkts", "dur", "src_bytes", "tactics"]:
        for col in columns:
            if col in assigned_cols:
                continue
            if match_column(col) == canonical:
                mapping[canonical] = col
                assigned_cols.add(col)
                break
    return mapping


def _parse_num(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def _parse_int(v: Any) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        return int(str(v), 0)
    except (ValueError, TypeError):
        try:
            return int(float(v))
        except (ValueError, TypeError):
            return None


def _parse_label(v: Any) -> int:
    if v is None or v == "":
        return 0
    if isinstance(v, bool):
        return 1 if v else 0
    if isinstance(v, (int, float)):
        return 1 if float(v) > 0 else 0
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "t", "y"):
        return 1
    if s in ("0", "false", "no", "f", "n", "normal", "benign", "background", "clean", "-"):
        return 0
    mal_tokens = ("botnet", "attack", "malicious", "c2", "ddos", "dos", "threat",
                  "anomaly", "suspicious", "exploit", "trojan", "alert", "beacon",
                  "backdoor", "infiltrat", "bruteforce", "scan", "recon")
    if any(tok in s for tok in mal_tokens):
        return 1
    return 0


def detect_tabular_schema(path: str, max_sample_rows: int = 20) -> Dict[str, Any]:
    """Inspect a tabular file (CSV/TSV/JSON) and return detected structure & column mapping."""
    sample_lines: List[str] = []
    for raw in iter_lines(path):
        s = raw.decode("utf-8", errors="replace").strip()
        if s:
            sample_lines.append(s)
            if len(sample_lines) >= max_sample_rows:
                break

    if not sample_lines:
        return {
            "format": "generic",
            "is_json": False,
            "delimiter": ",",
            "has_header": False,
            "columns": [],
            "column_mapping": {},
            "features_extracted": [],
            "sample_records": [],
        }

    first = sample_lines[0]
    is_json = (first.startswith("{") and first.endswith("}")) or first.startswith("[")

    if is_json:
        columns_set = set()
        sample_recs = []
        for line in sample_lines:
            try:
                rec = _loads(line)
                if isinstance(rec, dict):
                    columns_set.update(rec.keys())
                    if len(sample_recs) < 5:
                        sample_recs.append(rec)
            except Exception:
                continue
        cols = sorted(list(columns_set))
        mapping = detect_column_mapping(cols)
        features = [c for c in cols if c not in mapping.values()]
        return {
            "format": "generic",
            "is_json": True,
            "delimiter": None,
            "has_header": True,
            "columns": cols,
            "column_mapping": mapping,
            "features_extracted": features,
            "sample_records": sample_recs,
        }

    # Delimited mode
    first_few = "\n".join(sample_lines[:5])
    try:
        sniffed = csv.Sniffer().sniff(first_few)
        delim = sniffed.delimiter
    except Exception:
        counts = {d: first_few.count(d) for d in [",", "\t", ";", "|"]}
        delim = max(counts, key=counts.get) if counts and max(counts.values()) > 0 else ","

    reader = csv.reader(sample_lines, delimiter=delim)
    rows = list(reader)
    if not rows:
        return {
            "format": "generic",
            "is_json": False,
            "delimiter": delim,
            "has_header": False,
            "columns": [],
            "column_mapping": {},
            "features_extracted": [],
            "sample_records": [],
        }

    header_candidate = [c.strip().strip('"\'') for c in rows[0]]
    mapping = detect_column_mapping(header_candidate)
    has_header = bool("src" in mapping or "dst" in mapping or "ts" in mapping)

    if not has_header:
        num_c = len(header_candidate)
        if num_c == 15:
            cols = list(CTU13_FIELDS)
        else:
            cols = [f"col_{i}" for i in range(num_c)]
        mapping = detect_column_mapping(cols)
        if "src" not in mapping and len(cols) > 0:
            mapping["src"] = cols[0]
        if "dst" not in mapping and len(cols) > 1:
            mapping["dst"] = cols[1]
        data_rows = rows
    else:
        cols = header_candidate
        data_rows = rows[1:]

    features = [c for c in cols if c not in mapping.values()]
    sample_recs = []
    for r in data_rows[:5]:
        sample_recs.append({cols[i]: r[i] for i in range(min(len(cols), len(r)))})

    return {
        "format": "generic",
        "is_json": False,
        "delimiter": delim,
        "has_header": has_header,
        "columns": cols,
        "column_mapping": mapping,
        "features_extracted": features,
        "sample_records": sample_recs,
    }


def parse_generic_tabular(
    path: str,
    limit: Optional[int] = None,
    source_tag: Optional[str] = None,
    background: str = "benign",
    **kwargs: Any,
) -> Iterator[TGEvent]:
    """Stream any tabular or flow telemetry log file (CSV, TSV, JSONL) into TGEvents."""
    if os.path.isdir(path):
        emitted = 0
        for fpath in iter_data_files(path):
            rel = os.path.relpath(fpath, path)
            file_tag = source_tag or f"generic:{rel}"
            remaining = (limit - emitted) if limit else None
            try:
                for event in _parse_generic_file(
                    fpath,
                    limit=remaining,
                    source_tag=file_tag,
                    background=background,
                    **kwargs,
                ):
                    yield event
                    emitted += 1
                    if limit and emitted >= limit:
                        return
            except Exception as exc:
                print(f"  [warn] skipping {rel}: {type(exc).__name__}: {exc}")
        return

    yield from _parse_generic_file(
        path,
        limit=limit,
        source_tag=source_tag,
        background=background,
        **kwargs,
    )


def _parse_generic_file(
    path: str,
    limit: Optional[int] = None,
    source_tag: Optional[str] = None,
    background: str = "benign",
    **kwargs: Any,
) -> Iterator[TGEvent]:
    tag = source_tag or os.path.basename(path).split(".")[0] or "generic"
    count = 0
    base_ts = time.time() - 3600.0

    schema_info = detect_tabular_schema(path)
    is_json = schema_info.get("is_json", False)
    mapping = schema_info.get("column_mapping", {})

    if is_json:
        for seq, raw in enumerate(iter_lines(path)):
            raw_str = raw.decode("utf-8", errors="replace").strip()
            if not raw_str:
                continue
            try:
                rec = _loads(raw_str)
            except Exception:
                continue
            if not isinstance(rec, dict):
                continue

            if seq == 0 and not mapping:
                mapping = detect_column_mapping(list(rec.keys()))

            src_val = str(rec.get(mapping.get("src", "src"), "") or "").strip()
            dst_val = str(rec.get(mapping.get("dst", "dst"), "") or "").strip()
            if not src_val and not dst_val:
                continue
            if not src_val:
                src_val = "unknown_client"
            if not dst_val:
                dst_val = "unknown_server"

            ts_raw = rec.get(mapping.get("ts", "ts"))
            ts = coerce_ts(ts_raw) if ts_raw is not None else None
            if ts is None:
                ts = base_ts + count * 0.1

            label_raw = rec.get(mapping.get("label", "label"))
            label = _parse_label(label_raw)
            if background == "drop" and label == 0:
                continue

            proto_raw = str(rec.get(mapping.get("proto", "proto"), "NETWORK_FLOW") or "NETWORK_FLOW").strip()
            sport = _parse_int(rec.get(mapping.get("sport", "sport")))
            dport = _parse_int(rec.get(mapping.get("dport", "dport")))
            dur = _parse_num(rec.get(mapping.get("dur", "dur")))
            tot_bytes = _parse_int(rec.get(mapping.get("tot_bytes", "tot_bytes")))
            src_bytes = _parse_int(rec.get(mapping.get("src_bytes", "src_bytes")))
            tot_pkts = _parse_int(rec.get(mapping.get("tot_pkts", "tot_pkts")))

            attrs: Dict[str, Any] = {
                "dur": dur,
                "proto": proto_raw.lower(),
                "sport": sport,
                "dport": dport,
                "tot_pkts": tot_pkts,
                "tot_bytes": tot_bytes,
                "src_bytes": src_bytes,
            }
            for k, v in rec.items():
                if k not in attrs and v is not None:
                    attrs[k] = v

            src_type = infer_node_type(src_val)
            dst_type = infer_node_type(dst_val)

            yield TGEvent(
                event_id=f"{tag}_{count}",
                ts=ts,
                src_id=canonical_id(src_val, src_type),
                src_type=src_type,
                dst_id=canonical_id(dst_val, dst_type),
                dst_type=dst_type,
                relation=RelationType.NETWORK_FLOW.value if proto_raw.lower() in ("tcp", "udp", "icmp") else proto_raw.upper(),
                label=label,
                source_tag=tag,
                attrs=attrs,
            )
            count += 1
            if limit and count >= limit:
                return
        return

    # Delimited mode (CSV, TSV, etc.)
    delim = schema_info.get("delimiter", ",")
    has_header = schema_info.get("has_header", True)
    cols = schema_info.get("columns", [])

    lines_gen = (raw.decode("utf-8", errors="replace") for raw in iter_lines(path))
    reader = csv.reader(lines_gen, delimiter=delim)

    pending_first_row = None
    if has_header:
        try:
            next(reader)
        except StopIteration:
            return
    else:
        try:
            pending_first_row = next(reader)
        except StopIteration:
            return

    field_idx = {name: i for i, name in enumerate(cols)}

    def get_val(row: List[str], col_key: str) -> str:
        cname = mapping.get(col_key)
        if not cname:
            return ""
        idx = field_idx.get(cname)
        if idx is None or idx >= len(row):
            return ""
        return row[idx].strip().strip('"\'')

    def row_stream() -> Iterator[List[str]]:
        if pending_first_row:
            yield pending_first_row
        for r in reader:
            if r and any(r):
                yield r

    for row in row_stream():
        src_raw = get_val(row, "src")
        dst_raw = get_val(row, "dst")
        if not src_raw and not dst_raw:
            continue
        if not src_raw:
            src_raw = "client_host"
        if not dst_raw:
            dst_raw = "server_host"

        ts_str = get_val(row, "ts")
        ts = coerce_ts(ts_str) if ts_str else None
        if ts is None:
            ts = base_ts + count * 0.1

        label_raw = get_val(row, "label")
        label = _parse_label(label_raw)
        if background == "drop" and label == 0:
            continue

        proto_raw = get_val(row, "proto") or "NETWORK_FLOW"
        sport = _parse_int(get_val(row, "sport"))
        dport = _parse_int(get_val(row, "dport"))
        dur = _parse_num(get_val(row, "dur"))
        tot_bytes = _parse_int(get_val(row, "tot_bytes"))
        src_bytes = _parse_int(get_val(row, "src_bytes"))
        tot_pkts = _parse_int(get_val(row, "tot_pkts"))

        attrs: Dict[str, Any] = {
            "dur": dur,
            "proto": proto_raw.lower(),
            "sport": sport,
            "dport": dport,
            "tot_pkts": tot_pkts,
            "tot_bytes": tot_bytes,
            "src_bytes": src_bytes,
        }

        # Extra columns preserved in attrs
        for cname, cidx in field_idx.items():
            if cname not in mapping.values() and cidx < len(row):
                val = row[cidx].strip().strip('"\'')
                if val:
                    attrs[cname] = val

        src_type = infer_node_type(src_raw)
        dst_type = infer_node_type(dst_raw)

        yield TGEvent(
            event_id=f"{tag}_{count}",
            ts=ts,
            src_id=canonical_id(src_raw, src_type),
            src_type=src_type,
            dst_id=canonical_id(dst_raw, dst_type),
            dst_type=dst_type,
            relation=RelationType.NETWORK_FLOW.value if proto_raw.lower() in ("tcp", "udp", "icmp") else proto_raw.upper(),
            label=label,
            source_tag=tag,
            attrs=attrs,
        )
        count += 1
        if limit and count >= limit:
            return


PARSERS: Dict[str, ParserFn] = {
    "synthetic": parse_synthetic_jsonl,
    "mordor": parse_mordor_jsonl,
    "ctu13": parse_ctu13_binetflow,
    "generic": parse_generic_tabular,
    "tabular": parse_generic_tabular,
    "csv": parse_generic_tabular,
    "auto": parse_generic_tabular,
}


def get_parser(name: str) -> ParserFn:
    clean = (name or "").lower().strip()
    if clean in PARSERS:
        return PARSERS[clean]
    # Seamless fallback to universal tabular parser for custom uploaded datasets
    return parse_generic_tabular
