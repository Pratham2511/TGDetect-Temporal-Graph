"""Dataset validation engine for TGDetect.

Validates user-uploaded datasets against backend parsers and schemas:
- CTU-13 NetFlow (Argus *.binetflow[.xz], CSV, TXT)
- Mordor / OTRF Security-Datasets (Windows Sysmon & Security logs)
- Synthetic TG-Detect event streams (JSONL)

Produces actionable diagnostics: total inspected rows, valid/invalid rows,
missing required columns, line-numbered parser errors, warnings, and
sample parsed TGEvents.
"""

import csv
import json
import os
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from graph_builder.normalizer import coerce_ts
from graph_builder.parsers import (
    CTU13_FIELDS,
    _ctu13_float,
    _ctu13_int,
    _ctu13_ts,
    _first,
    _loads,
    iter_lines,
    mordor_record_to_events,
)
from graph_builder.schema import (
    NODE_TYPES,
    RELATION_TYPES,
    NodeType,
    RelationType,
    TGEvent,
)

SUPPORTED_FORMATS = ["ctu13", "mordor", "synthetic"]

FORMAT_LABELS = {
    "ctu13": "CTU-13 NetFlow (Argus *.binetflow / CSV)",
    "mordor": "Mordor / Windows Host Logs (Sysmon / Security JSONL)",
    "synthetic": "Synthetic TG-Detect Event Stream (JSONL)",
}

CTU13_REQUIRED_COLUMNS = ["StartTime", "SrcAddr", "DstAddr", "Proto", "TotBytes", "TotPkts", "Label"]


