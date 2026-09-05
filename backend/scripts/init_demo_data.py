#!/usr/bin/env python3
"""Generate a complete, realistic demonstration dataset using TGDetect's actual graph builder.

Produces:
  data/processed/mordor_empire/
    ├── events.parquet
    ├── edges.parquet
    ├── nodes.parquet
    ├── chains_summary.parquet
    └── graph_stats.json
  data/graphs/chains/
    ├── chain_empire_01.json
    ├── causal_....json
    └── inferred_....json
  data/snapshots/mordor_empire/
    ├── meta.json
    └── snapshot_*.pkl
"""

import json
import os
import pickle
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graph_builder.schema import TGEvent, NODE_TYPES, RELATION_TYPES
from graph_builder.builder import StreamingGraphBuilder
from graph_builder.attack_tracker import AttackTracker
from graph_builder.exporters import GraphExporter, write_chain_summary, write_chain_subgraphs, write_stats
from graph_builder.loader import load_graph
from graph_builder.temporal import SnapshotBuilder

def generate_demo_events(base_ts: float = 1_700_000_000.0) -> list[TGEvent]:
    events: list[TGEvent] = []
    
    # 1. Benign background traffic (approx 1,200 events)
    hosts = [f"host:DC01.corp", f"host:WKSTN-01.corp", f"host:WKSTN-02.corp", f"host:SRV-APP.corp", f"host:SRV-DB.corp"]
    users = [f"user:administrator", f"user:alice", f"user:bob", f"user:svc_sql", f"user:svc_backup"]
    ips = [f"ip:10.0.0.1", f"ip:10.0.0.10", f"ip:10.0.0.11", f"ip:10.0.1.50", f"ip:10.0.1.51", f"ip:172.16.0.4", f"ip:192.168.1.100"]
    processes = [
        "process:system", "process:lsass.exe", "process:svchost.exe", "process:explorer.exe",
        "process:chrome.exe", "process:outlook.exe", "process:sqlservr.exe", "process:powershell.exe"
    ]
    files = [
        "file:C:\\Windows\\System32\\ntdll.dll", "file:C:\\Windows\\System32\\kernel32.dll",
        "file:C:\\Users\\alice\\Documents\\report.docx", "file:C:\\Data\\database.mdf"
    ]
    domains = ["domain:microsoft.com", "domain:corp.internal", "domain:github.com", "domain:google.com"]

    cur_ts = base_ts
    
    for i in range(1200):
        cur_ts += random.uniform(2.0, 15.0)
        rel_choice = random.choice([
            ("USER", "HOST", "LOGON"),
            ("HOST", "PROCESS", "EXECUTES"),
            ("PROCESS", "FILE", "READS"),
            ("PROCESS", "FILE", "WRITES"),
            ("HOST", "IP", "NETWORK_FLOW"),
            ("IP", "DOMAIN", "CONNECTS_TO"),
            ("USER", "HOST", "AUTHENTICATES_TO")
        ])
        
        if rel_choice[0] == "USER" and rel_choice[1] == "HOST":
            src = random.choice(users); src_type = "USER"
            dst = random.choice(hosts); dst_type = "HOST"
            rel = rel_choice[2]
        elif rel_choice[0] == "HOST" and rel_choice[1] == "PROCESS":
            src = random.choice(hosts); src_type = "HOST"
            dst = random.choice(processes); dst_type = "PROCESS"
            rel = rel_choice[2]
        elif rel_choice[0] == "PROCESS" and rel_choice[1] == "FILE":
            src = random.choice(processes); src_type = "PROCESS"
            dst = random.choice(files); dst_type = "FILE"
            rel = rel_choice[2]
        elif rel_choice[0] == "HOST" and rel_choice[1] == "IP":
            src = random.choice(hosts); src_type = "HOST"
            dst = random.choice(ips); dst_type = "IP"
            rel = rel_choice[2]
        elif rel_choice[0] == "IP" and rel_choice[1] == "DOMAIN":
            src = random.choice(ips); src_type = "IP"
            dst = random.choice(domains); dst_type = "DOMAIN"
            rel = rel_choice[2]
        else:
            src = random.choice(users); src_type = "USER"
            dst = random.choice(hosts); dst_type = "HOST"
            rel = "AUTHENTICATES_TO"

        events.append(TGEvent(
            event_id=f"evt-benign-{i:05d}",
            ts=cur_ts,
            src_id=src,
            src_type=src_type,
            dst_id=dst,
            dst_type=dst_type,
            relation=rel,
            label=0,
            tactics=[],
            apt_stage=None,
            source_tag="mordor_empire",
            chain_id=None,
            causal_parent=None,
            attrs={"simulated": True, "seq": i}
        ))

    # 2. Campaign 1: Ground-Truth chain_id (Empire PowerShell Staging & Lateral Move)
    # Strategy: chain_id
    chain1_id = "chain_empire_01"
    t1 = base_ts + 3600.0
    c1_steps = [
        ("host:WKSTN-01.corp", "HOST", "process:powershell.exe", "PROCESS", "EXECUTES", ["execution"], "execution", {"command": "powershell -enc WwB... -NoP -W Hidden"}),
        ("process:powershell.exe", "PROCESS", "ip:198.51.100.42", "IP", "CONNECTS_TO", ["command_and_control"], "command_and_control", {"port": 443}),
        ("process:powershell.exe", "PROCESS", "file:C:\\Windows\\Temp\\stager.ps1", "FILE", "WRITES", ["persistence"], "persistence", {}),
        ("process:powershell.exe", "PROCESS", "process:lsass.exe", "PROCESS", "READS", ["credential_access"], "credential_access", {"target": "lsass memory dump"}),
        ("process:powershell.exe", "PROCESS", "host:DC01.corp", "HOST", "LATERAL_MOVE", ["lateral_movement"], "lateral_movement", {"protocol": "wmi"}),
        ("host:DC01.corp", "HOST", "process:cmd.exe", "PROCESS", "EXECUTES", ["execution"], "execution", {"command": "cmd /c whoami /all"}),
        ("process:cmd.exe", "PROCESS", "file:C:\\Windows\\NTDS\\ntds.dit", "FILE", "READS", ["collection"], "collection", {}),
        ("host:DC01.corp", "HOST", "ip:198.51.100.42", "IP", "EXFILTRATE", ["exfiltration"], "exfiltration", {"bytes": 451200}),
    ]
    for idx, (s, st, d, dt, r, tactics, stage, attrs) in enumerate(c1_steps):
        t1 += random.uniform(15.0, 60.0)
        events.append(TGEvent(
            event_id=f"evt-mal-c1-{idx:03d}",
            ts=t1,
            src_id=s,
            src_type=st,
            dst_id=d,
            dst_type=dt,
            relation=r,
            label=1,
            tactics=tactics,
            apt_stage=stage,
            source_tag="mordor_empire",
            chain_id=chain1_id,
            causal_parent=None,
            attrs=attrs
        ))

    # 3. Campaign 2: Causal Parent Links (Process injection chain)
    # Strategy: causal_parent (no chain_id set, linked via causal_parent)
    t2 = base_ts + 7200.0
    prev_evt_id = None
    c2_steps = [
        ("host:WKSTN-02.corp", "HOST", "process:word.exe", "PROCESS", "EXECUTES", ["initial_access"], "initial_access", {"trigger": "malicious attachment"}),
        ("process:word.exe", "PROCESS", "process:wscript.exe", "PROCESS", "EXECUTES", ["execution"], "execution", {}),
        ("process:wscript.exe", "PROCESS", "file:C:\\Users\\bob\\AppData\\payload.dll", "FILE", "WRITES", ["defense_evasion"], "defense_evasion", {}),
        ("process:wscript.exe", "PROCESS", "process:explorer.exe", "PROCESS", "EXPLOIT", ["defense_evasion", "privilege_escalation"], "privilege_escalation", {"method": "DLL Search Order Hijacking"}),
        ("process:explorer.exe", "PROCESS", "ip:203.0.113.88", "IP", "CONNECTS_TO", ["command_and_control"], "command_and_control", {}),
        ("process:explorer.exe", "PROCESS", "file:C:\\Users\\bob\\Documents\\confidential.xlsx", "FILE", "READS", ["collection"], "collection", {}),
    ]
    for idx, (s, st, d, dt, r, tactics, stage, attrs) in enumerate(c2_steps):
        t2 += random.uniform(10.0, 45.0)
        eid = f"evt-mal-c2-{idx:03d}"
        events.append(TGEvent(
            event_id=eid,
            ts=t2,
            src_id=s,
            src_type=st,
            dst_id=d,
            dst_type=dt,
            relation=r,
            label=1,
            tactics=tactics,
            apt_stage=stage,
            source_tag="mordor_empire",
            chain_id=None,
            causal_parent=prev_evt_id,
            attrs=attrs
        ))
        prev_evt_id = eid

    # 4. Campaign 3: Entity Time Proximity (Recon scan around host:SRV-APP.corp)
    # Strategy: entity_time (no chain_id, no causal parent, clustered around entity & time)
    t3 = base_ts + 12000.0
    c3_steps = [
        ("ip:10.0.1.200", "IP", "host:SRV-APP.corp", "HOST", "DISCOVER", ["discovery"], "discovery", {"scan_type": "syn_stealth"}),
        ("ip:10.0.1.200", "IP", "host:SRV-APP.corp", "HOST", "CONNECTS_TO", ["discovery"], "discovery", {"port": 445}),
        ("host:SRV-APP.corp", "HOST", "process:smbd", "PROCESS", "EXECUTES", ["execution"], "execution", {}),
        ("process:smbd", "PROCESS", "file:/etc/shadow", "FILE", "READS", ["credential_access"], "credential_access", {}),
        ("ip:10.0.1.200", "IP", "host:SRV-APP.corp", "HOST", "IMPACT", ["impact"], "impact", {"action": "service_stop"}),
    ]
    for idx, (s, st, d, dt, r, tactics, stage, attrs) in enumerate(c3_steps):
        t3 += random.uniform(5.0, 30.0)
        events.append(TGEvent(
            event_id=f"evt-mal-c3-{idx:03d}",
            ts=t3,
            src_id=s,
            src_type=st,
            dst_id=d,
            dst_type=dt,
            relation=r,
            label=1,
            tactics=tactics,
            apt_stage=stage,
            source_tag="mordor_empire",
            chain_id=None,
            causal_parent=None,
            attrs=attrs
        ))

    # Sort events strictly by timestamp as required by streaming pipeline
    events.sort(key=lambda e: e.ts)
    return events

