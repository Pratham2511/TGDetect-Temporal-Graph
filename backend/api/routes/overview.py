from typing import Optional
from fastapi import APIRouter, Query
from api.dependencies import DataCache, sanitize_json

router = APIRouter(tags=["overview"])

@router.get("/overview")
def get_overview(
    model_id: Optional[str] = Query(None, description="Optional active model ID (e.g. mordor_mixed | ctu13_ho_c47)"),
    dataset_id: Optional[str] = Query(None, description="Optional active dataset ID (e.g. mordor_empire | ctu13_c47)"),
):
    target = (model_id or dataset_id or "").lower()
    if "ctu13" in target:
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

    stats = DataCache.get_graph_stats()
    graph = stats.get("graph", {})
    attacks = stats.get("attacks", {})

    total_events = graph.get("total_events", 0)
    total_nodes = graph.get("total_nodes", 0)
    total_edges = graph.get("total_edges", 0)
    malicious_events = graph.get("malicious_events", 0)
    benign_events = graph.get("benign_events", 0)
    malicious_ratio = (malicious_events / total_events) if total_events > 0 else 0.0

    return sanitize_json({
        "dataset": "mordor_empire (Synthetic Demo)",
        "dataset_id": "mordor_empire",
        "dataset_kind": "synthetic_demo",
        "provenance": "Synthetic Demonstration Dataset generated via StreamingGraphBuilder & AttackTracker",
        "total_events": total_events,
        "total_nodes": total_nodes,
        "total_edges": total_edges,
        "benign_events": benign_events,
        "malicious_events": malicious_events,
        "malicious_ratio": malicious_ratio,
        "chain_count": attacks.get("total_chains", 0),
        "node_types": graph.get("node_types", {}),
        "relation_types": graph.get("relation_types", {}),
        "source_tags": graph.get("source_tags", {"mordor_empire": total_events} if total_events else {}),
        "tactics": graph.get("tactics", {}),
        "time_span_s": graph.get("timestamp_span_s"),
        "input": stats.get("input", "Synthetic Demonstration Generator"),
        "pipeline_status": "ready" if stats else "empty"
    })
