from collections import Counter
from typing import Any, Dict, List
import numpy as np
import pandas as pd
from api.dependencies import DataCache, sanitize_json

class AnalyticsService:
    @staticmethod
    def get_events_analytics() -> Dict[str, Any]:
        df = DataCache.get_events_df()
        if df.empty or "ts" not in df.columns:
            return {"timeline": [], "tactics": {}, "source_tags": {}}

        ts_arr = df["ts"].to_numpy(dtype=float)
        label_arr = df["label"].to_numpy(dtype=int) if "label" in df.columns else np.zeros(len(ts_arr), dtype=int)
        min_ts = float(np.min(ts_arr))
        max_ts = float(np.max(ts_arr))
        num_buckets = 20
        step = max(300.0, (max_ts - min_ts) / float(num_buckets)) if max_ts > min_ts else 300.0

        # Vectorized bucket computation
        bin_edges = np.linspace(min_ts, max(min_ts + step * num_buckets, max_ts), num_buckets + 1)
        bin_indices = np.digitize(ts_arr, bin_edges[:-1]) - 1

        buckets = []
        for i in range(num_buckets):
            mask = (bin_indices == i)
            total = int(np.count_nonzero(mask))
            mal = int(np.count_nonzero(label_arr[mask] == 1))
            buckets.append({
                "bucket_start": float(bin_edges[i]),
                "bucket_end": float(bin_edges[i+1]),
                "total": total,
                "benign": total - mal,
                "malicious": mal
            })

        tactics_counter = Counter()
        if "tactics" in df.columns:
            for tlist in df["tactics"]:
                if isinstance(tlist, str):
                    if tlist:
                        tactics_counter[tlist] += 1
                elif isinstance(tlist, (list, tuple, set, np.ndarray)):
                    for t in tlist:
                        if t:
                            tactics_counter[str(t)] += 1

        source_tags = df["source_tag"].value_counts().to_dict() if "source_tag" in df.columns else {}

        return sanitize_json({
            "timeline": buckets,
            "tactics": dict(tactics_counter),
            "source_tags": source_tags
        })

    @staticmethod
    def get_graph_analytics() -> Dict[str, Any]:
        nodes_df = DataCache.get_nodes_df()
        edges_df = DataCache.get_edges_df()

        node_types = nodes_df["node_type"].value_counts().to_dict() if not nodes_df.empty and "node_type" in nodes_df.columns else {}
        relations = edges_df["relation"].value_counts().to_dict() if not edges_df.empty and "relation" in edges_df.columns else {}
        
        # Vectorized degree distribution
        degree_dist = []
        if not nodes_df.empty and "out_degree" in nodes_df.columns and "in_degree" in nodes_df.columns:
            total_deg = (nodes_df["out_degree"] + nodes_df["in_degree"]).to_numpy()
            for deg_bin in [(0, 5), (6, 15), (16, 50), (51, 100), (101, 1000)]:
                count = int(np.count_nonzero((total_deg >= deg_bin[0]) & (total_deg <= deg_bin[1])))
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
            return {"strategies": {}, "length_histogram": {}, "duration_histogram": {}, "durations": []}

        strategies = df["strategy"].value_counts().to_dict() if "strategy" in df.columns else {}
        lengths = df["num_events"].value_counts().to_dict() if "num_events" in df.columns else {}
        
        durations = []
        for row in df.to_dict(orient="records"):
            durations.append({
                "chain_id": row.get("chain_id"),
                "strategy": row.get("strategy"),
                "duration_s": row.get("duration_s")
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
