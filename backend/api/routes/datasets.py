from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from api.dependencies import DataCache
from api.services.datasets_service import DatasetsService

router = APIRouter(tags=["datasets"])


class ValidateRequest(BaseModel):
    file_path: str
    format: Optional[str] = None


class ProcessRequest(BaseModel):
    dataset_id: str
    format: str
    source_path: str
    config: Optional[Dict[str, Any]] = None


@router.get("/datasets")
def list_datasets():
    return DatasetsService.list_datasets()


@router.get("/datasets/active")
def get_active_dataset():
    active_id = DataCache.get_active_dataset_id()
    d = DatasetsService.get_dataset(active_id)
    if not d:
        return {
            "id": active_id,
            "name": active_id.replace("_", " ").title(),
            "kind": "user_uploaded",
            "source": str(DataCache.get_dataset_dir(active_id)),
            "provenance": f"Processed dataset {active_id}",
            "raw_bytes": 0,
            "num_raw_events": 0,
            "time_span_s": 0.0,
            "created_at": None,
            "is_sample": False,
            "description": f"Active dataset {active_id}",
        }
    return d


@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    d = DatasetsService.get_dataset(dataset_id)
    if not d:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
    return d


@router.post("/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    format: Optional[str] = Form(None),
    validate_only: bool = Form(False),
):
    try:
        content = await file.read()
        saved_path = DatasetsService.save_upload(content, file.filename)
        report = DatasetsService.validate_dataset(saved_path, format_name=format)
        report["saved_path"] = saved_path
        report["filename"] = file.filename
        return report
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Upload failed: {str(exc)}")


@router.post("/datasets/validate")
def validate_dataset(req: ValidateRequest):
    try:
        report = DatasetsService.validate_dataset(req.file_path, format_name=req.format)
        return report
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(exc)}")


@router.post("/datasets/process")
def process_dataset(req: ProcessRequest):
    try:
        job = DatasetsService.process_dataset(
            dataset_id=req.dataset_id,
            format_name=req.format,
            source_path=req.source_path,
            config=req.config,
        )
        return job
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(exc)}")


@router.post("/datasets/{dataset_id}/activate")
def activate_dataset(dataset_id: str):
    d = DatasetsService.get_dataset(dataset_id)
    if not d:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
    DataCache.set_active_dataset(dataset_id)
    return {"status": "ok", "active_dataset": dataset_id, "active_dataset_id": dataset_id, "dataset": d}


@router.get("/jobs")
def list_jobs():
    return DatasetsService.list_jobs()


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    j = DatasetsService.get_job(job_id)
    if not j:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return j
