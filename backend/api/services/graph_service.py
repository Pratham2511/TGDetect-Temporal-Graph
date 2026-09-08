from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from api.dependencies import DataCache, sanitize_json

class GraphService:
    @staticmethod
    def get_nodes(limit: int = 1000, malicious_only: bool = False) -> List[Dict[str, Any]]:
        df = DataCache.get_nodes_df()
        if df.empty:
            return []
        
        filtered = df
        if malicious_only and "malicious_events" in filtered.columns:
            filtered = filtered[filtered["malicious_events"] > 0]

        # Prioritize threat hubs and highest connectivity nodes
        if "malicious_events" in filtered.columns and "out_degree" in filtered.columns and "in_degree" in filtered.columns:
            deg = filtered["out_degree"] + filtered["in_degree"]
            mal = filtered["malicious_events"]
            score = (mal * 1000) + deg
            filtered = filtered.iloc[np.argsort(-score.to_numpy())]

        subset = filtered.head(limit)
        return [sanitize_json(r) for r in subset.to_dict(orient="records")]

    @staticmethod
    def get_edges(limit: int = 2000, malicious_only: bool = False) -> List[Dict[str, Any]]:
        df = DataCache.get_edges_df()
        if df.empty:
            return []
        
        filtered = df
        if malicious_only and "label" in filtered.columns:
            filtered = filtered[filtered["label"] == 1]
        elif "label" in filtered.columns and not malicious_only:
            # Threat-first prioritized flow representation:
            # Include malicious edges first (up to half limit), then fill with representative benign flows
            mal_edges = filtered[filtered["label"] == 1]
            ben_edges = filtered[filtered["label"] == 0]
            max_mal = min(len(mal_edges), limit // 2)
            filtered = pd.concat([mal_edges.head(max_mal), ben_edges.head(limit - max_mal)])

        subset = filtered.head(limit)
        return [sanitize_json(r) for r in subset.to_dict(orient="records")]

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
        if malicious_only and "label" in f_edges.columns:
            f_edges = f_edges[f_edges["label"] == 1]
        if relation and "relation" in f_edges.columns:
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
            if matching_event_ids and "event_id" in f_edges.columns:
                f_edges = f_edges[f_edges["event_id"].isin(matching_event_ids) | (f_edges["chain_id"] == chain_id)]
            elif "chain_id" in f_edges.columns:
                f_edges = f_edges[f_edges["chain_id"] == chain_id]

        # Prioritize threats in edge sample if not strictly malicious_only
        if not malicious_only and "label" in f_edges.columns and chain_id is None:
            mal_edges = f_edges[f_edges["label"] == 1]
            ben_edges = f_edges[f_edges["label"] == 0]
            max_mal = min(len(mal_edges), limit // 2)
            f_edges = pd.concat([mal_edges.head(max_mal), ben_edges.head(limit - max_mal)])
        else:
            f_edges = f_edges.head(limit)

        connected_nodes = set(f_edges["src_id"]).union(set(f_edges["dst_id"]))
        f_nodes = nodes_df[nodes_df["node_id"].isin(connected_nodes)]

        if node_type and "node_type" in f_nodes.columns:
            f_nodes = f_nodes[f_nodes["node_type"] == node_type]
            valid_ids = set(f_nodes["node_id"])
            f_edges = f_edges[f_edges["src_id"].isin(valid_ids) | f_edges["dst_id"].isin(valid_ids)]

        return {
            "nodes": [sanitize_json(r) for r in f_nodes.to_dict(orient="records")],
            "edges": [sanitize_json(r) for r in f_edges.to_dict(orient="records")],
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
        
        # Get incident events (first 50)
        events_df = DataCache.get_events_df()
        incident_events = []
        if not events_df.empty:
            evts = events_df[(events_df["src_id"] == node_id) | (events_df["dst_id"] == node_id)].head(50)
            from api.services.events_service import _format_event_records
            incident_events = _format_event_records(evts.to_dict(orient="records"))

        node_info["incident_events"] = incident_events
        return node_info

    @staticmethod
    def get_stats() -> Dict[str, Any]:
        return sanitize_json(DataCache.get_graph_stats())
