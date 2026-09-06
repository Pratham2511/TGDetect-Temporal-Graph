import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from api.dependencies import BASE_DIR, DATA_PROCESSED_DIR, DataCache, sanitize_json
from api.services.dataset_validator import DatasetValidator
from graph_builder.parsers import get_parser
from graph_builder.normalizer import NormalizationStats, normalize_stream
from graph_builder.builder import StreamingGraphBuilder
from graph_builder.attack_tracker import AttackTracker
from graph_builder.exporters import (
    GraphExporter,
    write_chain_subgraphs,
    write_chain_summary,
    write_stats,
)

class DatasetsService:
    _custom_jobs: List[Dict[str, Any]] = []

    @staticmethod
    def list_datasets() -> List[Dict[str, Any]]:
        datasets = []
        processed_base = BASE_DIR / "data" / "processed"
        if processed_base.exists():
            for p in sorted(processed_base.iterdir()):
                if p.is_dir():
                    stats_file = p / "graph_stats.json"
                    num_events = 0
                    time_span_s = None
                    created_at = None
                    if stats_file.exists():
                        try:
                            created_at = stats_file.stat().st_mtime
                            with open(stats_file, "r", encoding="utf-8") as f:
                                st = json.load(f)
                                num_events = st.get("graph", {}).get("total_events", 0)
                                time_span_s = st.get("graph", {}).get("timestamp_span_s")
                        except Exception:
                            pass
                    elif p.exists():
                        created_at = p.stat().st_mtime

                    if p.name.startswith("ctu13"):
                        ds_name = f"CTU-13 {p.name.replace('ctu13_', '').upper()} (NetFlow)"
                        ds_kind = "ctu13"
                        ds_provenance = "CTU-13 Botnet NetFlow dataset (Garcia et al., 2011)"
                        ds_desc = f"CTU-13 network telemetry scenario {p.name}"
                    elif p.name == "ctu13_c47":
                        ds_name = "CTU-13 Scenario 47 (NetFlow)"
                        ds_kind = "synthetic_demo"
                        ds_provenance = "Synthetic Demonstration Dataset generated via StreamingGraphBuilder & AttackTracker (Empire + Causal + Recon scenarios)"
                        ds_desc = "Synthetic demonstration dataset for temporal heterogeneous graph cybersecurity analysis (ctu13_c47)"
                    else:
                        ds_name = f"{p.name.replace('_', ' ').title()}"
                        ds_kind = "user_uploaded"
                        ds_provenance = f"User processed dataset: {p.name}"
                        ds_desc = f"Temporal graph constructed from {p.name}"

                    datasets.append({
                        "id": p.name,
                        "name": ds_name,
                        "kind": ds_kind,
                        "source": str(p),
                        "provenance": ds_provenance,
                        "raw_bytes": sum(f.stat().st_size for f in p.glob("**/*") if f.is_file()),
                        "num_raw_events": num_events,
                        "time_span_s": time_span_s,
                        "created_at": created_at,
                        "is_sample": p.name in ("ctu13_c47", "ctu13_c47"),
                        "description": ds_desc
                    })
        return datasets

    @staticmethod
    def get_dataset(dataset_id: str) -> Optional[Dict[str, Any]]:
        for d in DatasetsService.list_datasets():
            if d["id"] == dataset_id:
                return d
        return None

    @staticmethod
    def save_upload(file_bytes: bytes, filename: str) -> str:
        """Save uploaded dataset file to data/uploads."""
        upload_dir = BASE_DIR / "data" / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)
        # Sanitize filename
        clean_name = os.path.basename(filename)
        safe_path = upload_dir / clean_name
        with open(safe_path, "wb") as f:
            f.write(file_bytes)
        return str(safe_path)

    @staticmethod
    def validate_dataset(file_path: str, format_name: Optional[str] = None) -> Dict[str, Any]:
        """Validate dataset with backend parsers and schemas."""
        return DatasetValidator.validate_file(file_path, format_name=format_name)

    @staticmethod
    def list_jobs() -> List[Dict[str, Any]]:
        stats = DataCache.get_graph_stats()
        job_id = "job-ctu13-c47-01"
        elapsed_s = stats.get("elapsed_s") if stats else None
        base_jobs = [
            {
                "id": job_id,
                "dataset_id": "ctu13_c47",
                "status": "completed",
                "stage": "chains",
                "progress_pct": 100,
                "is_historical_record": True,
                "record_type": "derived_batch_execution",
                "description": "Historical batch generation run producing canonical Parquet files and multi-strategy attack chains",
                "config": {
                    "dataset_kind": "synthetic_demo",
                    "input_generator": "scripts/init_demo_data.py",
                    "out_dir": "data/processed/ctu13_c47",
                    "graphs_out": "data/graphs",
                    "chunk_size": 100000,
                    "use_networkx": False,
                    "strategies": ["chain_id", "causal_parent", "entity_time"],
                    "window_s": 86400.0,
                    "max_hops": 2,
                    "max_subgraphs": 1000,
                    "source_tag": "ctu13_c47",
                    "label_mode": "heuristic",
                    "label_window_s": 300.0,
                    "label_propagation": True,
                    "force_label": None
                },
                "stats": sanitize_json(stats),
                "elapsed_s": elapsed_s,
                "started_at": None,
                "completed_at": None,
                "error": None
            }
        ]
        return base_jobs + DatasetsService._custom_jobs

    @staticmethod
    def get_job(job_id: str) -> Optional[Dict[str, Any]]:
        for j in DatasetsService.list_jobs():
            if j["id"] == job_id:
                return j
        return None

    @classmethod
    def process_dataset(
        cls,
        dataset_id: str,
        format_name: str,
        source_path: str,
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        cfg = config or {}
        p_src = Path(source_path)
        if not p_src.exists():
            raise FileNotFoundError(f"Source file '{source_path}' does not exist.")

        out_dir = BASE_DIR / "data" / "processed" / dataset_id
        out_dir.mkdir(parents=True, exist_ok=True)
        graphs_out = BASE_DIR / "data" / "graphs"
        graphs_out.mkdir(parents=True, exist_ok=True)

        job_id = f"job-{dataset_id}-{int(time.time())}"
        started_at = time.time()

        job_record: Dict[str, Any] = {
            "id": job_id,
            "dataset_id": dataset_id,
            "status": "running",
            "stage": "parsing",
            "progress_pct": 10,
            "is_historical_record": False,
            "record_type": "live_pipeline_execution",
            "description": f"Processing {format_name} dataset '{dataset_id}' into temporal graph",
            "config": {
                "dataset": format_name,
                "source_file": source_path,
                "out_dir": str(out_dir),
                "strategies": cfg.get("strategies", ["chain_id", "causal_parent", "entity_time"]),
            },
            "stats": None,
            "elapsed_s": None,
            "started_at": started_at,
            "completed_at": None,
            "error": None,
        }
        cls._custom_jobs.append(job_record)

        try:
            # 1. Parse & Normalize
            parser_fn = get_parser(format_name)
            limit = cfg.get("limit")
            raw_events = parser_fn(str(p_src), limit=limit)
            norm_stats = NormalizationStats()
            builder = StreamingGraphBuilder()
            strategies = cfg.get("strategies", ["chain_id", "causal_parent", "entity_time"])
            tracker = AttackTracker(strategies=strategies, window_s=float(cfg.get("window_s", 86400.0)), max_hops=int(cfg.get("max_hops", 2)))
            exporter = GraphExporter(str(out_dir), chunk_size=int(cfg.get("chunk_size", 50000)))

            job_record["stage"] = "building_graph"
            job_record["progress_pct"] = 40

            normalized = normalize_stream(raw_events, norm_stats)
            pipeline = exporter.stream_events(tracker.observe_stream(builder.add_events(normalized)))
            for _ in pipeline:
                pass
            exporter.close()

            job_record["stage"] = "writing_nodes"
            job_record["progress_pct"] = 70
            num_nodes = exporter.write_nodes(builder.node_rows())

            job_record["stage"] = "reconstructing_chains"
            job_record["progress_pct"] = 85
            results = tracker.build_chains()
            all_chains = [c for chains in results.values() for c in chains]
            write_chain_summary(str(out_dir), all_chains)
            subgraphs = write_chain_subgraphs(str(graphs_out), all_chains, max_files=100)

            stats = {
                "dataset": format_name,
                "input": source_path,
                "elapsed_s": round(time.time() - started_at, 2),
                "normalization": norm_stats.as_dict(),
                "labeling": {"mode": "parser"},
                "graph": builder.summary(),
                "attacks": tracker.summary(results),
                "outputs": {
                    "events": str(out_dir / "events.parquet"),
                    "edges": str(out_dir / "edges.parquet"),
                    "nodes": str(out_dir / "nodes.parquet"),
                    "chains": str(out_dir / "chains_summary.parquet"),
                    "subgraphs_written": subgraphs,
                },
            }
            write_stats(str(out_dir), stats)

            completed_at = time.time()
            job_record["status"] = "completed"
            job_record["stage"] = "completed"
            job_record["progress_pct"] = 100
            job_record["completed_at"] = completed_at
            job_record["elapsed_s"] = round(completed_at - started_at, 2)
            job_record["stats"] = sanitize_json(stats)

            # Switch active dataset to newly processed dataset
            DataCache.set_active_dataset(dataset_id)

            return job_record

        except Exception as exc:
            job_record["status"] = "failed"
            job_record["stage"] = "failed"
            job_record["error"] = f"{type(exc).__name__}: {exc}"
            job_record["completed_at"] = time.time()
            raise exc
