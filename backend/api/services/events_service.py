from typing import Any, Dict, List, Optional
import pandas as pd
from api.dependencies import DATA_GRAPHS_DIR, DataCache, sanitize_json

class EventsService:
    @staticmethod
    def list_events(
        search: Optional[str] = None,
        label: Optional[int] = None,
        labels: Optional[List[int]] = None,
        node_types: Optional[List[str]] = None,
        relations: Optional[List[str]] = None,
        source_tags: Optional[List[str]] = None,
        tactics: Optional[List[str]] = None,
        chain_ids: Optional[List[str]] = None,
        start_ts: Optional[float] = None,
        end_ts: Optional[float] = None,
        node_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        df = DataCache.get_events_df()
        if df.empty:
            return {"items": [], "total": 0}

        filtered = df

        if search:
            q = search.lower()
            filtered = filtered[filtered["event_id"].str.lower().str.contains(q, na=False)]

        if labels is not None and len(labels) > 0:
            filtered = filtered[filtered["label"].isin(set(labels))]
        elif label is not None:
            filtered = filtered[filtered["label"] == int(label)]

        if node_types:
            st = set(node_types)
            filtered = filtered[filtered["src_type"].isin(st) | filtered["dst_type"].isin(st)]

        if relations:
            filtered = filtered[filtered["relation"].isin(set(relations))]

        if source_tags:
            filtered = filtered[filtered["source_tag"].isin(set(source_tags))]

        if tactics:
            tactics_set = set(tactics)
            filtered = filtered[filtered["tactics"].apply(lambda tlist: bool(set(tlist) & tactics_set))]

        if chain_ids:
            # Resolve event_ids for any non-primary chain strategy (e.g. causal_parent, entity_time)
            c_df = DataCache.get_chains_df()
            matching_event_ids = set()
            direct_chain_ids = set(chain_ids)
            if not c_df.empty and "chain_id" in c_df.columns and "event_ids" in c_df.columns:
                for _, row in c_df[c_df["chain_id"].isin(direct_chain_ids)].iterrows():
                    e_ids = row.get("event_ids", [])
                    if isinstance(e_ids, (list, tuple, set)):
                        matching_event_ids.update(e_ids)
            if matching_event_ids:
                filtered = filtered[filtered["event_id"].isin(matching_event_ids) | filtered["chain_id"].isin(direct_chain_ids)]
            else:
                filtered = filtered[filtered["chain_id"].isin(direct_chain_ids)]

        if node_id:
            filtered = filtered[(filtered["src_id"] == node_id) | (filtered["dst_id"] == node_id)]

        if start_ts is not None:
            filtered = filtered[filtered["ts"] >= start_ts]

        if end_ts is not None:
            filtered = filtered[filtered["ts"] <= end_ts]

        total = len(filtered)
        paged = filtered.iloc[offset : offset + limit]

        items = [sanitize_json(row.to_dict()) for _, row in paged.iterrows()]
        return {"items": items, "total": total}

    @staticmethod
    def get_event(event_id: str) -> Optional[Dict[str, Any]]:
        df = DataCache.get_events_df()
        if df.empty:
            return None
        matches = df[df["event_id"] == event_id]
        if matches.empty:
            return None
        return sanitize_json(matches.iloc[0].to_dict())

    @staticmethod
    def get_by_chain(chain_id: str) -> List[Dict[str, Any]]:
        df = DataCache.get_events_df()
        if df.empty:
            return []

        # 1. Lookup in chains_summary.parquet to resolve event_ids (covers causal_parent and entity_time)
        c_df = DataCache.get_chains_df()
        if not c_df.empty and "chain_id" in c_df.columns:
            chain_match = c_df[c_df["chain_id"] == chain_id]
            if not chain_match.empty:
                event_ids = chain_match.iloc[0].get("event_ids", [])
                if isinstance(event_ids, (list, tuple, set)) and len(event_ids) > 0:
                    matches = df[df["event_id"].isin(set(event_ids))].sort_values("ts")
                    if not matches.empty:
                        return [sanitize_json(row.to_dict()) for _, row in matches.iterrows()]

        # 2. Try direct column match on chain_id
        matches = df[df["chain_id"] == chain_id].sort_values("ts")
        if not matches.empty:
            return [sanitize_json(row.to_dict()) for _, row in matches.iterrows()]

        # 3. Check pre-exported subgraph JSON file
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in chain_id)
        subgraph_path = DATA_GRAPHS_DIR / "chains" / f"{safe}.json"
        if subgraph_path.exists():
            try:
                import json
                with open(subgraph_path, "r", encoding="utf-8") as f:
                    sg = json.load(f)
                edges = sg.get("edges", [])
                if edges:
                    e_ids = [e.get("event_id") for e in edges if e.get("event_id")]
                    if e_ids:
                        matches = df[df["event_id"].isin(set(e_ids))].sort_values("ts")
                        if not matches.empty:
                            return [sanitize_json(row.to_dict()) for _, row in matches.iterrows()]
                    return [sanitize_json(e) for e in edges]
            except Exception:
                pass

        return []

    @staticmethod
    def get_by_node(node_id: str) -> List[Dict[str, Any]]:
        df = DataCache.get_events_df()
        if df.empty:
            return []
        matches = df[(df["src_id"] == node_id) | (df["dst_id"] == node_id)]
        return [sanitize_json(row.to_dict()) for _, row in matches.iterrows()]

    @staticmethod
    def get_recent_malicious(limit: int = 10) -> List[Dict[str, Any]]:
        df = DataCache.get_events_df()
        if df.empty:
            return []
        mal = df[df["label"] == 1].sort_values("ts", ascending=False).head(limit)
        return [sanitize_json(row.to_dict()) for _, row in mal.iterrows()]
