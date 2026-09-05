from fastapi import APIRouter
from api.dependencies import DataCache, sanitize_json

router = APIRouter(tags=["overview"])

@router.get("/overview")
def get_overview():
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
