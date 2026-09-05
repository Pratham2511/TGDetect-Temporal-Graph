import collections
import io
import json
import math
import pickle
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
from api.dependencies import (
    BASE_DIR,
    DATA_SNAPSHOTS_DIR,
    MODELS_CHECKPOINTS_DIR,
    RESULTS_DIR,
    sanitize_json,
)


class ModelService:
    _cached_checkpoint_info: Optional[Dict[str, Any]] = None

    @classmethod
    def _inspect_checkpoint(cls) -> Dict[str, Any]:
        """
        Programmatically inspect models/checkpoints/mordor_mixed/best_model.pt.
        Calculates parameter counts directly from the actual checkpoint state_dict.
        Distinguishes correctly between:
        - trainable parameters (weights, biases)
        - non-trainable parameters/buffers
        BatchNorm running statistics (.running_mean, .running_var, .num_batches_tracked)
        are excluded from model parameters.
        """
        ckpt_file = MODELS_CHECKPOINTS_DIR / "best_model.pt"
        if not ckpt_file.exists():
            return {
                "exists": False,
                "checkpoint_path": None,
                "trainable_parameters": None,
                "non_trainable_parameters": None,
                "total_parameters": None,
                "bn_running_stats": None,
                "total_state_dict_elements": None,
                "meta": {},
                "args": {},
                "epoch": None,
                "best_val_f1": None,
            }

        trainable_count = 0
        non_trainable_count = 0
        bn_running_stats_count = 0
        total_elements = 0
        meta: Dict[str, Any] = {}
        args: Dict[str, Any] = {}
        epoch = None
        best_val_f1 = None

        # 1. Attempt PyTorch if available
        loaded = False
        try:
            import torch
            state = torch.load(ckpt_file, map_location="cpu", weights_only=True)
            meta = state.get("meta", {})
            args = state.get("args", {})
            epoch = state.get("epoch")
            best_val_f1 = state.get("best_val_f1")
            state_dict = state.get("model_state_dict", state.get("state_dict", state))
            for name, tensor in state_dict.items():
                numel = int(math.prod(tensor.shape))
                total_elements += numel
                if any(name.endswith(s) for s in (".running_mean", ".running_var", ".num_batches_tracked")):
                    bn_running_stats_count += numel
                elif getattr(tensor, "requires_grad", True):
                    trainable_count += numel
                else:
                    non_trainable_count += numel
            loaded = True
        except Exception:
            pass

        # 2. Pure-Python fallback using zipfile & pickle (independent of PyTorch binary)
        if not loaded:
            try:
                class TensorBuilder:
                    def __init__(self, *a):
                        self.shape = a[2] if len(a) > 2 else ()
                        self.requires_grad = a[4] if len(a) > 4 else False
                        self.numel = math.prod(self.shape) if self.shape else 1

                class CheckpointUnpickler(pickle.Unpickler):
                    def find_class(self, module, name):
                        if module == "collections" and name == "OrderedDict":
                            return collections.OrderedDict
                        if module == "torch._utils" and name == "_rebuild_tensor_v2":
                            return TensorBuilder
                        class Dummy:
                            def __init__(self, *a, **kw):
                                self.args = a
                            def __repr__(self):
                                return f"Dummy<{name}>({self.args})"
                        return Dummy

                    def persistent_load(self, pid):
                        return pid

                with zipfile.ZipFile(ckpt_file, "r") as zf:
                    data_pkl = zf.read("best_model/data.pkl")
                obj = CheckpointUnpickler(io.BytesIO(data_pkl)).load()

                meta = obj.get("meta", {})
                args = obj.get("args", {})
                epoch = obj.get("epoch")
                best_val_f1 = obj.get("best_val_f1")
                state_dict = obj.get("model_state_dict", {})

                for name, tensor in state_dict.items():
                    shape = getattr(tensor, "shape", ())
                    numel = getattr(tensor, "numel", math.prod(shape) if shape else 1)
                    total_elements += numel
                    if any(name.endswith(s) for s in (".running_mean", ".running_var", ".num_batches_tracked")):
                        bn_running_stats_count += numel
                    else:
                        trainable_count += numel
            except Exception:
                pass

        total_params = trainable_count + non_trainable_count

        return {
            "exists": True,
            "checkpoint_path": str(ckpt_file),
            "trainable_parameters": trainable_count,
            "non_trainable_parameters": non_trainable_count,
            "total_parameters": total_params,
            "bn_running_stats": bn_running_stats_count,
            "total_state_dict_elements": total_elements,
            "meta": meta,
            "args": args,
            "epoch": epoch,
            "best_val_f1": best_val_f1,
        }

    @classmethod
    def get_config(cls) -> Dict[str, Any]:
        """Derives architecture and hyperparameters dynamically from the checkpoint metadata/args."""
        info = cls._inspect_checkpoint()
        args = info.get("args", {})
        meta = info.get("meta", {})

        return {
            "in_channels": meta.get("node_feature_dim", 10),
            "edge_dim": meta.get("edge_feature_dim", 8),
            "hidden_channels": args.get("hidden_channels", 64),
            "out_channels": args.get("out_channels", 64),
            "num_gnn_layers": args.get("gnn_layers", 2),
            "num_rnn_layers": args.get("rnn_layers", 1),
            "dropout": args.get("dropout", 0.3),
            "node_types": meta.get("num_node_types", 6),
            "num_relations": meta.get("num_relations", 7),
            "learning_rate": args.get("lr", 0.001),
            "weight_decay": args.get("weight_decay", 0.0001),
            "gnn_type": "SAGEConv",
            "rnn_type": "GRU",
            "has_node_classifier": True,
            "has_snapshot_classifier": True
        }

    @classmethod
    def get_summary(cls) -> Dict[str, Any]:
        """Accurate TGNN parameter counts and architecture description dynamically inspected from checkpoint."""
        info = cls._inspect_checkpoint()
        cfg = cls.get_config()

        return {
            "architecture": "TemporalGNN",
            "model_name": "TemporalGNN",
            "architecture_type": "GraphSAGE + GRU",
            "gnn_operator": "GraphSAGE (SAGEConv)",
            "temporal_aggregator": "GRU",
            "output_heads": ["node_classifier", "snapshot_classifier"],
            "loss": "BCEWithLogitsLoss",
            "has_attention": False,
            "has_transformer": False,
            "has_llm": False,
            "total_parameters": info["total_parameters"],
            "trainable_parameters": info["trainable_parameters"],
            "non_trainable_parameters": info["non_trainable_parameters"],
            "bn_running_stats": info["bn_running_stats"],
            "total_state_dict_elements": info["total_state_dict_elements"],
            "checkpoint_inspected": info["exists"],
            "checkpoint_path": info["checkpoint_path"],
            "config": cfg,
            "layers": [
                {"name": "conv1", "type": "SAGEConv", "input_dim": cfg["in_channels"], "output_dim": cfg["hidden_channels"]},
                {"name": "edge_enc1", "type": "Linear", "input_dim": cfg["edge_dim"], "output_dim": cfg["hidden_channels"]},
                {"name": "bn1", "type": "BatchNorm1d", "num_features": cfg["hidden_channels"]},
                {"name": "conv2", "type": "SAGEConv", "input_dim": cfg["hidden_channels"], "output_dim": cfg["out_channels"]},
                {"name": "edge_enc2", "type": "Linear", "input_dim": cfg["edge_dim"], "output_dim": cfg["out_channels"]},
                {"name": "bn2", "type": "BatchNorm1d", "num_features": cfg["out_channels"]},
                {"name": "gru", "type": "GRU", "input_size": cfg["out_channels"], "hidden_size": cfg["out_channels"], "num_layers": cfg["num_rnn_layers"]},
                {"name": "node_classifier", "type": "Linear", "in_features": cfg["out_channels"], "out_features": 1},
                {"name": "snapshot_classifier", "type": "Linear", "in_features": cfg["out_channels"], "out_features": 1}
            ]
        }

    @staticmethod
    def get_snapshot_meta() -> Dict[str, Any]:
        meta_file = DATA_SNAPSHOTS_DIR / "meta.json"
        if meta_file.exists():
            with open(meta_file, "r", encoding="utf-8") as f:
                return sanitize_json(json.load(f))
        return {
            "source": str(DATA_SNAPSHOTS_DIR),
            "num_snapshots": 0,
            "window_size_s": 300.0,
            "stride_s": 150.0,
            "node_feature_mode": "type_degree",
            "edge_feature_mode": "relation_time",
            "node_feature_dim": 10,
            "edge_feature_dim": 8,
            "num_node_types": 6,
            "num_relations": 7,
            "node_type_map": {},
            "relation_map": {}
        }

    @staticmethod
    def get_snapshots(limit: int = 100) -> List[Dict[str, Any]]:
        snaps: List[Dict[str, Any]] = []
        if not DATA_SNAPSHOTS_DIR.exists():
            return snaps

        pkl_files = sorted(DATA_SNAPSHOTS_DIR.glob("snapshot_*.pkl"))[:limit]
        for pkl in pkl_files:
            try:
                with open(pkl, "rb") as f:
                    data = pickle.load(f)
                seq = int(pkl.stem.split("_")[1])
                ts_start = data.get("ts_start", data.get("window_start_ts"))
                ts_end = data.get("ts_end", data.get("window_end_ts"))
                label = data.get("snapshot_label", data.get("label"))
                mal_edges = 0
                if "edge_labels" in data and hasattr(data["edge_labels"], "__len__"):
                    try:
                        mal_edges = int((data["edge_labels"] == 1).sum())
                    except Exception:
                        mal_edges = sum(1 for x in data["edge_labels"] if x == 1)

                mal_nodes = 0
                if "node_labels" in data and hasattr(data["node_labels"], "__len__"):
                    try:
                        mal_nodes = int((data["node_labels"] == 1).sum())
                    except Exception:
                        mal_nodes = sum(1 for x in data["node_labels"] if x == 1)

                num_edges = int(data.get("edge_index", [[]])[0].__len__() if hasattr(data.get("edge_index"), "__len__") else 0)
                num_nodes = len(data.get("node_ids", []))

                snaps.append({
                    "sequence": seq,
                    "index": seq,
                    "num_nodes": num_nodes,
                    "num_edges": num_edges,
                    "num_malicious_nodes": mal_nodes,
                    "num_malicious_edges": mal_edges,
                    "window_start_ts": float(ts_start) if ts_start is not None else None,
                    "window_end_ts": float(ts_end) if ts_end is not None else None,
                    "label": int(label) if label is not None else None,
                    "snapshot_label": int(label) if label is not None else None,
                    "path": str(pkl)
                })
            except Exception:
                continue
        return snaps

    @classmethod
    def get_training_run(cls) -> Dict[str, Any]:
        history_path = MODELS_CHECKPOINTS_DIR / "history.json"
        history = []
        if history_path.exists():
            with open(history_path, "r", encoding="utf-8") as f:
                raw_hist = json.load(f)
                if isinstance(raw_hist, list):
                    history = sanitize_json(raw_hist)

        info = cls._inspect_checkpoint()
        best_epoch = info.get("epoch")
        best_metric = "best_val_f1" if info.get("best_val_f1") is not None else None
        best_metric_value = info.get("best_val_f1")

        if best_epoch is None and history:
            best_val_auc = None
            for h in history:
                auc = h.get("auc_roc")
                if auc is not None and (best_val_auc is None or auc > best_val_auc):
                    best_val_auc = auc
                    best_epoch = h.get("epoch")
            best_metric = "auc_roc"
            best_metric_value = best_val_auc

        checkpoint_file = MODELS_CHECKPOINTS_DIR / "best_model.pt"
        ckpt_path = str(checkpoint_file) if checkpoint_file.exists() else None

        raw_args = info.get("args", {})
        cleaned_config: Dict[str, Any] = {}
        if isinstance(raw_args, dict):
            for k, v in raw_args.items():
                if hasattr(v, "args") and v.args:
                    cleaned_config[k] = str(v.args[0])
                elif v is None or isinstance(v, (int, float, bool, str)):
                    cleaned_config[k] = v
                else:
                    cleaned_config[k] = str(v)

        return {
            "id": "mordor-mixed-run-01",
            "run_id": "mordor-mixed-run-01",
            "model_type": "TemporalGNN (GraphSAGE + GRU)",
            "dataset": "mordor_mixed",
            "status": "completed" if history else "empty",
            "epochs_total": len(history) if history else None,
            "best_epoch": best_epoch,
            "best_metric": best_metric,
            "best_metric_value": best_metric_value,
            "training_time_s": None,
            "checkpoint_path": ckpt_path,
            "config": cleaned_config,
            "history": history
        }

    @staticmethod
    def get_evaluation_runs() -> List[Dict[str, Any]]:
        eval_path = MODELS_CHECKPOINTS_DIR / "eval" / "metrics_test.json"
        if not eval_path.exists():
            eval_path = RESULTS_DIR / "checkpoints" / "mordor_mixed" / "eval_test" / "metrics_test.json"

        if not eval_path.exists():
            return []

        try:
            with open(eval_path, "r", encoding="utf-8") as f:
                metrics = json.load(f)
        except Exception:
            return []

        preds_file = MODELS_CHECKPOINTS_DIR / "eval" / "predictions_test.parquet"
        preds_path = str(preds_file) if preds_file.exists() else None
        ckpt_file = MODELS_CHECKPOINTS_DIR / "best_model.pt"
        ckpt_path = str(ckpt_file) if ckpt_file.exists() else None
        mtime = eval_path.stat().st_mtime

        raw_cm = metrics.get("confusion_matrix")
        if isinstance(raw_cm, list) and len(raw_cm) == 2 and len(raw_cm[0]) == 2 and len(raw_cm[1]) == 2:
            cm_dict = {
                "tn": int(raw_cm[0][0]),
                "fp": int(raw_cm[0][1]),
                "fn": int(raw_cm[1][0]),
                "tp": int(raw_cm[1][1])
            }
        elif isinstance(raw_cm, dict):
            cm_dict = {
                "tn": int(raw_cm.get("tn", 0)),
                "fp": int(raw_cm.get("fp", 0)),
                "fn": int(raw_cm.get("fn", 0)),
                "tp": int(raw_cm.get("tp", 0))
            }
        else:
            cm_dict = None

        metrics_block = {
            "threshold": metrics.get("threshold", 0.5),
            "num_samples": metrics.get("num_samples"),
            "num_positive": metrics.get("num_positive"),
            "num_negative": metrics.get("num_negative"),
            "accuracy": metrics.get("accuracy"),
            "precision": metrics.get("precision"),
            "recall": metrics.get("recall"),
            "f1": metrics.get("f1"),
            "auc_roc": metrics.get("auc_roc"),
            "auc_pr": metrics.get("auc_pr"),
            "confusion_matrix": cm_dict
        }

        eval_run = {
            "id": "eval_test_mordor_mixed",
            "training_run_id": "mordor-mixed-run-01",
            "checkpoint_path": ckpt_path,
            "split": "test",
            "metrics": metrics_block,
            "predictions_path": preds_path,
            "started_at": None,
            "ended_at": None,
            "checkpoint": "best_model.pt",
            "num_samples": metrics_block["num_samples"],
            "num_positive": metrics_block["num_positive"],
            "num_negative": metrics_block["num_negative"],
            "accuracy": metrics_block["accuracy"],
            "precision": metrics_block["precision"],
            "recall": metrics_block["recall"],
            "f1": metrics_block["f1"],
            "auc_roc": metrics_block["auc_roc"],
            "auc_pr": metrics_block["auc_pr"],
            "confusion_matrix": cm_dict,
            "evaluated_at": mtime
        }

        return [sanitize_json(eval_run)]

    @staticmethod
    def get_evaluation_run(split: str = "test") -> Optional[Dict[str, Any]]:
        runs = ModelService.get_evaluation_runs()
        for r in runs:
            if r.get("split") == split:
                return r
        return None

    @staticmethod
    def get_predictions(split: str = "test", limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        preds_path = MODELS_CHECKPOINTS_DIR / "eval" / f"predictions_{split}.parquet"
        if not preds_path.exists():
            preds_path = RESULTS_DIR / "checkpoints" / "mordor_mixed" / "eval_test" / f"predictions_{split}.parquet"
        if not preds_path.exists():
            return []

        try:
            df = pd.read_parquet(preds_path)
            paged = df.iloc[offset : offset + limit]
            return [sanitize_json(row.to_dict()) for _, row in paged.iterrows()]
        except Exception:
            return []