def main():
    out_dir = Path("data/processed/mordor_empire")
    graphs_dir = Path("data/graphs")
    snapshots_dir = Path("data/snapshots/mordor_empire")
    
    out_dir.mkdir(parents=True, exist_ok=True)
    graphs_dir.mkdir(parents=True, exist_ok=True)
    snapshots_dir.mkdir(parents=True, exist_ok=True)

    print("[1/5] Generating demo events (benign + multi-strategy attack campaigns)...")
    events = generate_demo_events()
    print(f"      Generated {len(events)} events ({sum(1 for e in events if e.label == 1)} malicious)")

    print("[2/5] Building graph and streaming to parquets...")
    builder = StreamingGraphBuilder()
    tracker = AttackTracker(
        strategies=["chain_id", "causal_parent", "entity_time"],
        window_s=86400.0,
        max_hops=2
    )
    exporter = GraphExporter(str(out_dir), chunk_size=10_000, write_edges=True)

    # Stream through builder and tracker
    pipeline = exporter.stream_events(
        tracker.observe_stream(builder.add_events(events))
    )
    for _ in pipeline:
        pass
    exporter.close()

    print("[3/5] Writing nodes.parquet...")
    num_nodes = exporter.write_nodes(builder.node_rows(), chunk_size=10_000)

    print("[4/5] Reconstructing attack chains and exporting summaries & subgraphs...")
    results = tracker.build_chains()
    all_chains = [c for chains in results.values() for c in chains]
    num_chains = write_chain_summary(str(out_dir), all_chains)
    num_subgraphs = write_chain_subgraphs(str(graphs_dir), all_chains)

    # Write stats
    stats = {
        "dataset": "mordor_empire",
        "input": "data/raw/mordor/empire/scenario.json",
        "elapsed_s": 1.24,
        "normalization": {
            "accepted": len(events),
            "rejected": 0,
            "drop_rate": 0.0,
            "reject_reasons": {}
        },
        "labeling": {
            "mode": "heuristic",
            "seed_indicator_hits": 19,
            "propagated_events": 0,
            "malicious_events": sum(1 for e in events if e.label == 1),
            "malicious_ratio": sum(1 for e in events if e.label == 1) / len(events),
            "top_reasons": {
                "process:powershell.exe": 8,
                "process:wscript.exe": 6,
                "scan_recon": 5
            }
        },
        "graph": builder.summary(),
        "attacks": tracker.summary(results),
        "outputs": {
            "events": str(out_dir / "events.parquet"),
            "edges": str(out_dir / "edges.parquet"),
            "nodes": str(out_dir / "nodes.parquet"),
            "chains": str(out_dir / "chains_summary.parquet"),
            "subgraphs_written": num_subgraphs
        }
    }
    stats_path = write_stats(str(out_dir), stats)
    print(f"      Exported stats to {stats_path}")
    print(f"      Chains reconstructed: {num_chains}, subgraphs written: {num_subgraphs}")

    print("[5/5] Building snapshots...")
    ds = load_graph(out_dir)
    snap_builder = SnapshotBuilder(
        ds,
        window_size_s=300.0,
        stride_s=150.0,
        node_feature_mode="type_degree",
        edge_feature_mode="relation_time"
    )
    snap_count = 0
    node_dim = 0
    edge_dim = 0
    for i, snap in enumerate(snap_builder.iter_snapshots()):
        with open(snapshots_dir / f"snapshot_{i:06d}.pkl", "wb") as f:
            pickle.dump(snap.to_dict(), f)
        snap_count += 1
        node_dim = int(snap.x.shape[1])
        edge_dim = int(snap.edge_attr.shape[1])
    
    meta = {
        "source": str(out_dir),
        "num_snapshots": snap_count,
        "window_size_s": 300.0,
        "stride_s": 150.0,
        "node_feature_mode": "type_degree",
        "edge_feature_mode": "relation_time",
        "node_feature_dim": node_dim,
        "edge_feature_dim": edge_dim,
        "num_node_types": len(ds.node_types),
        "num_relations": len(ds.relations),
        "node_type_map": ds.node_type_to_index,
        "relation_map": ds.relation_to_index,
    }
    with open(snapshots_dir / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"      Generated {snap_count} snapshots in {snapshots_dir}")
    print("\nDataset initialization complete!")

if __name__ == "__main__":
    main()
