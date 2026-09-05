from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from api.services.artifacts_service import ArtifactsService

router = APIRouter(tags=["artifacts"])

@router.get("/artifacts")
def list_artifacts(job_id: Optional[str] = Query(None)):
    return ArtifactsService.list_artifacts(job_id=job_id)

@router.get("/artifacts/{artifact_id}")
def get_artifact(artifact_id: str):
    a = ArtifactsService.get_artifact(artifact_id)
    if not a:
        raise HTTPException(status_code=404, detail=f"Artifact '{artifact_id}' not found")
    return a

@router.get("/artifacts/{artifact_id}/schema")
def get_artifact_schema(artifact_id: str):
    s = ArtifactsService.get_schema(artifact_id)
    if s is None:
        raise HTTPException(status_code=404, detail=f"Schema for artifact '{artifact_id}' not found")
    return s

@router.get("/artifacts/{artifact_id}/preview")
def get_artifact_preview(artifact_id: str, limit: int = Query(10, ge=1, le=100)):
    p = ArtifactsService.get_preview(artifact_id, limit=limit)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Preview for artifact '{artifact_id}' not found")
    return p
