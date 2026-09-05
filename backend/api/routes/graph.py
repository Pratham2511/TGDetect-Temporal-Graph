from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from api.services.graph_service import GraphService

router = APIRouter(tags=["graph"])

@router.get("/graph")
def get_graph(
    malicious_only: bool = Query(False, description="Filter for malicious edges only"),
    node_type: Optional[str] = Query(None, description="Filter by node type"),
    relation: Optional[str] = Query(None, description="Filter by relation"),
    chain_id: Optional[str] = Query(None, description="Filter by chain ID"),
    limit: int = Query(1000, ge=1, le=5000)
):
    return GraphService.get_graph(
        malicious_only=malicious_only,
        node_type=node_type,
        relation=relation,
        chain_id=chain_id,
        limit=limit
    )

@router.get("/graph/nodes")
def get_nodes():
    return GraphService.get_nodes()

@router.get("/graph/edges")
def get_edges(limit: Optional[int] = Query(None, ge=1)):
    return GraphService.get_edges(limit=limit)

@router.get("/graph/nodes/{node_id}")
def get_node_detail(node_id: str):
    node = GraphService.get_node_detail(node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found")
    return node

@router.get("/graph/stats")
def get_stats():
    return GraphService.get_stats()
