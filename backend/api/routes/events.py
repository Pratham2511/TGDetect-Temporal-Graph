from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from api.services.events_service import EventsService

router = APIRouter(tags=["events"])

@router.get("/events")
def list_events(
    search: Optional[str] = Query(None, description="Event ID search"),
    event_id_query: Optional[str] = Query(None, description="Alias for search"),
    label: Optional[int] = Query(None, description="0=benign, 1=malicious"),
    labels: Optional[str] = Query(None, description="Comma-separated labels"),
    node_types: Optional[str] = Query(None, description="Comma-separated node types"),
    relations: Optional[str] = Query(None, description="Comma-separated relations"),
    source_tags: Optional[str] = Query(None, description="Comma-separated source tags"),
    tactics: Optional[str] = Query(None, description="Comma-separated tactics"),
    chain_id: Optional[str] = Query(None, description="Exact chain ID"),
    chain_ids: Optional[str] = Query(None, description="Comma-separated chain IDs"),
    node_id: Optional[str] = Query(None, description="Related node ID"),
    start_ts: Optional[float] = Query(None, description="Start timestamp"),
    end_ts: Optional[float] = Query(None, description="End timestamp"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    q_search = search or event_id_query
    q_labels: Optional[List[int]] = None
    if labels:
        try:
            q_labels = [int(x.strip()) for x in labels.split(",") if x.strip()]
        except Exception:
            pass

    nt_list = [s.strip() for s in node_types.split(",")] if node_types else None
    rel_list = [s.strip() for s in relations.split(",")] if relations else None
    st_list = [s.strip() for s in source_tags.split(",")] if source_tags else None
    tac_list = [s.strip() for s in tactics.split(",")] if tactics else None
    
    ch_list = None
    if chain_id:
        ch_list = [chain_id]
    elif chain_ids:
        ch_list = [s.strip() for s in chain_ids.split(",")]

    return EventsService.list_events(
        search=q_search,
        label=label,
        labels=q_labels,
        node_types=nt_list,
        relations=rel_list,
        source_tags=st_list,
        tactics=tac_list,
        chain_ids=ch_list,
        start_ts=start_ts,
        end_ts=end_ts,
        node_id=node_id,
        limit=limit,
        offset=offset
    )

@router.get("/events/recent-malicious")
def get_recent_malicious(limit: int = Query(10, ge=1, le=100)):
    return EventsService.get_recent_malicious(limit=limit)

@router.get("/events/{event_id}")
def get_event(event_id: str):
    evt = EventsService.get_event(event_id)
    if not evt:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found")
    return evt
