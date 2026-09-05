from fastapi import APIRouter
from api.services.analytics_service import AnalyticsService

router = APIRouter(tags=["analytics"])

@router.get("/analytics/events")
def get_events_analytics():
    return AnalyticsService.get_events_analytics()

@router.get("/analytics/graph")
def get_graph_analytics():
    return AnalyticsService.get_graph_analytics()

@router.get("/analytics/attacks")
def get_attacks_analytics():
    return AnalyticsService.get_attacks_analytics()

@router.get("/analytics/datasets")
def get_datasets_analytics():
    return AnalyticsService.get_datasets_analytics()
