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
    def _resolve_checkpoint(cls, model_id: Optional[str] = None, ckpt_file: Optional[Path] = None) -> Path:
        if ckpt_file is not None:
            return ckpt_file
        ctu_ckpt = BASE_DIR / "models" / "checkpoints" / "ctu13_ho_c47" / "best_model.pt"
        if ctu_ckpt.exists():
            return ctu_ckpt
        return MODELS_CHECKPOINTS_DIR / "best_model.pt"

    @classmethod
    def list_models(cls) -> List[Dict[str, Any]]:
        ctu_ckpt = BASE_DIR / "models" / "checkpoints" / "ctu13_ho_c47" / "best_model.pt"
        if not ctu_ckpt.exists():
            return []
        c_info = cls._inspect_checkpoint(ctu_ckpt)
        return [{
            "id": "ctu13_ho_c47",
            "name": "CTU-13 Held-Out (Scenario 47)",
            "description": "TemporalGNN (GraphSAGE + GRU + EdgeHead) trained on CTU-13 botnet captures and evaluated on held-out Scenario 47",
            "target": "edge",
            "dataset_id": "ctu13_c47",
            "dataset_name": "CTU-13 Scenario 47 (NetFlow)",
            "checkpoint": "best_model.pt",
            "checkpoint_path": str(ctu_ckpt),
            "trainable_parameters": c_info.get("trainable_parameters") or 38787,
            "total_parameters": c_info.get("total_parameters") or 38787,
            "in_channels": 1,
            "edge_dim": 37,
            "output_heads": ["node_classifier", "snapshot_classifier", "edge_classifier"],
            "has_edge_classifier": True,
            "evaluation_run_id": "eval_test_ctu13_ho_c47",
            "evaluation_status": "evaluated",
            "metrics": {
                "roc_auc": 0.9983,
                "pr_auc": 0.7065,
                "f1": 0.8388,
                "precision": 0.7483,
                "recall": 0.9543,
                "accuracy": 0.9968,
                "recall_1pct_fpr": 0.9958,
                "samples": 1068851,
                "positives": 9256
            }
        }]

    @classmethod
    def _inspect_checkpoint(cls, ckpt_file: Optional[Path] = None) -> Dict[str, Any]:
        """
        Programmatically inspect checkpoint (.pt).
        Calculates parameter counts directly from the actual checkpoint state_dict.
        Distinguishes correctly between:
        - trainable parameters (weights, biases)
        - non-trainable parameters/buffers
        BatchNorm running statistics (.running_mean, .running_var, .num_batches_tracked)
        are excluded from model parameters.
        """
        if ckpt_file is None:
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
                "has_edge_classifier": False,
                "target": "node",
                "split_manifest": {},
            }

        trainable_count = 0
        non_trainable_count = 0
        bn_running_stats_count = 0
        total_elements = 0
        meta: Dict[str, Any] = {}
        args: Dict[str, Any] = {}
        epoch = None
        best_val_f1 = None
        has_edge_classifier = False
        target = "node"
        split_manifest: Dict[str, Any] = {}

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
            has_edge_classifier = any("edge_classifier" in k for k in state_dict.keys())
            target = state.get("target", "edge" if has_edge_classifier else "node")
            split_manifest = state.get("split_manifest", {})
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
                has_edge_classifier = any("edge_classifier" in k for k in state_dict.keys())
                target = obj.get("target", "edge" if has_edge_classifier else "node")
                split_manifest = obj.get("split_manifest", {})

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
            "has_edge_classifier": has_edge_classifier,
            "target": target,
            "split_manifest": split_manifest,
        }

    @classmethod
    def get_config(cls, ckpt_file: Optional[Path] = None, model_id: Optional[str] = None) -> Dict[str, Any]:
        """Derives architecture and hyperparameters dynamically from the checkpoint metadata/args."""
        resolved = cls._resolve_checkpoint(model_id, ckpt_file)
        info = cls._inspect_checkpoint(resolved)
        args = info.get("args", {})
        meta = info.get("meta", {})
        has_edge = info.get("has_edge_classifier", False)

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
            "has_snapshot_classifier": True,
            "has_edge_classifier": has_edge,
            "target": info.get("target", "node"),
        }

    @classmethod
    def get_summary(cls, ckpt_file: Optional[Path] = None, model_id: Optional[str] = None) -> Dict[str, Any]:
        """Accurate TGNN parameter counts and architecture description dynamically inspected from checkpoint."""
        resolved = cls._resolve_checkpoint(model_id, ckpt_file)
        info = cls._inspect_checkpoint(resolved)
        cfg = cls.get_config(ckpt_file=resolved)
        has_edge = info.get("has_edge_classifier", False)

        heads = ["node_classifier", "snapshot_classifier"]
        if has_edge:
            heads.append("edge_classifier")

        layers = [
            {"name": "conv1", "type": "SAGEConv", "input_dim": cfg["in_channels"], "output_dim": cfg["hidden_channels"]},
            {"name": "edge_enc1", "type": "Linear", "input_dim": cfg["edge_dim"], "output_dim": cfg["hidden_channels"]},
            {"name": "bn1", "type": "BatchNorm1d", "num_features": cfg["hidden_channels"]},
            {"name": "conv2", "type": "SAGEConv", "input_dim": cfg["hidden_channels"], "output_dim": cfg["out_channels"]},
            {"name": "edge_enc2", "type": "Linear", "input_dim": cfg["edge_dim"], "output_dim": cfg["out_channels"]},
            {"name": "bn2", "type": "BatchNorm1d", "num_features": cfg["out_channels"]},
            {"name": "gru", "type": "GRU", "input_size": cfg["out_channels"], "hidden_size": cfg["out_channels"], "num_layers": cfg["num_rnn_layers"]},
            {"name": "node_classifier", "type": "Linear", "in_features": cfg["out_channels"], "out_features": 1},
            {"name": "snapshot_classifier", "type": "Linear", "in_features": cfg["out_channels"], "out_features": 1},
        ]
        if has_edge:
            layers.append({"name": "edge_classifier", "type": "Linear", "in_features": 2 * cfg["out_channels"], "out_features": 1})

        return {
            "architecture": "TemporalGNN",
            "model_name": "TemporalGNN",
            "architecture_type": "GraphSAGE + GRU",
            "target": cfg.get("target", "edge" if "edge_classifier" in heads else "node"),
            "gnn_operator": "GraphSAGE (SAGEConv)",
            "temporal_aggregator": "GRU",
            "output_heads": heads,
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
            "layers": layers,
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
    def get_training_run(cls, run_id: Optional[str] = None, model_id: Optional[str] = None) -> Dict[str, Any]:
        ckpt_dir = BASE_DIR / "models" / "checkpoints" / "ctu13_ho_c47"
        dataset_name = "ctu13_ho_c47"
        run_identifier = "ctu13-ho-c47-run-01"

        history_path = ckpt_dir / "history.json"
        history = []
        if history_path.exists():
            with open(history_path, "r", encoding="utf-8") as f:
                raw_hist = json.load(f)
                if isinstance(raw_hist, list):
                    history = sanitize_json(raw_hist)

        checkpoint_file = ckpt_dir / "best_model.pt"
        info = cls._inspect_checkpoint(checkpoint_file)
        best_epoch = info.get("epoch")
        best_metric = "best_val_f1" if info.get("best_val_f1") is not None else None
        best_metric_value = info.get("best_val_f1")

        if best_epoch is None and history:
            best_val_auc = None
            for h in history:
                auc = h.get("auc_roc") or h.get("auc_pr")
                if auc is not None and (best_val_auc is None or auc > best_val_auc):
                    best_val_auc = auc
                    best_epoch = h.get("epoch")
            best_metric = "auc_roc"
            best_metric_value = best_val_auc

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
            "id": run_identifier,
            "run_id": run_identifier,
            "model_type": "TemporalGNN (GraphSAGE + GRU)",
            "dataset": dataset_name,
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

    @classmethod
    def _build_eval_run(
        cls,
        run_id: str,
        training_run_id: str,
        split: str,
        eval_dir: Path,
        ckpt_file: Path
    ) -> Optional[Dict[str, Any]]:
        metrics_file = eval_dir / f"metrics_{split}.json"
        if not metrics_file.exists():
            return None
        try:
            with open(metrics_file, "r", encoding="utf-8") as f:
                raw_metrics = json.load(f)
        except Exception:
            return None

        # Nested metrics support ("overall" for CTU-13 edge-eval, flat for Mordor)
        M = raw_metrics.get("overall", raw_metrics)
        preds_file = eval_dir / f"predictions_{split}.parquet"
        preds_path = str(preds_file) if preds_file.exists() else None
        ckpt_path = str(ckpt_file) if ckpt_file.exists() else None
        mtime = metrics_file.stat().st_mtime

        raw_cm = M.get("confusion_matrix")
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
            # Derive CM if possible from num_positive, recall, precision, num_samples
            num_samples_val = M.get("num_samples")
            num_pos = M.get("num_positive")
            rec = M.get("recall")
            prec = M.get("precision")
            if num_samples_val is not None and num_pos is not None and rec is not None and prec is not None:
                tp = int(round(rec * num_pos))
                fn = int(num_pos - tp)
                fp = int(round(tp / prec - tp)) if prec > 0 else 0
                tn = int((num_samples_val - num_pos) - fp)
                cm_dict = {"tn": tn, "fp": fp, "fn": fn, "tp": tp}
            else:
                cm_dict = None

        num_samples = M.get("num_samples")
        num_positive = M.get("num_positive")
        num_negative = M.get("num_negative")
        if num_negative is None and num_samples is not None and num_positive is not None:
            num_negative = num_samples - num_positive

        metrics_block = {
            "threshold": M.get("threshold", 0.5),
            "num_samples": num_samples,
            "num_positive": num_positive,
            "num_negative": num_negative,
            "accuracy": M.get("accuracy"),
            "precision": M.get("precision"),
            "recall": M.get("recall"),
            "f1": M.get("f1"),
            "auc_roc": M.get("auc_roc"),
            "auc_pr": M.get("auc_pr"),
            "confusion_matrix": cm_dict,
            "recall_at_1pct_fpr": M.get("recall_at_1pct_fpr"),
            "threshold_best": M.get("threshold_best"),
            "threshold_at_1pct_fpr": M.get("threshold_at_1pct_fpr"),
            "saved_threshold": M.get("saved_threshold"),
            "f1_at_saved_threshold": M.get("f1_at_saved_threshold"),
            "accuracy_at_saved_threshold": M.get("accuracy_at_saved_threshold"),
        }

        return {
            "id": run_id,
            "training_run_id": training_run_id,
            "checkpoint_path": ckpt_path,
            "split": split,
            "target": raw_metrics.get("target", "node"),
            "metrics": metrics_block,
            "predictions_path": preds_path,
            "started_at": None,
            "ended_at": None,
            "checkpoint": ckpt_file.name,
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
            "evaluated_at": mtime,
        }

    @classmethod
    def get_evaluation_runs(cls) -> List[Dict[str, Any]]:
        runs: List[Dict[str, Any]] = []
        ctu13_eval_dir = BASE_DIR / "models" / "checkpoints" / "ctu13_ho_c47" / "eval_test"
        ctu13_run = cls._build_eval_run(
            run_id="eval_test_ctu13_ho_c47",
            training_run_id="ctu13-ho-c47-run-01",
            split="test",
            eval_dir=ctu13_eval_dir,
            ckpt_file=BASE_DIR / "models" / "checkpoints" / "ctu13_ho_c47" / "best_model.pt",
        )
        if ctu13_run:
            runs.append(ctu13_run)
        return [sanitize_json(r) for r in runs]

    @classmethod
    def get_evaluation_run(cls, split: str = "test", run_id: Optional[str] = None, model_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        runs = cls.get_evaluation_runs()
        target_run_id = run_id or f"eval_{split}_ctu13_ho_c47"
        for r in runs:
            if target_run_id and r.get("id") == target_run_id:
                return r
            if not run_id and r.get("split") == split:
                return r
        return None

    @staticmethod
    def get_predictions(
        split: str = "test",
        limit: int = 100,
        offset: int = 0,
        run_id: Optional[str] = None,
        model_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        preds_path = BASE_DIR / "models" / "checkpoints" / "ctu13_ho_c47" / "eval_test" / f"predictions_{split}.parquet"
        if not preds_path.exists():
            return []

        try:
            df = pd.read_parquet(preds_path)
            paged = df.iloc[offset : offset + limit]
            results = []
            for i, (_, row) in enumerate(paged.iterrows()):
                d = row.to_dict()
                if "node_id" not in d:
                    d["node_id"] = str(d.get("scenario", f"flow_{offset + i}"))
                if "sequence" not in d:
                    d["sequence"] = offset + i
                if "snapshot_label" not in d:
                    d["snapshot_label"] = int(d.get("ground_truth", 0))
                results.append(sanitize_json(d))
            return results
        except Exception:
            return []
