#!/usr/bin/env python3
"""Interactive severity-coloured attack graph for a processed TG-Detect graph.

Produces a single self-contained HTML file (vis-network via CDN) showing the
nodes + edges of the graph, where every node is coloured by an attack
*severity score* instead of only by entity type:

    CRITICAL (>= 0.75)  red      #E02424
    HIGH     (>= 0.50)  orange   #F97316
    MEDIUM   (>= 0.25)  amber    #F59E0B
    LOW      (> 0)      yellow   #FACC15
    BENIGN   (== 0)     teal     #14B8A6

Severity per node is computed from the graph itself:
    malicious_ratio  = malicious_events / (in_degree + out_degree)
    volume           = log1p(malicious_events) normalised across nodes
    centrality       = log1p(degree) normalised across nodes
    severity = 0.55*malicious_ratio + 0.30*volume + 0.15*centrality

Optionally blend in the TGNN's predicted attack probability:
    --predictions results/.../eval_test/predictions_test.parquet

Examples
--------
  python scripts/visualize_severity_graph.py \
      --data data/processed/mordor_mixed \
      --out reports/mordor_mixed/attack_graph.html

  python scripts/visualize_severity_graph.py \
      --data data/processed/mordor_mixed \
      --predictions results/mordor_mixed/checkpoints/mordor_mixed/eval_test/predictions_test.parquet \
      --top-nodes 500 --max-edges 3000 \
      --out reports/mordor_mixed/attack_graph.html
"""

from __future__ import annotations

import argparse
import html
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from graph_builder.loader import load_graph  # noqa: E402

SEVERITY_BANDS = [
    ("CRITICAL", 0.75, "#E02424"),
    ("HIGH", 0.50, "#F97316"),
    ("MEDIUM", 0.25, "#F59E0B"),
    ("LOW", 1e-9, "#FACC15"),
    ("BENIGN", -1.0, "#14B8A6"),
]

TYPE_SHAPES = {
    "USER": "dot",
    "HOST": "square",
    "PROCESS": "triangle",
    "FILE": "diamond",
    "IP": "star",
    "DOMAIN": "hexagon",
    "SOCKET": "triangleDown",
    "UNKNOWN": "dot",
}


def band(score: float):
    for name, threshold, color in SEVERITY_BANDS:
        if score >= threshold:
            return name, color
    return "BENIGN", "#14B8A6"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Severity-coloured interactive attack graph")
    p.add_argument("--data", type=Path, required=True, help="processed graph directory")
    p.add_argument("--out", type=Path, required=True, help="output .html path")
    p.add_argument("--top-nodes", type=int, default=400,
                   help="keep the N most severe/highest-degree nodes")
    p.add_argument("--max-edges", type=int, default=2500, help="cap aggregated edges drawn")
    p.add_argument("--min-severity", type=float, default=0.0,
                   help="drop nodes below this severity (0 keeps benign context)")
    p.add_argument("--predictions", type=Path, default=None,
                   help="optional predictions parquet with node_id + score columns")
    p.add_argument("--chain-id", type=str, default=None, help="restrict to one attack chain")
    p.add_argument("--malicious-only", action="store_true",
                   help="only draw edges whose label == 1")
    p.add_argument("--png", action="store_true",
                   help="also write a static PNG next to the HTML")
    return p.parse_args()


def compute_severity(nodes: pd.DataFrame, preds: pd.DataFrame | None) -> pd.DataFrame:
    df = nodes.copy()
    deg = (df["in_degree"].astype(float) + df["out_degree"].astype(float)).clip(lower=1.0)
    mal = df["malicious_events"].astype(float).clip(lower=0.0)

    ratio = (mal / deg).clip(0.0, 1.0)
    vol = np.log1p(mal)
    vol = vol / max(vol.max(), 1e-9)
    cen = np.log1p(deg)
    cen = cen / max(cen.max(), 1e-9)

    sev = 0.55 * ratio + 0.30 * vol + 0.15 * cen
    df["malicious_ratio"] = ratio
    df["degree"] = deg

    if preds is not None and not preds.empty:
        score_col = next((c for c in ("score", "prob", "probability", "y_score", "pred_score")
                          if c in preds.columns), None)
        id_col = next((c for c in ("node_id", "node", "id") if c in preds.columns), None)
        if score_col and id_col:
            agg = preds.groupby(id_col)[score_col].max()
            model = df["node_id"].map(agg).astype(float)
            df["model_score"] = model
            sev = np.where(model.notna(), 0.5 * sev + 0.5 * model.fillna(0.0), sev)
        else:
            print("  (predictions file has no usable node_id/score columns — ignored)")
    if "model_score" not in df.columns:
        df["model_score"] = np.nan

    df["severity"] = np.clip(sev, 0.0, 1.0)
    # A node that never touched a malicious event stays BENIGN regardless of centrality.
    df.loc[mal <= 0, "severity"] = 0.0
    return df


