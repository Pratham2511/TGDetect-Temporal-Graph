import os
from starlette.responses import FileResponse
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


@router.get("/artifacts/{artifact_id}/download")
def download_artifact(artifact_id: str):
    # Support lookup by filename (events.parquet) or kind (events)
    target_id = artifact_id
    if not target_id.endswith(".parquet") and not target_id.endswith(".json"):
        from api.services.artifacts_service import ALLOWED_ARTIFACTS
        for fname, (kind, _) in ALLOWED_ARTIFACTS.items():
            if kind == target_id:
                target_id = fname
                break
    a = ArtifactsService.get_artifact(target_id)
    if not a:
        raise HTTPException(status_code=404, detail=f"Artifact '{artifact_id}' not found")
    file_path = a.get("path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Artifact file not found at '{file_path}'")
    return FileResponse(
        file_path,
        filename=os.path.basename(file_path),
        media_type="application/octet-stream"
    )
