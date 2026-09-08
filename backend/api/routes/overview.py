from typing import Optional
from fastapi import APIRouter, Query
from api.dependencies import DataCache, sanitize_json
from api.services.datasets_service import DatasetsService

router = APIRouter(tags=["overview"])

@router.get("/overview")
def get_overview(
    model_id: Optional[str] = Query(None, description="Active model ID (ctu13_ho_c47)"),
    dataset_id: Optional[str] = Query(None, description="Active dataset ID"),
):
    active_id = dataset_id if isinstance(dataset_id, str) and dataset_id else DataCache.get_active_dataset_id()
    ds_meta = DatasetsService.get_dataset(active_id)
    stats = DataCache.get_graph_stats() if active_id == DataCache.get_active_dataset_id() else {}

    # Extract live telemetry from active dataset stats
    graph_info = stats.get("graph", {}) if isinstance(stats, dict) else {}
    label_info = stats.get("labeling", {}) if isinstance(stats, dict) else {}
    attack_info = stats.get("attacks", {}) if isinstance(stats, dict) else {}

    total_events = graph_info.get("total_events", ds_meta.get("num_raw_events", 0) if ds_meta else 0)
    malicious_events = graph_info.get("malicious_events", label_info.get("malicious_events", 0))
    benign_events = graph_info.get("benign_events", max(0, total_events - malicious_events))
    malicious_ratio = label_info.get("malicious_ratio", (malicious_events / total_events) if total_events > 0 else 0.0)

    total_nodes = graph_info.get("total_nodes", 0)
    total_edges = graph_info.get("total_edges", total_events)
    time_span_s = graph_info.get("timestamp_span_s", ds_meta.get("time_span_s") if ds_meta else None)
    chain_count = attack_info.get("total_chains", 0)

    ds_name = ds_meta.get("name", active_id.replace("_", " ").title()) if ds_meta else active_id
    ds_kind = ds_meta.get("kind", "user_uploaded") if ds_meta else "user_uploaded"
    provenance = ds_meta.get("provenance", f"Active dataset: {active_id}") if ds_meta else f"Dataset {active_id}"
    input_source = ds_meta.get("source", stats.get("input", active_id)) if ds_meta else active_id

    return sanitize_json({
        "dataset": ds_name,
        "dataset_name": ds_name,
        "dataset_id": active_id,
        "dataset_kind": ds_kind,
        "provenance": provenance,
        "total_events": total_events,
        "total_nodes": total_nodes,
        "total_edges": total_edges,
        "benign_events": benign_events,
        "malicious_events": malicious_events,
        "malicious_ratio": malicious_ratio,
        "chain_count": chain_count,
        "node_types": graph_info.get("node_types", {}),
        "relation_types": graph_info.get("relation_types", {}),
        "source_tags": graph_info.get("source_tags", {}),
        "tactics": graph_info.get("tactics", {}),
        "time_span_s": time_span_s,
        "input": input_source,
        "pipeline_status": "ready" if total_events > 0 else "empty"
    })
