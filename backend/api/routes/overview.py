from typing import Optional
from fastapi import APIRouter, Query
from api.dependencies import sanitize_json

router = APIRouter(tags=["overview"])

@router.get("/overview")
def get_overview(
    model_id: Optional[str] = Query(None, description="Active model ID (ctu13_ho_c47)"),
    dataset_id: Optional[str] = Query(None, description="Active dataset ID (ctu13_c47)"),
):
    # CTU-13 Scenario 47 held-out benchmark is the single production benchmark
    total_events = 1068851
    malicious_events = 9256
    benign_events = 1059595
    malicious_ratio = malicious_events / total_events if total_events > 0 else 0.0

    return sanitize_json({
        "dataset": "CTU-13 Scenario 47 (NetFlow)",
        "dataset_id": "ctu13_c47",
        "dataset_kind": "ctu13",
        "provenance": "CTU-13 Botnet NetFlow dataset (Garcia et al., 2011) - Held-Out Scenario 47 test benchmark",
        "total_events": total_events,
        "total_nodes": 2,
        "total_edges": total_events,
        "benign_events": benign_events,
        "malicious_events": malicious_events,
        "malicious_ratio": malicious_ratio,
        "chain_count": 0,
        "node_types": {"IP": 2},
        "relation_types": {"NetFlow": total_events},
        "source_tags": {"ctu13_c47": total_events},
        "tactics": {"botnet": malicious_events, "benign": benign_events},
        "time_span_s": 86400.0,
        "input": "CTU-13 Scenario 47 NetFlow Telemetry",
        "pipeline_status": "ready"
    })
