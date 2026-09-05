#!/usr/bin/env python3
"""Render pictures of a processed TG-Detect temporal graph.

Examples
--------
  # whole-graph overview (top 300 busiest nodes) + charts
  python scripts/visualize_graph.py \
      --data data/processed/mordor_full \
      --out reports/mordor_full

  # one attack chain only
  python scripts/visualize_graph.py \
      --data data/processed/mordor_full \
      --out reports/mordor_full \
      --chain-id <chain_id>

Outputs (PNG + optional interactive HTML):
  graph_overview.png     aggregated node/relation graph
  chain_<id>.png         per-attack-chain subgraph
  timeline.png           events over time (malicious vs benign)
  distributions.png      node-type / relation / label bar charts
  graph_interactive.html pyvis view (only if `pyvis` is installed)
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import networkx as nx  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from graph_builder.loader import load_graph  # noqa: E402

TYPE_COLORS = {
    "USER": "#4C9AFF",
    "HOST": "#36B37E",
    "PROCESS": "#FF8B00",
    "FILE": "#8777D9",
    "IP": "#FF5630",
    "DOMAIN": "#00B8D9",
    "SOCKET": "#6554C0",
    "UNKNOWN": "#97A0AF",
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Visualize a TG-Detect graph")
    p.add_argument("--data", type=Path, required=True, help="processed graph directory")
    p.add_argument("--out", type=Path, required=True, help="output directory for images")
    p.add_argument("--top-nodes", type=int, default=300,
                   help="keep the N highest-degree nodes in the overview")
    p.add_argument("--max-edges", type=int, default=2000,
                   help="cap aggregated edges drawn in the overview")
    p.add_argument("--chain-id", type=str, default=None, help="draw one specific chain")
    p.add_argument("--top-chains", type=int, default=3,
                   help="also draw the N largest attack chains")
    p.add_argument("--interactive", action="store_true",
                   help="also write an interactive HTML (needs `pip install pyvis`)")
    p.add_argument("--layout", default="spring", choices=["spring", "kamada", "circular"])
    return p.parse_args()


def _build_nx(edges: pd.DataFrame, nodes: pd.DataFrame) -> nx.MultiDiGraph:
    types = dict(zip(nodes["node_id"], nodes["node_type"]))
    g = nx.DiGraph()
    agg = (
        edges.groupby(["src_id", "dst_id", "relation"])
        .agg(weight=("event_id", "size"), malicious=("label", "max"))
        .reset_index()
    )
    for r in agg.itertuples(index=False):
        g.add_node(r.src_id, node_type=types.get(r.src_id, "UNKNOWN"))
        g.add_node(r.dst_id, node_type=types.get(r.dst_id, "UNKNOWN"))
        if g.has_edge(r.src_id, r.dst_id):
            g[r.src_id][r.dst_id]["weight"] += int(r.weight)
        else:
            g.add_edge(r.src_id, r.dst_id, weight=int(r.weight),
                       relation=r.relation, malicious=int(r.malicious))
    return g


def _positions(g: nx.Graph, layout: str):
    if layout == "kamada" and g.number_of_nodes() <= 500:
        return nx.kamada_kawai_layout(g)
    if layout == "circular":
        return nx.circular_layout(g)
    return nx.spring_layout(g, seed=42, k=1.2 / max(np.sqrt(max(g.number_of_nodes(), 1)), 1))


def draw_graph(g: nx.DiGraph, path: Path, title: str, layout: str = "spring") -> None:
    if g.number_of_nodes() == 0:
        print(f"  (skipped {path.name}: empty graph)")
        return
    pos = _positions(g, layout)
    deg = dict(g.degree())
    sizes = [80 + 25 * np.log1p(deg.get(n, 1)) * 6 for n in g.nodes()]
    colors = [TYPE_COLORS.get(g.nodes[n].get("node_type", "UNKNOWN"), "#97A0AF") for n in g.nodes()]
    weights = np.array([d.get("weight", 1) for _, _, d in g.edges(data=True)], dtype=float)
    widths = 0.4 + 2.5 * (np.log1p(weights) / max(np.log1p(weights).max(), 1e-9))
    ecolors = ["#D64545" if d.get("malicious") else "#B3BAC5"
               for _, _, d in g.edges(data=True)]

    fig, ax = plt.subplots(figsize=(18, 13))
    nx.draw_networkx_edges(g, pos, ax=ax, width=widths, edge_color=ecolors,
                           alpha=0.55, arrows=True, arrowsize=7,
                           connectionstyle="arc3,rad=0.06")
    nx.draw_networkx_nodes(g, pos, ax=ax, node_size=sizes, node_color=colors,
                           linewidths=0.4, edgecolors="#2b2b2b")
    if g.number_of_nodes() <= 120:
        labels = {n: (n[:28] + "…" if len(n) > 28 else n) for n in g.nodes()}
        nx.draw_networkx_labels(g, pos, labels, font_size=7, ax=ax)

    handles = [plt.Line2D([0], [0], marker="o", color="w", label=t,
                          markerfacecolor=c, markersize=9)
               for t, c in TYPE_COLORS.items()
               if any(g.nodes[n].get("node_type") == t for n in g.nodes())]
    ax.legend(handles=handles, loc="upper right", fontsize=9, title="Node type")
    ax.set_title(title, fontsize=15)
    ax.axis("off")
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)
    print(f"  -> {path}")


def draw_timeline(events: pd.DataFrame, path: Path) -> None:
    if events.empty:
        return
    ts = events["ts"].to_numpy()
    t0 = ts.min()
    rel_h = (ts - t0) / 3600.0
    label = events["label"].to_numpy() if "label" in events else np.zeros_like(ts)
    fig, ax = plt.subplots(figsize=(16, 5))
    bins = min(400, max(20, int(len(ts) ** 0.5)))
    ax.hist(rel_h[label == 0], bins=bins, color="#36B37E", alpha=0.8, label="benign")
    ax.hist(rel_h[label == 1], bins=bins, color="#D64545", alpha=0.8, label="malicious")
    ax.set_xlabel("hours since first event")
    ax.set_ylabel("events")
    ax.set_title("Event timeline")
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"  -> {path}")


def draw_distributions(ds, path: Path) -> None:
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    ds.nodes["node_type"].value_counts().plot.bar(ax=axes[0], color="#4C9AFF")
    axes[0].set_title("Node types")
    ds.edges["relation"].value_counts().plot.bar(ax=axes[1], color="#FF8B00")
    axes[1].set_title("Relations")
    axes[1].set_yscale("log")
    ds.events["label"].value_counts().sort_index().plot.bar(
        ax=axes[2], color=["#36B37E", "#D64545"])
    axes[2].set_title("Labels (0=benign, 1=malicious)")
    for a in axes:
        a.tick_params(axis="x", rotation=45, labelsize=8)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"  -> {path}")


def write_interactive(g: nx.DiGraph, path: Path) -> None:
    try:
        from pyvis.network import Network
    except ImportError:
        print("  (interactive skipped: pip install pyvis)")
        return
    net = Network(height="900px", width="100%", directed=True, bgcolor="#111318",
                  font_color="#EAECEF")
    for n, d in g.nodes(data=True):
        t = d.get("node_type", "UNKNOWN")
        net.add_node(n, label=n[:24], title=f"{t}\n{n}",
                     color=TYPE_COLORS.get(t, "#97A0AF"),
                     value=max(g.degree(n), 1))
    for u, v, d in g.edges(data=True):
        net.add_edge(u, v, value=d.get("weight", 1), title=d.get("relation", ""),
                     color="#D64545" if d.get("malicious") else "#6B778C")
    net.force_atlas_2based()
    net.write_html(str(path), notebook=False)
    print(f"  -> {path}")


def main() -> None:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    print(f"[1/4] loading {args.data}")
    ds = load_graph(args.data)
    ds.print_summary()

    print("\n[2/4] charts")
    draw_timeline(ds.events, args.out / "timeline.png")
    draw_distributions(ds, args.out / "distributions.png")

    print("\n[3/4] overview graph")
    deg = ds.nodes.assign(deg=ds.nodes["in_degree"] + ds.nodes["out_degree"])
    keep = set(deg.nlargest(args.top_nodes, "deg")["node_id"])
    sub = ds.edges[ds.edges["src_id"].isin(keep) & ds.edges["dst_id"].isin(keep)]
    if len(sub) > args.max_edges * 50:
        sub = sub.sample(args.max_edges * 50, random_state=0)
    g = _build_nx(sub, ds.nodes)
    if g.number_of_edges() > args.max_edges:
        top = sorted(g.edges(data=True), key=lambda e: -e[2]["weight"])[: args.max_edges]
        g = nx.DiGraph(((u, v, d) for u, v, d in top))
        for n in g.nodes():
            g.nodes[n]["node_type"] = ds.nodes.set_index("node_id")["node_type"].get(n, "UNKNOWN")
    draw_graph(g, args.out / "graph_overview.png",
               f"TG-Detect graph overview — top {args.top_nodes} nodes "
               f"({g.number_of_nodes()} nodes / {g.number_of_edges()} aggregated edges)",
               args.layout)
    if args.interactive:
        write_interactive(g, args.out / "graph_interactive.html")

    print("\n[4/4] attack chains")
    if "chain_id" not in ds.edges.columns or ds.edges["chain_id"].isna().all():
        print("  (no chain_id present)")
        return
    chains = ds.edges.dropna(subset=["chain_id"])
    targets = ([args.chain_id] if args.chain_id
               else chains["chain_id"].value_counts().head(args.top_chains).index.tolist())
    for cid in targets:
        ce = chains[chains["chain_id"] == cid]
        if ce.empty:
            print(f"  (chain {cid} not found)")
            continue
        cg = _build_nx(ce, ds.nodes)
        safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in str(cid))[:60]
        draw_graph(cg, args.out / f"chain_{safe}.png",
                   f"Attack chain {cid} — {len(ce)} events, {cg.number_of_nodes()} nodes",
                   "kamada")


if __name__ == "__main__":
    main()
