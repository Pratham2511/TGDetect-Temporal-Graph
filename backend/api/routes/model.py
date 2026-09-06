from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from api.services.model_service import ModelService

router = APIRouter(tags=["model"])

@router.get("/models")
@router.get("/model/models")
def list_models():
    return ModelService.list_models()

@router.get("/models/{model_id}")
def get_model(model_id: str):
    models = ModelService.list_models()
    for m in models:
        if m.get("id") == model_id:
            return m
    raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

@router.get("/model/config")
def get_model_config(
    model_id: Optional[str] = Query(None, description="Optional model identifier (mordor_mixed | ctu13_ho_c47)"),
    ckpt_file: Optional[str] = Query(None, description="Optional checkpoint path"),
):
    return ModelService.get_config(ckpt_file=ckpt_file, model_id=model_id)

@router.get("/model/summary")
def get_model_summary(
    model_id: Optional[str] = Query(None, description="Optional model identifier (mordor_mixed | ctu13_ho_c47)"),
    ckpt_file: Optional[str] = Query(None, description="Optional checkpoint path"),
):
    return ModelService.get_summary(ckpt_file=ckpt_file, model_id=model_id)

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
def get_training_run(
    run_id: Optional[str] = Query(None, description="Optional training run ID"),
    model_id: Optional[str] = Query(None, description="Optional model ID"),
):
    return ModelService.get_training_run(run_id=run_id, model_id=model_id)

@router.get("/model/training/history")
def get_training_history(
    run_id: Optional[str] = Query(None, description="Optional training run ID"),
    model_id: Optional[str] = Query(None, description="Optional model ID"),
):
    run = ModelService.get_training_run(run_id=run_id, model_id=model_id)
    return run.get("history", [])

@router.get("/model/evaluation")
def get_evaluation(
    split: Optional[str] = Query("test", description="train | val | test"),
    run_id: Optional[str] = Query(None, description="Optional run ID (e.g. eval_test_ctu13_ho_c47)"),
    model_id: Optional[str] = Query(None, description="Optional model ID (e.g. ctu13_ho_c47 | mordor_mixed)"),
):
    eval_run = ModelService.get_evaluation_run(split=split, run_id=run_id, model_id=model_id)
    if not eval_run:
        detail = f"Evaluation for run '{run_id}' not found" if run_id else f"Evaluation for split '{split}' not found"
        raise HTTPException(status_code=404, detail=detail)
    return eval_run

@router.get("/model/evaluation/runs")
def get_evaluation_runs():
    return ModelService.get_evaluation_runs()

@router.get("/model/predictions")
def get_predictions(
    split: str = Query("test", description="train | val | test"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    run_id: Optional[str] = Query(None, description="Optional run ID (e.g. eval_test_ctu13_ho_c47)"),
    model_id: Optional[str] = Query(None, description="Optional model ID (e.g. ctu13_ho_c47 | mordor_mixed)"),
):
    return ModelService.get_predictions(split=split, limit=limit, offset=offset, run_id=run_id, model_id=model_id)
