import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import pyarrow.parquet as pq
from api.dependencies import BASE_DIR, DATA_PROCESSED_DIR, DATA_GRAPHS_DIR, sanitize_json

ALLOWED_ARTIFACTS = {
    "events.parquet": ("events", "Parquet stream of canonical TGEvents with MITRE ATT&CK labels and causal parent links"),
    "edges.parquet": ("edges", "Parquet projection of graph edges for fast GNN ingestion and graph traversal"),
    "nodes.parquet": ("nodes", "Parquet table of heterogeneous graph nodes with degree features and anomaly stats"),
    "chains_summary.parquet": ("chains_summary", "Reconstructed attack chains across chain_id, causal_parent, and entity_time"),
    "graph_stats.json": ("graph_stats", "JSON dump of builder summary, labeling mode, normalization rates, and attack histograms")
}

class ArtifactsService:
    @staticmethod
    def _is_safe_artifact_id(artifact_id: str) -> bool:
        if not artifact_id:
            return False
        if "/" in artifact_id or chr(92) in artifact_id or ".." in artifact_id:
            return False
        return artifact_id in ALLOWED_ARTIFACTS

    @staticmethod
    def list_artifacts(job_id: Optional[str] = None) -> List[Dict[str, Any]]:
        artifacts = []
        for fname, (kind, desc) in ALLOWED_ARTIFACTS.items():
            path = DATA_PROCESSED_DIR / fname
            if path.exists():
                stat = path.stat()
                row_count = 0
                cols: List[Dict[str, Any]] = []
                preview_rows: List[Dict[str, Any]] = []

                if fname.endswith(".parquet"):
                    try:
                        table = pq.read_table(path)
                        row_count = table.num_rows
                        for field in table.schema:
                            cols.append({
                                "name": field.name,
                                "type": str(field.type),
                                "nullable": field.nullable
                            })
                        pydict = table.slice(0, 5).to_pydict()
                        for i in range(min(5, table.num_rows)):
                            row_dict = {}
                            for k, v in pydict.items():
                                val = v[i]
                                if k == "attrs" and isinstance(val, str):
                                    try:
                                        val = json.loads(val)
                                    except Exception:
                                        pass
                                row_dict[k] = val
                            preview_rows.append(sanitize_json(row_dict))
                    except Exception:
                        pass
                elif fname.endswith(".json"):
                    try:
                        with open(path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        row_count = 1
                        for k, v in data.items():
                            cols.append({
                                "name": k,
                                "type": type(v).__name__,
                                "nullable": True
                            })
                        preview_rows = [sanitize_json(data)]
                    except Exception:
                        pass

                artifacts.append({
                    "id": fname,
                    "job_id": job_id or "job-mordor-empire-01",
                    "kind": kind,
                    "path": str(path),
                    "size_bytes": stat.st_size,
                    "row_count": row_count,
                    "created_at": stat.st_mtime,
                    "schema": cols,
                    "preview": preview_rows,
                    "description": desc
                })

        return artifacts

    @staticmethod
    def get_artifact(artifact_id: str) -> Optional[Dict[str, Any]]:
        if not ArtifactsService._is_safe_artifact_id(artifact_id):
            return None
        for a in ArtifactsService.list_artifacts():
            if a["id"] == artifact_id:
                return a
        return None

    @staticmethod
    def get_schema(artifact_id: str) -> Optional[List[Dict[str, Any]]]:
        if not ArtifactsService._is_safe_artifact_id(artifact_id):
            return None
        a = ArtifactsService.get_artifact(artifact_id)
        if a:
            return a.get("schema", [])
        return None

    @staticmethod
    def get_preview(artifact_id: str, limit: int = 10) -> Optional[List[Dict[str, Any]]]:
        if not ArtifactsService._is_safe_artifact_id(artifact_id):
            return None
        path = (DATA_PROCESSED_DIR / artifact_id).resolve()
        if not path.is_relative_to(DATA_PROCESSED_DIR.resolve()) or not path.is_file():
            return None

        if artifact_id.endswith(".parquet"):
            try:
                table = pq.read_table(path)
                pydict = table.slice(0, limit).to_pydict()
                rows = []
                for i in range(min(limit, table.num_rows)):
                    row_dict = {}
                    for k, v in pydict.items():
                        val = v[i]
                        if k == "attrs" and isinstance(val, str):
                            try:
                                val = json.loads(val)
                            except Exception:
                                pass
                        row_dict[k] = val
                    rows.append(sanitize_json(row_dict))
                return rows
            except Exception:
                return []
        elif artifact_id.endswith(".json"):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return [sanitize_json(json.load(f))]
            except Exception:
                return []
        return []