def aggregate_edges(edges: pd.DataFrame, keep: set[str], max_edges: int) -> pd.DataFrame:
    sub = edges[edges["src_id"].isin(keep) & edges["dst_id"].isin(keep)]
    if sub.empty:
        return sub
    agg = (
        sub.groupby(["src_id", "dst_id", "relation"])
        .agg(weight=("event_id", "size"),
             malicious=("label", "max"),
             mal_count=("label", "sum"))
        .reset_index()
        .sort_values(["malicious", "weight"], ascending=False)
    )
    return agg.head(max_edges)


HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>__TITLE__</title>
<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0B0F14; color:#E6EAF0;
         font-family: ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  header { padding:14px 20px; border-bottom:1px solid #1E2A38; display:flex;
           flex-wrap:wrap; gap:18px; align-items:center; }
  h1 { font-size:16px; margin:0; letter-spacing:.02em; }
  .stat { font-size:12px; color:#8FA3BA; }
  .stat b { color:#E6EAF0; font-weight:600; }
  #legend { display:flex; gap:14px; flex-wrap:wrap; margin-left:auto; font-size:12px; }
  .chip { display:flex; align-items:center; gap:6px; }
  .dot { width:12px; height:12px; border-radius:50%; display:inline-block; }
  #controls { padding:8px 20px; border-bottom:1px solid #1E2A38; font-size:12px;
              display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
  #net { width:100%; height:calc(100vh - 118px); }
  input[type=range] { accent-color:#E02424; }
</style>
</head>
<body>
<header>
  <h1>__TITLE__</h1>
  <span class="stat">nodes <b>__NNODES__</b></span>
  <span class="stat">edges <b>__NEDGES__</b></span>
  <span class="stat">critical <b>__NCRIT__</b></span>
  <div id="legend">__LEGEND__</div>
</header>
<div id="controls">
  <label>min severity <input id="sev" type="range" min="0" max="1" step="0.05" value="0"/></label>
  <span id="sevval">0.00</span>
  <label><input id="malonly" type="checkbox"/> malicious edges only</label>
  <span class="stat">shape = entity type &middot; colour = severity &middot; red edge = malicious</span>
</div>
<div id="net"></div>
<script>
const RAW_NODES = __NODES__;
const RAW_EDGES = __EDGES__;
const nodes = new vis.DataSet(RAW_NODES);
const edges = new vis.DataSet(RAW_EDGES);
const net = new vis.Network(document.getElementById('net'), {nodes, edges}, {
  physics: { solver:'forceAtlas2Based',
             forceAtlas2Based:{ gravitationalConstant:-45, springLength:110, damping:0.6 },
             stabilization:{ iterations:250 } },
  interaction: { hover:true, tooltipDelay:120, navigationButtons:true, keyboard:true },
  edges: { smooth:{ type:'continuous' }, arrows:{ to:{ enabled:true, scaleFactor:0.5 } } },
  nodes: { borderWidth:1, font:{ color:'#C8D3E0', size:11 } }
});
function applyFilter(){
  const s = parseFloat(document.getElementById('sev').value);
  const malOnly = document.getElementById('malonly').checked;
  document.getElementById('sevval').textContent = s.toFixed(2);
  const hidden = new Set();
  nodes.update(RAW_NODES.map(n => {
    const hide = n.severity < s;
    if (hide) hidden.add(n.id);
    return { id:n.id, hidden:hide };
  }));
  edges.update(RAW_EDGES.map(e => ({
    id:e.id,
    hidden: hidden.has(e.from) || hidden.has(e.to) || (malOnly && !e.malicious)
  })));
}
document.getElementById('sev').addEventListener('input', applyFilter);
document.getElementById('malonly').addEventListener('change', applyFilter);
</script>
</body>
</html>
"""


def write_html(path: Path, title: str, nodes_js, edges_js, n_crit: int) -> None:
    legend = "".join(
        f'<span class="chip"><span class="dot" style="background:{c}"></span>{n}</span>'
        for n, _, c in SEVERITY_BANDS
    )
    out = (HTML_TEMPLATE
           .replace("__TITLE__", html.escape(title))
           .replace("__LEGEND__", legend)
           .replace("__NNODES__", f"{len(nodes_js):,}")
           .replace("__NEDGES__", f"{len(edges_js):,}")
           .replace("__NCRIT__", f"{n_crit:,}")
           .replace("__NODES__", json.dumps(nodes_js))
           .replace("__EDGES__", json.dumps(edges_js)))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(out, encoding="utf-8")
    print(f"  -> {path}")


def write_png(path: Path, nodes_df: pd.DataFrame, agg: pd.DataFrame, title: str) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import networkx as nx

    g = nx.DiGraph()
    meta = nodes_df.set_index("node_id")
    for r in agg.itertuples(index=False):
        g.add_edge(r.src_id, r.dst_id, weight=int(r.weight), malicious=int(r.malicious))
    if g.number_of_nodes() == 0:
        print("  (png skipped: empty graph)")
        return
    sev = {n: float(meta["severity"].get(n, 0.0)) for n in g.nodes()}
    colors = [band(sev[n])[1] for n in g.nodes()]
    sizes = [60 + 400 * sev[n] for n in g.nodes()]
    ecolors = ["#E02424" if d.get("malicious") else "#39485C" for _, _, d in g.edges(data=True)]
    pos = nx.spring_layout(g, seed=42, k=1.2 / max(np.sqrt(g.number_of_nodes()), 1))

    fig, ax = plt.subplots(figsize=(18, 13), facecolor="#0B0F14")
    ax.set_facecolor("#0B0F14")
    nx.draw_networkx_edges(g, pos, ax=ax, edge_color=ecolors, alpha=0.5,
                           arrows=True, arrowsize=7, width=0.7)
    nx.draw_networkx_nodes(g, pos, ax=ax, node_size=sizes, node_color=colors,
                           linewidths=0.4, edgecolors="#0B0F14")
    handles = [plt.Line2D([0], [0], marker="o", color="w", label=n,
                          markerfacecolor=c, markersize=9)
               for n, _, c in SEVERITY_BANDS]
    ax.legend(handles=handles, loc="upper right", fontsize=9, title="Severity",
              facecolor="#141B24", labelcolor="#E6EAF0")
    ax.set_title(title, color="#E6EAF0", fontsize=15)
    ax.axis("off")
    fig.tight_layout()
    fig.savefig(path, dpi=160, facecolor="#0B0F14")
    plt.close(fig)
    print(f"  -> {path}")


def main() -> None:
    args = parse_args()
    print(f"[1/4] loading {args.data}")
    ds = load_graph(args.data)

    edges = ds.edges
    if args.chain_id:
        edges = edges[edges["chain_id"] == args.chain_id]
        if edges.empty:
            print(f"ERROR: chain {args.chain_id} not found")
            return
    if args.malicious_only:
        edges = edges[edges["label"] == 1]

    preds = None
    if args.predictions and args.predictions.exists():
        preds = pd.read_parquet(args.predictions)
        print(f"[2/4] blending model scores from {args.predictions} ({len(preds):,} rows)")
    else:
        print("[2/4] severity from graph statistics only")

    nodes = compute_severity(ds.nodes, preds)
    if args.min_severity > 0:
        nodes = nodes[nodes["severity"] >= args.min_severity]

    print("[3/4] selecting subgraph")
    ranked = nodes.sort_values(["severity", "degree"], ascending=False).head(args.top_nodes)
    keep = set(ranked["node_id"])
    agg = aggregate_edges(edges, keep, args.max_edges)
    if agg.empty:
        print("ERROR: no edges left after filtering — relax --min-severity/--top-nodes")
        return
    used = set(agg["src_id"]) | set(agg["dst_id"])
    ranked = ranked[ranked["node_id"].isin(used)]

    meta = ranked.set_index("node_id")
    nodes_js = []
    n_crit = 0
    for nid, row in meta.iterrows():
        sev = float(row["severity"])
        name, color = band(sev)
        if name == "CRITICAL":
            n_crit += 1
        short = nid if len(nid) <= 26 else nid[:25] + "…"
        model = "" if pd.isna(row["model_score"]) else f"\nmodel score: {row['model_score']:.3f}"
        nodes_js.append({
            "id": nid,
            "label": short,
            "severity": round(sev, 4),
            "shape": TYPE_SHAPES.get(row["node_type"], "dot"),
            "color": {"background": color, "border": "#0B0F14",
                      "highlight": {"background": color, "border": "#FFFFFF"}},
            "value": float(max(row["degree"], 1)),
            "title": (f"{row['node_type']}: {nid}\nseverity: {sev:.3f} ({name})\n"
                      f"malicious events: {int(row['malicious_events'])}\n"
                      f"degree: {int(row['degree'])}"
                      f" (in {int(row['in_degree'])} / out {int(row['out_degree'])})"
                      f"{model}"),
        })

    edges_js = []
    for i, r in enumerate(agg.itertuples(index=False)):
        mal = bool(r.malicious)
        edges_js.append({
            "id": f"e{i}",
            "from": r.src_id,
            "to": r.dst_id,
            "malicious": mal,
            "value": int(r.weight),
            "color": {"color": "#E02424" if mal else "#39485C",
                      "highlight": "#FF6B6B", "opacity": 0.85 if mal else 0.5},
            "title": (f"{r.relation}\nevents: {int(r.weight)}"
                      f"\nmalicious events: {int(r.mal_count)}"),
        })

    print("[4/4] writing output")
    title = f"TG-Detect attack graph — {args.data.name}"
    write_html(args.out, title, nodes_js, edges_js, n_crit)
    if args.png:
        write_png(args.out.with_suffix(".png"), ranked, agg, title)

    counts = ranked["severity"].apply(lambda s: band(float(s))[0]).value_counts()
    print("\nSeverity distribution of drawn nodes:")
    for name, _, _ in SEVERITY_BANDS:
        if name in counts:
            print(f"  {name:<9} {int(counts[name]):,}")


if __name__ == "__main__":
    main()
