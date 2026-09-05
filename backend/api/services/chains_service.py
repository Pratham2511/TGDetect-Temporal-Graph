import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
from api.dependencies import DATA_GRAPHS_DIR, DataCache, sanitize_json

class ChainsService:
    @staticmethod
    def list_chains(strategy: Optional[str] = None) -> List[Dict[str, Any]]:
        df = DataCache.get_chains_df()
        if df.empty:
            return []
        if strategy:
            df = df[df["strategy"] == strategy]
        return [sanitize_json(row.to_dict()) for _, row in df.iterrows()]

    @staticmethod
    def get_chain(chain_id: str) -> Optional[Dict[str, Any]]:
        df = DataCache.get_chains_df()
        if df.empty:
            return None
        match = df[df["chain_id"] == chain_id]
        if match.empty:
            return None
        return sanitize_json(match.iloc[0].to_dict())

    @staticmethod
    def get_subgraph(chain_id: str) -> Optional[Dict[str, Any]]:
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in chain_id)
        path = DATA_GRAPHS_DIR / "chains" / f"{safe}.json"
        if not path.exists():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return sanitize_json(data)
        except Exception:
            return None

    @staticmethod
    def get_all_strategies() -> Dict[str, List[Dict[str, Any]]]:
        df = DataCache.get_chains_df()
        res: Dict[str, List[Dict[str, Any]]] = {
            "chain_id": [],
            "causal_parent": [],
            "entity_time": []
        }
        if df.empty:
            return res

        for strat in ["chain_id", "causal_parent", "entity_time"]:
            sub = df[df["strategy"] == strat]
            res[strat] = [sanitize_json(row.to_dict()) for _, row in sub.iterrows()]
        return res
