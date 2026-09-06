import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from api.dependencies import BASE_DIR, DATA_PROCESSED_DIR, DataCache, sanitize_json


class DatasetsService:
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
                            import json
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
                    else:
                        ds_name = f"{p.name.replace('_', ' ').title()} (Synthetic Demo)"
                        ds_kind = "synthetic_demo"
                        ds_provenance = "Synthetic Demonstration Dataset generated via StreamingGraphBuilder & AttackTracker (Empire + Causal + Recon scenarios)"
                        ds_desc = f"Synthetic demonstration dataset for temporal heterogeneous graph cybersecurity analysis ({p.name})"

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
                        "is_sample": True,
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
    def list_jobs() -> List[Dict[str, Any]]:
        # Map existing processed datasets to historical batch execution records
        stats = DataCache.get_graph_stats()
        job_id = "job-mordor-empire-01"
        elapsed_s = stats.get("elapsed_s") if stats else None
        return [
            {
                "id": job_id,
                "dataset_id": "mordor_empire",
                "status": "completed",
                "stage": "chains",
                "progress_pct": 100,
                "is_historical_record": True,
                "record_type": "derived_batch_execution",
                "description": "Historical batch generation run producing canonical Parquet files and multi-strategy attack chains",
                "config": {
                    "dataset_kind": "synthetic_demo",
                    "input_generator": "scripts/init_demo_data.py",
                    "out_dir": "data/processed/mordor_empire",
                    "graphs_out": "data/graphs",
                    "chunk_size": 100000,
                    "use_networkx": False,
                    "strategies": ["chain_id", "causal_parent", "entity_time"],
                    "window_s": 86400.0,
                    "max_hops": 2,
                    "max_subgraphs": 1000,
                    "source_tag": "mordor_empire",
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

    @staticmethod
    def get_job(job_id: str) -> Optional[Dict[str, Any]]:
        for j in DatasetsService.list_jobs():
            if j["id"] == job_id:
                return j
        return None
