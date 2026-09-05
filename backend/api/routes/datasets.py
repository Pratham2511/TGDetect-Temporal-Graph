from fastapi import APIRouter, HTTPException
from api.services.datasets_service import DatasetsService

router = APIRouter(tags=["datasets"])

@router.get("/datasets")
def list_datasets():
    return DatasetsService.list_datasets()

@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    d = DatasetsService.get_dataset(dataset_id)
    if not d:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
    return d

@router.get("/jobs")
def list_jobs():
    return DatasetsService.list_jobs()

@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    j = DatasetsService.get_job(job_id)
    if not j:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return j
