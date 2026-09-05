from collections import Counter
from typing import Any, Dict, List
import pandas as pd
from api.dependencies import DataCache, sanitize_json

class AnalyticsService:
    @staticmethod
    def get_events_analytics() -> Dict[str, Any]:
        df = DataCache.get_events_df()
        if df.empty:
            return {"timeline": [], "tactics": {}, "source_tags": {}}

        # Group by 1-hour time buckets
        min_ts = df["ts"].min()
        max_ts = df["ts"].max()
        step = max(300.0, (max_ts - min_ts) / 20.0) if max_ts > min_ts else 300.0
        
        buckets = []
        cur = min_ts
        while cur < max_ts:
            nxt = cur + step
            sub = df[(df["ts"] >= cur) & (df["ts"] < nxt)]
            buckets.append({
                "bucket_start": cur,
                "bucket_end": nxt,
                "total": len(sub),
                "benign": len(sub[sub["label"] == 0]),
                "malicious": len(sub[sub["label"] == 1])
            })
            cur = nxt

        tactics_counter = Counter()
        for tlist in df["tactics"]:
            for t in tlist:
                tactics_counter[t] += 1

        source_tags = df["source_tag"].value_counts().to_dict()

        return sanitize_json({
            "timeline": buckets,
            "tactics": dict(tactics_counter),
            "source_tags": source_tags
        })

    @staticmethod
    def get_graph_analytics() -> Dict[str, Any]:
        nodes_df = DataCache.get_nodes_df()
        edges_df = DataCache.get_edges_df()

        node_types = nodes_df["node_type"].value_counts().to_dict() if not nodes_df.empty else {}
        relations = edges_df["relation"].value_counts().to_dict() if not edges_df.empty else {}
        
        # Degree distribution
        degree_dist = []
        if not nodes_df.empty:
            for deg_bin in [(0, 5), (6, 15), (16, 50), (51, 100), (101, 1000)]:
                count = len(nodes_df[(nodes_df["out_degree"] + nodes_df["in_degree"] >= deg_bin[0]) &
                                     (nodes_df["out_degree"] + nodes_df["in_degree"] <= deg_bin[1])])
                degree_dist.append({"range": f"{deg_bin[0]}-{deg_bin[1]}", "count": count})

        return sanitize_json({
            "node_types": node_types,
            "relations": relations,
            "degree_distribution": degree_dist
        })

    @staticmethod
    def get_attacks_analytics() -> Dict[str, Any]:
        df = DataCache.get_chains_df()
        if df.empty:
            return {"strategies": {}, "length_histogram": {}, "duration_histogram": {}}

        strategies = df["strategy"].value_counts().to_dict()
        lengths = df["num_events"].value_counts().to_dict()
        
        durations = []
        for _, row in df.iterrows():
            durations.append({
                "chain_id": row["chain_id"],
                "strategy": row["strategy"],
                "duration_s": row["duration_s"]
            })

        return sanitize_json({
            "strategies": strategies,
            "length_histogram": lengths,
            "durations": durations
        })

    @staticmethod
    def get_datasets_analytics() -> Dict[str, Any]:
        stats = DataCache.get_graph_stats()
        norm = stats.get("normalization", {})
        labeling = stats.get("labeling", {})

        return sanitize_json({
            "normalization": {
                "accepted": norm.get("accepted", 0),
                "rejected": norm.get("rejected", 0),
                "drop_rate": norm.get("drop_rate", 0.0),
                "reject_reasons": norm.get("reject_reasons", {})
            },
            "labeling": {
                "mode": labeling.get("mode", "heuristic"),
                "seed_indicator_hits": labeling.get("seed_indicator_hits", 0),
                "propagated_events": labeling.get("propagated_events", 0),
                "malicious_events": labeling.get("malicious_events", 0),
                "malicious_ratio": labeling.get("malicious_ratio", 0.0),
                "top_reasons": labeling.get("top_reasons", {})
            }
        })