class DatasetValidator:
    """Server-side dataset validator using authentic backend parsers and schemas."""

    @staticmethod
    def detect_format(file_path: str) -> Dict[str, Any]:
        """Inspect file structure and sample lines to detect format."""
        p = Path(file_path)
        ext = p.suffix.lower()
        if p.name.lower().endswith(".binetflow") or p.name.lower().endswith(".binetflow.xz"):
            return {"format": "ctu13", "confidence": 0.99, "reason": "File extension matches CTU-13 NetFlow capture"}

        sample_lines: List[str] = []
        try:
            for idx, raw in enumerate(iter_lines(file_path)):
                line = raw.decode("utf-8", errors="replace").strip()
                if line:
                    sample_lines.append(line)
                if len(sample_lines) >= 10:
                    break
        except Exception as exc:
            return {"format": "unknown", "confidence": 0.0, "reason": f"Failed to read file: {exc}"}

        if not sample_lines:
            return {"format": "unknown", "confidence": 0.0, "reason": "File is empty"}

        # Check for JSONL
        first = sample_lines[0]
        if first.startswith("{") and first.endswith("}"):
            try:
                rec = _loads(first)
                if isinstance(rec, dict):
                    # Check for synthetic TGEvent fields
                    if any(k in rec for k in ("apt_stage", "ood_type", "source_tag", "tactics")) and "src_id" in rec:
                        return {"format": "synthetic", "confidence": 0.95, "reason": "JSON record contains TG-Detect synthetic event fields"}
                    # Check for Mordor / Sysmon / Security log fields
                    if any(k in rec for k in ("@timestamp", "UtcTime", "EventID", "Channel", "Computer", "ComputerName", "SubjectUserName")):
                        return {"format": "mordor", "confidence": 0.95, "reason": "JSON record contains Windows Event / Sysmon fields"}
                    return {"format": "mordor", "confidence": 0.70, "reason": "JSON records detected (defaulting to host log parser)"}
            except Exception:
                pass

        # Check for CTU-13 / CSV NetFlow
        stripped = [h.strip() for h in first.split(",")]
        if any(h in stripped for h in ("StartTime", "SrcAddr", "DstAddr", "Proto", "TotPkts", "Label")):
            return {"format": "ctu13", "confidence": 0.98, "reason": "CSV header matches CTU-13 NetFlow schema"}

        # Space-separated or headless CTU-13
        if len(stripped) >= 12 or len(first.split()) >= 12:
            return {"format": "ctu13", "confidence": 0.60, "reason": "Delimited row matches NetFlow column count"}

        return {"format": "unknown", "confidence": 0.0, "reason": "Could not reliably determine format from file contents"}

    @classmethod
    def validate_file(
        cls,
        file_path: str,
        format_name: Optional[str] = None,
        max_inspect_rows: int = 2000,
    ) -> Dict[str, Any]:
        """Run comprehensive validation and return structured report."""
        p = Path(file_path)
        if not p.exists():
            return {
                "status": "invalid",
                "format": format_name or "unknown",
                "detected_format": "unknown",
                "total_rows_inspected": 0,
                "valid_rows": 0,
                "invalid_rows": 0,
                "error_count": 1,
                "warning_count": 0,
                "errors": [{"line": 0, "column": None, "message": f"File does not exist: {file_path}"}],
                "warnings": [],
                "columns_detected": [],
                "missing_required_columns": [],
                "sample_events": [],
                "file_info": {"filename": p.name, "size_bytes": 0, "readable": False},
            }

        size_bytes = p.stat().st_size
        file_info: Dict[str, Any] = {
            "filename": p.name,
            "size_bytes": size_bytes,
            "readable": True,
            "archive_type": None,
        }

        # Check archive readability
        if p.name.lower().endswith(".zip"):
            file_info["archive_type"] = "zip"
            try:
                with zipfile.ZipFile(file_path, "r") as zf:
                    bad = zf.testzip()
                    if bad:
                        return cls._error_report(
                            "invalid",
                            format_name or "unknown",
                            "unknown",
                            file_info,
                            [{"line": 0, "column": None, "message": f"Corrupted zip archive at member: {bad}"}],
                        )
                    file_info["members"] = [n for n in zf.namelist() if not n.endswith("/")]
            except Exception as exc:
                return cls._error_report(
                    "invalid",
                    format_name or "unknown",
                    "unknown",
                    file_info,
                    [{"line": 0, "column": None, "message": f"Failed to open zip archive: {exc}"}],
                )

        # Detect format if not specified or 'auto'
        detected_info = cls.detect_format(file_path)
        detected_fmt = detected_info.get("format", "unknown")
        active_fmt = format_name.lower().strip() if format_name and format_name.lower().strip() not in ("", "auto") else detected_fmt

        if active_fmt not in SUPPORTED_FORMATS:
            return cls._error_report(
                "invalid",
                active_fmt,
                detected_fmt,
                file_info,
                [{
                    "line": 0,
                    "column": None,
                    "message": f"Unsupported dataset format '{active_fmt}'. Genuinely supported formats: {SUPPORTED_FORMATS} ({', '.join(f'{k}: {v}' for k, v in FORMAT_LABELS.items())}).",
                }],
            )

        if active_fmt == "ctu13":
            return cls._validate_ctu13(file_path, detected_fmt, file_info, max_inspect_rows)
        elif active_fmt == "mordor":
            return cls._validate_mordor(file_path, detected_fmt, file_info, max_inspect_rows)
        elif active_fmt == "synthetic":
            return cls._validate_synthetic(file_path, detected_fmt, file_info, max_inspect_rows)

        return cls._error_report("invalid", active_fmt, detected_fmt, file_info, [{"line": 0, "column": None, "message": "Unknown format validation path"}])

    @classmethod
    def _validate_ctu13(
        cls,
        file_path: str,
        detected_fmt: str,
        file_info: Dict[str, Any],
        max_rows: int,
    ) -> Dict[str, Any]:
        errors: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []
        sample_events: List[Dict[str, Any]] = []
        columns_detected: List[str] = []
        missing_columns: List[str] = []

        valid_rows = 0
        invalid_rows = 0
        total_rows = 0

        try:
            line_gen = (raw.decode("utf-8", errors="replace") for raw in iter_lines(file_path))
            reader = csv.reader(line_gen)
            try:
                first_row = next(reader)
            except StopIteration:
                return cls._error_report("invalid", "ctu13", detected_fmt, file_info, [{"line": 0, "column": None, "message": "Dataset file is empty (0 lines)"}])

            stripped = [h.strip() for h in first_row]
            has_header = any(h == "StartTime" for h in stripped)

            if has_header:
                columns_detected = stripped
                field_index = {name: i for i, name in enumerate(stripped)}
                pending_first_row = None
                for col_name in CTU13_REQUIRED_COLUMNS:
                    if col_name not in field_index:
                        missing_columns.append(col_name)
                if missing_columns:
                    errors.append({
                        "line": 1,
                        "column": ", ".join(missing_columns),
                        "message": f"Missing required CTU-13 NetFlow columns: {missing_columns}. Header found: {columns_detected}",
                    })
            else:
                warnings.append({
                    "line": 1,
                    "message": f"No header row detected with 'StartTime'. Falling back to canonical 15-column CTU-13 layout ({', '.join(CTU13_FIELDS[:6])}...).",
                })
                columns_detected = list(CTU13_FIELDS)
                field_index = {name: i for i, name in enumerate(CTU13_FIELDS)}
                pending_first_row = first_row

            def rows_iter():
                if pending_first_row is not None:
                    yield pending_first_row
                yield from reader

            line_no = 1 if not has_header else 2
            for row in rows_iter():
                total_rows += 1
                row_errors = []

                if len(row) < len(CTU13_FIELDS):
                    row_errors.append(f"Row has only {len(row)} columns, expected at least {len(CTU13_FIELDS)}")
                else:
                    # Validate StartTime
                    idx_st = field_index.get("StartTime")
                    st_val = row[idx_st].strip() if idx_st is not None and idx_st < len(row) else ""
                    if not st_val:
                        row_errors.append("Missing StartTime value")
                    else:
                        parsed_ts = _ctu13_ts(st_val)
                        if parsed_ts is None:
                            row_errors.append(f"Invalid StartTime timestamp '{st_val}'. Expected 'YYYY/MM/DD HH:MM:SS.ffffff' or epoch seconds")

                    # Validate SrcAddr & DstAddr
                    idx_src = field_index.get("SrcAddr")
                    src_val = row[idx_src].strip() if idx_src is not None and idx_src < len(row) else ""
                    idx_dst = field_index.get("DstAddr")
                    dst_val = row[idx_dst].strip() if idx_dst is not None and idx_dst < len(row) else ""
                    if not src_val:
                        row_errors.append("Missing SrcAddr (source IP)")
                    if not dst_val:
                        row_errors.append("Missing DstAddr (destination IP)")

                    # Validate TotPkts & TotBytes
                    idx_pkts = field_index.get("TotPkts")
                    if idx_pkts is not None and idx_pkts < len(row):
                        pkts_val = row[idx_pkts].strip()
                        if pkts_val and _ctu13_int(pkts_val) is None:
                            row_errors.append(f"Invalid TotPkts integer value '{pkts_val}'")

                    idx_bytes = field_index.get("TotBytes")
                    if idx_bytes is not None and idx_bytes < len(row):
                        bytes_val = row[idx_bytes].strip()
                        if bytes_val and _ctu13_int(bytes_val) is None:
                            row_errors.append(f"Invalid TotBytes integer value '{bytes_val}'")

                if row_errors:
                    invalid_rows += 1
                    if len(errors) < 50:
                        errors.append({
                            "line": line_no,
                            "column": None,
                            "message": "; ".join(row_errors),
                        })
                else:
                    valid_rows += 1
                    # Extract sample parsed TGEvent if needed
                    if len(sample_events) < 5 and src_val and dst_val and parsed_ts is not None:
                        lbl_idx = field_index.get("Label")
                        lbl_val = row[lbl_idx].strip() if lbl_idx is not None and lbl_idx < len(row) else ""
                        proto_idx = field_index.get("Proto")
                        proto_val = row[proto_idx].strip().lower() if proto_idx is not None and proto_idx < len(row) else ""
                        dur_idx = field_index.get("Dur")
                        dur_val = _ctu13_float(row[dur_idx]) if dur_idx is not None and dur_idx < len(row) else 0.0

                        evt = TGEvent(
                            event_id=f"ctu13_{total_rows}",
                            ts=parsed_ts,
                            src_id=f"ip:{src_val}",
                            src_type=NodeType.IP.value,
                            dst_id=f"ip:{dst_val}",
                            dst_type=NodeType.IP.value,
                            relation=RelationType.NETWORK_FLOW.value,
                            label=1 if "botnet" in lbl_val.lower() else 0,
                            source_tag="ctu13",
                            attrs={
                                "dur": dur_val,
                                "proto": proto_val,
                                "tot_pkts": _ctu13_int(row[field_index.get("TotPkts", -1)]) if "TotPkts" in field_index else None,
                                "tot_bytes": _ctu13_int(row[field_index.get("TotBytes", -1)]) if "TotBytes" in field_index else None,
                                "label_str": lbl_val,
                            },
                        )
                        d_row = evt.to_row()
                        d_row["attrs"] = evt.attrs
                        sample_events.append(d_row)

                line_no += 1
                if total_rows >= max_rows:
                    warnings.append({
                        "line": line_no,
                        "message": f"Sampled first {max_rows:,} rows for rapid pre-processing validation. Remaining rows will be validated during streaming pipeline execution.",
                    })
                    break

        except Exception as exc:
            errors.append({
                "line": 0,
                "column": None,
                "message": f"Stream reader error: {type(exc).__name__}: {exc}",
            })

        status = "valid"
        if errors or invalid_rows > 0 or valid_rows == 0:
            status = "invalid" if (valid_rows == 0 or len(missing_columns) > 0) else "valid_with_warnings"
        elif warnings:
            status = "valid_with_warnings"

        return {
            "status": status,
            "format": "ctu13",
            "format_label": FORMAT_LABELS["ctu13"],
            "detected_format": detected_fmt,
            "total_rows_inspected": total_rows,
            "valid_rows": valid_rows,
            "invalid_rows": invalid_rows,
            "error_count": len(errors),
            "warning_count": len(warnings),
            "errors": errors,
            "warnings": warnings,
            "columns_detected": columns_detected,
            "missing_required_columns": missing_columns,
            "sample_events": sample_events,
            "file_info": file_info,
        }

    @classmethod
    def _validate_mordor(
        cls,
        file_path: str,
        detected_fmt: str,
        file_info: Dict[str, Any],
        max_rows: int,
    ) -> Dict[str, Any]:
        errors: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []
        sample_events: List[Dict[str, Any]] = []
        columns_detected_set = set()

        valid_rows = 0
        invalid_rows = 0
        total_rows = 0
        line_no = 1

        try:
            for raw in iter_lines(file_path):
                total_rows += 1
                raw_str = raw.decode("utf-8", errors="replace").strip()
                if not raw_str:
                    line_no += 1
                    continue

                try:
                    record = _loads(raw_str)
                except Exception as exc:
                    invalid_rows += 1
                    if len(errors) < 50:
                        errors.append({
                            "line": line_no,
                            "column": None,
                            "message": f"Malformed JSON line: {exc}",
                        })
                    line_no += 1
                    continue

                if not isinstance(record, dict):
                    invalid_rows += 1
                    if len(errors) < 50:
                        errors.append({
                            "line": line_no,
                            "column": None,
                            "message": f"Expected JSON object (dictionary), got {type(record).__name__}",
                        })
                    line_no += 1
                    continue

                for k in record.keys():
                    columns_detected_set.add(k)

                ts_raw = _first(record, "@timestamp", "UtcTime", "TimeCreated", "EventTime", "timestamp")
                if not ts_raw:
                    invalid_rows += 1
                    if len(errors) < 50:
                        errors.append({
                            "line": line_no,
                            "column": "@timestamp",
                            "message": "Missing timestamp field in Windows log record (@timestamp, UtcTime, TimeCreated, or EventTime)",
                        })
                    line_no += 1
                    continue

                parsed_ts = coerce_ts(ts_raw)
                if parsed_ts is None:
                    invalid_rows += 1
                    if len(errors) < 50:
                        errors.append({
                            "line": line_no,
                            "column": "@timestamp",
                            "message": f"Invalid or unparseable timestamp '{ts_raw}' in Windows log record",
                        })
                    line_no += 1
                    continue

                valid_rows += 1
                if len(sample_events) < 5:
                    evts = list(mordor_record_to_events(record, source_tag="mordor", seq=total_rows))
                    if evts:
                        evt = evts[0]
                        evt.ts = parsed_ts
                        sample_row = evt.to_row()
                        sample_row["attrs"] = evt.attrs
                        sample_events.append(sample_row)

                line_no += 1
                if total_rows >= max_rows:
                    warnings.append({
                        "line": line_no,
                        "message": f"Sampled first {max_rows:,} records. File structure confirmed valid for streaming Mordor ingestion.",
                    })
                    break

        except Exception as exc:
            errors.append({
                "line": 0,
                "column": None,
                "message": f"File reading failed: {type(exc).__name__}: {exc}",
            })

        status = "valid"
        if errors or invalid_rows > 0 or valid_rows == 0:
            status = "invalid" if valid_rows == 0 else "valid_with_warnings"
        elif warnings:
            status = "valid_with_warnings"

        return {
            "status": status,
            "format": "mordor",
            "format_label": FORMAT_LABELS["mordor"],
            "detected_format": detected_fmt,
            "total_rows_inspected": total_rows,
            "valid_rows": valid_rows,
            "invalid_rows": invalid_rows,
            "error_count": len(errors),
            "warning_count": len(warnings),
            "errors": errors,
            "warnings": warnings,
            "columns_detected": sorted(list(columns_detected_set))[:40],
            "missing_required_columns": [],
            "sample_events": sample_events,
            "file_info": file_info,
        }

    @classmethod
    def _validate_synthetic(
        cls,
        file_path: str,
        detected_fmt: str,
        file_info: Dict[str, Any],
        max_rows: int,
    ) -> Dict[str, Any]:
        errors: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []
        sample_events: List[Dict[str, Any]] = []
        columns_detected_set = set()

        valid_rows = 0
        invalid_rows = 0
        total_rows = 0
        line_no = 1
        required_fields = ["event_id", "ts", "src_id", "dst_id"]

        try:
            for raw in iter_lines(file_path):
                total_rows += 1
                raw_str = raw.decode("utf-8", errors="replace").strip()
                if not raw_str:
                    line_no += 1
                    continue

                try:
                    record = _loads(raw_str)
                except Exception as exc:
                    invalid_rows += 1
                    if len(errors) < 50:
                        errors.append({"line": line_no, "column": None, "message": f"Malformed JSON: {exc}"})
                    line_no += 1
                    continue

                if not isinstance(record, dict):
                    invalid_rows += 1
                    if len(errors) < 50:
                        errors.append({"line": line_no, "column": None, "message": "Expected JSON object"})
                    line_no += 1
                    continue

                for k in record.keys():
                    columns_detected_set.add(k)

                missing = [f for f in required_fields if f not in record or record[f] in (None, "")]
                if missing:
                    invalid_rows += 1
                    if len(errors) < 50:
                        errors.append({"line": line_no, "column": ", ".join(missing), "message": f"Missing required fields: {missing}"})
                    line_no += 1
                    continue

                ts = coerce_ts(record.get("ts"))
                if ts is None:
                    invalid_rows += 1
                    if len(errors) < 50:
                        errors.append({"line": line_no, "column": "ts", "message": f"Invalid timestamp value '{record.get('ts')}': must be numeric epoch seconds or valid timestamp"})
                    line_no += 1
                    continue

                valid_rows += 1
                if len(sample_events) < 5:
                    sample_events.append({
                        "event_id": str(record.get("event_id", "")),
                        "ts": ts,
                        "src_id": str(record.get("src_id", "")),
                        "src_type": str(record.get("src_type", "")),
                        "dst_id": str(record.get("dst_id", "")),
                        "dst_type": str(record.get("dst_type", "")),
                        "relation": str(record.get("relation", "GENERIC")),
                        "label": int(record.get("label", 0) or 0),
                        "tactics": list(record.get("tactics", [])),
                        "source_tag": str(record.get("source_tag", "synthetic")),
                        "attrs": record.get("attrs", {}),
                    })

                line_no += 1
                if total_rows >= max_rows:
                    warnings.append({"line": line_no, "message": f"Sampled first {max_rows:,} records."})
                    break

        except Exception as exc:
            errors.append({"line": 0, "column": None, "message": f"File reading failed: {type(exc).__name__}: {exc}"})

        status = "valid"
        if errors or invalid_rows > 0 or valid_rows == 0:
            status = "invalid" if valid_rows == 0 else "valid_with_warnings"
        elif warnings:
            status = "valid_with_warnings"

        return {
            "status": status,
            "format": "synthetic",
            "format_label": FORMAT_LABELS["synthetic"],
            "detected_format": detected_fmt,
            "total_rows_inspected": total_rows,
            "valid_rows": valid_rows,
            "invalid_rows": invalid_rows,
            "error_count": len(errors),
            "warning_count": len(warnings),
            "errors": errors,
            "warnings": warnings,
            "columns_detected": sorted(list(columns_detected_set))[:40],
            "missing_required_columns": [],
            "sample_events": sample_events,
            "file_info": file_info,
        }

    @staticmethod
    def _error_report(
        status: str,
        format_name: str,
        detected_fmt: str,
        file_info: Dict[str, Any],
        errors: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        return {
            "status": status,
            "format": format_name,
            "format_label": FORMAT_LABELS.get(format_name, format_name),
            "detected_format": detected_fmt,
            "total_rows_inspected": 0,
            "valid_rows": 0,
            "invalid_rows": 0,
            "error_count": len(errors),
            "warning_count": 0,
            "errors": errors,
            "warnings": [],
            "columns_detected": [],
            "missing_required_columns": [],
            "sample_events": [],
            "file_info": file_info,
        }
