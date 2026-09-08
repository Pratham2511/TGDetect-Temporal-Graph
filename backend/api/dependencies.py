import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
import pyarrow.parquet as pq

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PROCESSED_DIR = BASE_DIR / "data" / "processed" / "ctu13_c47"
DATA_GRAPHS_DIR = BASE_DIR / "data" / "graphs"
DATA_SNAPSHOTS_DIR = BASE_DIR / "data" / "snapshots" / "ctu13_c47"
MODELS_CHECKPOINTS_DIR = BASE_DIR / "models" / "checkpoints" / "ctu13_ho_c47"
RESULTS_DIR = BASE_DIR / "results" / "ctu13_ho_c47"

def sanitize_json(val: Any) -> Any:
    """Recursively convert NumPy/NaN/float values to JSON-safe Python primitives."""
    if isinstance(val, (int, str, bool)):
        return val
    if val is None:
        return None
    if isinstance(val, float):
        if val != val or val == float("inf") or val == float("-inf"):
            return None
        return val
    if isinstance(val, dict):
        return {k: sanitize_json(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set)):
        return [sanitize_json(v) for v in val]
    if hasattr(val, "tolist") and callable(val.tolist):
        return [sanitize_json(v) for v in val.tolist()]
    if hasattr(val, "item") and callable(val.item):
        try:
            return sanitize_json(val.item())
        except (ValueError, AttributeError):
            pass
    return str(val)

class DataCache:
    _active_dataset_id: str = "ctu13_c47"
    _events_df: Optional[pd.DataFrame] = None
    _nodes_df: Optional[pd.DataFrame] = None
    _edges_df: Optional[pd.DataFrame] = None
    _chains_df: Optional[pd.DataFrame] = None
    _graph_stats: Optional[Dict[str, Any]] = None

    @classmethod
    def get_active_dataset_id(cls) -> str:
        return cls._active_dataset_id

    @classmethod
    def set_active_dataset(cls, dataset_id: str) -> None:
        if dataset_id and dataset_id != cls._active_dataset_id:
            cls._active_dataset_id = dataset_id
            cls.clear_cache()

    @classmethod
    def clear_cache(cls) -> None:
        cls._events_df = None
        cls._nodes_df = None
        cls._edges_df = None
        cls._chains_df = None
        cls._graph_stats = None

    @classmethod
    def get_dataset_dir(cls, dataset_id: Optional[str] = None) -> Path:
        target = dataset_id or cls._active_dataset_id
        return BASE_DIR / "data" / "processed" / target

    @classmethod
    def get_events_df(cls) -> pd.DataFrame:
        if cls._events_df is None:
            path = cls.get_dataset_dir() / "events.parquet"
            if path.exists():
                df = pd.read_parquet(path)
                # Keep attrs as raw JSON string for high-speed streaming & zero-copy loads.
                # attrs is parsed lazily on-demand only for requested pages in events_service.
                cls._events_df = df
            else:
                cls._events_df = pd.DataFrame()
        return cls._events_df

    @classmethod
    def get_nodes_df(cls) -> pd.DataFrame:
        if cls._nodes_df is None:
            path = cls.get_dataset_dir() / "nodes.parquet"
            if path.exists():
                cls._nodes_df = pd.read_parquet(path)
            else:
                cls._nodes_df = pd.DataFrame()
        return cls._nodes_df

    @classmethod
    def get_edges_df(cls) -> pd.DataFrame:
        if cls._edges_df is None:
            path = cls.get_dataset_dir() / "edges.parquet"
            if path.exists():
                cls._edges_df = pd.read_parquet(path)
            else:
                cls._edges_df = pd.DataFrame()
        return cls._edges_df

    @classmethod
    def get_chains_df(cls) -> pd.DataFrame:
        if cls._chains_df is None:
            path = cls.get_dataset_dir() / "chains_summary.parquet"
            if path.exists():
                df = pd.read_parquet(path)
                for col in ["tactic_sequence", "stage_sequence", "relation_sequence", "nodes", "event_ids"]:
                    if col in df.columns:
                        df[col] = df[col].apply(lambda x: list(x) if hasattr(x, "__iter__") and not isinstance(x, str) else [])
                cls._chains_df = df
            else:
                cls._chains_df = pd.DataFrame()
        return cls._chains_df

    @classmethod
    def get_graph_stats(cls) -> Dict[str, Any]:
        if cls._graph_stats is None:
            path = cls.get_dataset_dir() / "graph_stats.json"
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    cls._graph_stats = json.load(f)
            else:
                cls._graph_stats = {}
            if cls._graph_stats:
                norm = cls._graph_stats.setdefault("normalization", {})
                if "seen" not in norm:
                    norm["seen"] = norm.get("accepted", 0) + norm.get("rejected", 0)
                labeling = cls._graph_stats.setdefault("labeling", {})
                graph = cls._graph_stats.get("graph", {})
                if "benign_events" not in labeling:
                    labeling["benign_events"] = graph.get("benign_events", max(0, graph.get("total_events", 0) - labeling.get("malicious_events", 0)))
                if "total_events" not in labeling:
                    labeling["total_events"] = graph.get("total_events", labeling.get("benign_events", 0) + labeling.get("malicious_events", 0))
        return cls._graph_stats
