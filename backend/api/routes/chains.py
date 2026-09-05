from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from api.services.chains_service import ChainsService
from api.services.events_service import EventsService

router = APIRouter(tags=["chains"])

@router.get("/chains")
def list_chains(strategy: Optional[str] = Query(None, description="chain_id | causal_parent | entity_time")):
    return ChainsService.list_chains(strategy=strategy)

@router.get("/chains/strategies")
def get_all_strategies():
    return ChainsService.get_all_strategies()

@router.get("/chains/{chain_id}")
def get_chain(chain_id: str):
    chain = ChainsService.get_chain(chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail=f"Chain '{chain_id}' not found")
    return chain

@router.get("/chains/{chain_id}/subgraph")
def get_chain_subgraph(chain_id: str):
    chain = ChainsService.get_chain(chain_id)
    subgraph = ChainsService.get_subgraph(chain_id)
    if not subgraph:
        if not chain:
            raise HTTPException(status_code=404, detail=f"Chain '{chain_id}' not found")
        evts = EventsService.get_by_chain(chain_id)
        if not evts:
            raise HTTPException(status_code=404, detail=f"Subgraph for chain '{chain_id}' not found")
        node_types = {}
        for e in evts:
            node_types[e["src_id"]] = e.get("src_type", "UNKNOWN")
            node_types[e["dst_id"]] = e.get("dst_type", "UNKNOWN")
        subgraph = {
            "chain_id": chain_id,
            "strategy": chain.get("strategy", "chain_id"),
            "nodes": [{"id": n, "node_type": t} for n, t in node_types.items()],
            "edges": evts
        }
    return subgraph

@router.get("/chains/{chain_id}/events")
def get_chain_events(chain_id: str):
    chain = ChainsService.get_chain(chain_id)
    evts = EventsService.get_by_chain(chain_id)
    if not chain and not evts:
        raise HTTPException(status_code=404, detail=f"Chain '{chain_id}' not found")
    return evts
