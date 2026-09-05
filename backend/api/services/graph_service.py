from typing import Any, Dict, List, Optional
import pandas as pd
from api.dependencies import DataCache, sanitize_json

class GraphService:
    @staticmethod
    def get_nodes() -> List[Dict[str, Any]]:
        df = DataCache.get_nodes_df()
        if df.empty:
            return []
        return [sanitize_json(row.to_dict()) for _, row in df.iterrows()]

    @staticmethod
    def get_edges(limit: Optional[int] = None) -> List[Dict[str, Any]]:
        df = DataCache.get_edges_df()
        if df.empty:
            return []
        subset = df if limit is None else df.head(limit)
        return [sanitize_json(row.to_dict()) for _, row in subset.iterrows()]

    @staticmethod
    def get_graph(
        malicious_only: bool = False,
        node_type: Optional[str] = None,
        relation: Optional[str] = None,
        chain_id: Optional[str] = None,
        limit: int = 1000
    ) -> Dict[str, Any]:
        nodes_df = DataCache.get_nodes_df()
        edges_df = DataCache.get_edges_df()
        stats = DataCache.get_graph_stats()

        if nodes_df.empty or edges_df.empty:
            return {"nodes": [], "edges": [], "stats": stats}

        f_edges = edges_df
        if malicious_only:
            f_edges = f_edges[f_edges["label"] == 1]
        if relation:
            f_edges = f_edges[f_edges["relation"] == relation]
        if chain_id:
            c_df = DataCache.get_chains_df()
            matching_event_ids = set()
            if not c_df.empty and "chain_id" in c_df.columns and "event_ids" in c_df.columns:
                match = c_df[c_df["chain_id"] == chain_id]
                if not match.empty:
                    e_ids = match.iloc[0].get("event_ids", [])
                    if isinstance(e_ids, (list, tuple, set)):
                        matching_event_ids = set(e_ids)
            if matching_event_ids:
                f_edges = f_edges[f_edges["event_id"].isin(matching_event_ids) | (f_edges["chain_id"] == chain_id)]
            else:
                f_edges = f_edges[f_edges["chain_id"] == chain_id]

        if limit:
            f_edges = f_edges.head(limit)

        connected_nodes = set(f_edges["src_id"]).union(set(f_edges["dst_id"]))
        f_nodes = nodes_df[nodes_df["node_id"].isin(connected_nodes)]

        if node_type:
            f_nodes = f_nodes[f_nodes["node_type"] == node_type]
            valid_ids = set(f_nodes["node_id"])
            f_edges = f_edges[f_edges["src_id"].isin(valid_ids) | f_edges["dst_id"].isin(valid_ids)]

        return {
            "nodes": [sanitize_json(r.to_dict()) for _, r in f_nodes.iterrows()],
            "edges": [sanitize_json(r.to_dict()) for _, r in f_edges.iterrows()],
            "stats": sanitize_json(stats)
        }

    @staticmethod
    def get_node_detail(node_id: str) -> Optional[Dict[str, Any]]:
        nodes_df = DataCache.get_nodes_df()
        if nodes_df.empty:
            return None
        match = nodes_df[nodes_df["node_id"] == node_id]
        if match.empty:
            return None
        node_info = sanitize_json(match.iloc[0].to_dict())
        
        # Get incident events
        events_df = DataCache.get_events_df()
        incident_events = []
        if not events_df.empty:
            evts = events_df[(events_df["src_id"] == node_id) | (events_df["dst_id"] == node_id)]
            incident_events = [sanitize_json(r.to_dict()) for _, r in evts.head(50).iterrows()]

        node_info["incident_events"] = incident_events
        return node_info

    @staticmethod
    def get_stats() -> Dict[str, Any]:
        return sanitize_json(DataCache.get_graph_stats())
