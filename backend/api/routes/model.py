from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from api.services.model_service import ModelService

router = APIRouter(tags=["model"])

@router.get("/model/config")
def get_model_config():
    return ModelService.get_config()

@router.get("/model/summary")
def get_model_summary():
    return ModelService.get_summary()

@router.get("/model/snapshots")
def get_model_snapshots(limit: int = Query(100, ge=1, le=500)):
    return {
        "meta": ModelService.get_snapshot_meta(),
        "snapshots": ModelService.get_snapshots(limit=limit)
    }

@router.get("/model/snapshots/meta")
def get_snapshot_meta():
    return ModelService.get_snapshot_meta()

@router.get("/model/training")
def get_training_run():
    return ModelService.get_training_run()

@router.get("/model/training/history")
def get_training_history():
    run = ModelService.get_training_run()
    return run.get("history", [])

@router.get("/model/evaluation")
def get_evaluation(split: Optional[str] = Query("test", description="train | val | test")):
    eval_run = ModelService.get_evaluation_run(split=split)
    if not eval_run:
        raise HTTPException(status_code=404, detail=f"Evaluation for split '{split}' not found")
    return eval_run

@router.get("/model/evaluation/runs")
def get_evaluation_runs():
    return ModelService.get_evaluation_runs()

@router.get("/model/predictions")
def get_predictions(
    split: str = Query("test", description="train | val | test"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    return ModelService.get_predictions(split=split, limit=limit, offset=offset)
