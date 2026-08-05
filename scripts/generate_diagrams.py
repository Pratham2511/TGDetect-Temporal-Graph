#!/usr/bin/env python3
"""
Generate TGDetect project explanation diagrams using Playwright+CSS.
Creates 5 diagrams:
1. High-Level DFD (Data Flow Diagram)
2. Detailed 11-Step Workflow
3. How Graphs Are Built (Log-to-Graph)
4. Temporal Graph Neural Network Architecture
5. Technology Stack Layered Diagram
"""

import asyncio
from playwright.async_api import async_playwright
import os

OUTPUT_DIR = "/home/z/my-project/download/diagrams"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# DIAGRAM 1: High-Level DFD
# ============================================================
DFD_HTML = """
<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    width: 1200px;
    height: 700px;
    background: #F8FAFC;
    font-family: 'Segoe UI', sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 30px 40px 20px 40px;
}
.title {
    font-size: 22px;
    font-weight: 700;
    color: #1E293B;
    margin-bottom: 8px;
    text-align: center;
}
.subtitle {
    font-size: 13px;
    color: #64748B;
    margin-bottom: 24px;
    text-align: center;
}

.dfd-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    flex-wrap: nowrap;
    position: relative;
}

/* External Entity: rounded rectangle with double border */
.entity {
    width: 160px;
    min-height: 100px;
    border: 2.5px solid #3B82F6;
    border-radius: 12px;
    background: #EFF6FF;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 14px 10px;
    text-align: center;
}
.entity .icon { font-size: 26px; margin-bottom: 6px; }
.entity .name { font-size: 13px; font-weight: 700; color: #1E40AF; }
.entity .desc { font-size: 10px; color: #3B82F6; margin-top: 3px; }

/* Process: circle */
.process {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    border: 2.5px solid #10B981;
    background: #F0FDF4;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    text-align: center;
}
.process .num {
    font-size: 10px;
    font-weight: 700;
    color: #059669;
    background: #D1FAE5;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 3px;
}
.process .name { font-size: 11.5px; font-weight: 600; color: #065F46; }

/* Data Store: open rectangle */
.datastore {
    width: 140px;
    min-height: 80px;
    border: none;
    border-top: 2.5px solid #F59E0B;
    border-bottom: 2.5px solid #F59E0B;
    background: #FFFBEB;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px;
    text-align: center;
}
.datastore .name { font-size: 12px; font-weight: 600; color: #92400E; }
.datastore .desc { font-size: 9.5px; color: #B45309; margin-top: 2px; }

/* Arrow labels */
.flow-row {
    display: flex;
    align-items: center;
    gap: 12px;
}
.arrow-label {
    font-size: 9px;
    color: #64748B;
    background: #F1F5F9;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
}
.arrow-down {
    font-size: 9px;
    color: #64748B;
    position: absolute;
}

/* Layout rows */
.row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    margin-bottom: 10px;
}
.col-sep {
    width: 2px;
    height: 40px;
    background: #CBD5E1;
    margin: 0 8px;
}
.v-arrow {
    width: 2px;
    height: 28px;
    background: #94A3B8;
    position: relative;
}
.v-arrow::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: -4px;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 7px solid #94A3B8;
}

.legend {
    display: flex;
    gap: 20px;
    margin-top: 18px;
    padding: 10px 20px;
    background: #F1F5F9;
    border-radius: 8px;
}
.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #475569;
}
.legend-circle {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid #10B981;
    background: #F0FDF4;
}
.legend-rect {
    width: 20px;
    height: 14px;
    border: 2px solid #3B82F6;
    border-radius: 3px;
    background: #EFF6FF;
}
.legend-open {
    width: 20px;
    height: 14px;
    border-top: 2px solid #F59E0B;
    border-bottom: 2px solid #F59E0B;
    background: #FFFBEB;
}
</style>
</head>
<body>
<div class="title">Data Flow Diagram (DFD) - TGDetect System</div>
<div class="subtitle">Shows how data flows from external sources through processes to storage and output</div>

<div style="display: flex; flex-direction: column; align-items: center; gap: 0;">
    <!-- Row 1: External Entities -->
    <div class="row">
        <div class="entity">
            <div class="icon">&#128187;</div>
            <div class="name">Endpoint / Server</div>
            <div class="desc">Windows, Linux logs</div>
        </div>
        <div class="entity">
            <div class="icon">&#127760;</div>
            <div class="name">Network Devices</div>
            <div class="desc">Firewall, DNS, router</div>
        </div>
        <div class="entity">
            <div class="icon">&#9729;&#65039;</div>
            <div class="name">Cloud Services</div>
            <div class="desc">AWS, Azure, GCP logs</div>
        </div>
    </div>

    <!-- Arrows down -->
    <div style="display: flex; gap: 180px; margin: 4px 0;">
        <div class="v-arrow"></div>
        <div class="v-arrow"></div>
        <div class="v-arrow"></div>
    </div>

    <!-- Row 2: Process 1 + Data Store -->
    <div class="row">
        <div class="process">
            <div class="num">1</div>
            <div class="name">Log Collection<br/>& Parsing</div>
        </div>
        <div style="font-size: 9px; color: #64748B; margin: 0 4px;">Raw Logs</div>
        <div class="v-arrow" style="height: 2px; width: 30px;"></div>
        <div class="datastore">
            <div class="name">Log Database</div>
            <div class="desc">SQLite / PostgreSQL</div>
        </div>
    </div>

    <!-- Arrow down from P1 -->
    <div class="v-arrow" style="margin-left: -100px;"></div>

    <!-- Row 3: Process 2 + Data Store 2 -->
    <div class="row">
        <div class="process">
            <div class="num">2</div>
            <div class="name">Entity Resolution<br/>& Graph Building</div>
        </div>
        <div style="font-size: 9px; color: #64748B; margin: 0 4px;">Entities + Edges</div>
        <div class="v-arrow" style="height: 2px; width: 30px;"></div>
        <div class="datastore">
            <div class="name">Temporal Graph</div>
            <div class="desc">Neo4j / NetworkX</div>
        </div>
    </div>

    <!-- Arrow down from P2 -->
    <div class="v-arrow" style="margin-left: -100px;"></div>

    <!-- Row 4: Process 3 -->
    <div class="row">
        <div class="process">
            <div class="num">3</div>
            <div class="name">TGNN Analysis<br/>& Detection</div>
        </div>
        <div style="font-size: 9px; color: #64748B; margin: 0 4px;">Scores</div>
        <div class="v-arrow" style="height: 2px; width: 30px;"></div>
        <div class="datastore">
            <div class="name">Alerts DB</div>
            <div class="desc">Detection results</div>
        </div>
    </div>

    <!-- Arrow down from P3 -->
    <div class="v-arrow" style="margin-left: -100px;"></div>

    <!-- Row 5: Process 4 + External Output -->
    <div class="row">
        <div class="process">
            <div class="num">4</div>
            <div class="name">Correlation<br/>& Explanation</div>
        </div>
        <div style="font-size: 9px; color: #64748B; margin: 0 4px;">Attack Path</div>
        <div class="v-arrow" style="height: 2px; width: 30px;"></div>
        <div class="entity" style="border-color: #EF4444; background: #FEF2F2;">
            <div class="icon">&#128736;&#65039;</div>
            <div class="name" style="color: #991B1B;">Security Analyst</div>
            <div class="desc" style="color: #EF4444;">Dashboard alerts</div>
        </div>
    </div>
</div>

<div class="legend">
    <div class="legend-item"><div class="legend-rect"></div> External Entity</div>
    <div class="legend-item"><div class="legend-circle"></div> Process</div>
    <div class="legend-item"><div class="legend-open"></div> Data Store</div>
</div>

</body>
</html>
"""

# ============================================================
# DIAGRAM 2: Graph Construction - How Logs Become Graphs
# ============================================================
GRAPH_HTML = """
<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    width: 1200px;
    height: 720px;
    background: #F8FAFC;
    font-family: 'Segoe UI', sans-serif;
    padding: 28px 40px;
}
.title { font-size: 22px; font-weight: 700; color: #1E293B; margin-bottom: 6px; text-align: center; }
.subtitle { font-size: 12px; color: #64748B; margin-bottom: 22px; text-align: center; }

.main {
    display: flex;
    gap: 28px;
    align-items: stretch;
}

/* LEFT: Log Table */
.log-panel {
    flex: 1;
    background: white;
    border-radius: 10px;
    border: 1.5px solid #E2E8F0;
    padding: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.log-panel h3 { font-size: 13px; font-weight: 700; color: #1E293B; margin-bottom: 10px; }
.log-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
}
.log-table th {
    background: #1E293B;
    color: white;
    padding: 6px 8px;
    text-align: left;
    font-weight: 600;
}
.log-table td {
    padding: 5px 8px;
    border-bottom: 1px solid #F1F5F9;
    color: #334155;
}
.log-table tr:nth-child(even) { background: #F8FAFC; }
.log-table .time { color: #3B82F6; font-family: 'Courier New', monospace; font-weight: 600; }
.log-table .user { color: #059669; font-weight: 600; }
.log-table .action { color: #7C3AED; font-weight: 600; }
.log-table .target { color: #B45309; font-weight: 600; }
.log-badge {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 8px;
    font-weight: 600;
}
.badge-auth { background: #DBEAFE; color: #1E40AF; }
.badge-process { background: #FEE2E2; color: #991B1B; }
.badge-network { background: #FEF3C7; color: #92400E; }
.badge-file { background: #D1FAE5; color: #065F46; }

/* CENTER: Arrow */
.arrow-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    width: 60px;
}
.big-arrow {
    font-size: 36px;
    color: #3B82F6;
    margin: 8px 0;
}
.arrow-text {
    font-size: 10px;
    color: #64748B;
    font-weight: 600;
    writing-mode: vertical-lr;
    text-orientation: mixed;
    transform: rotate(180deg);
}

/* RIGHT: Graph */
.graph-panel {
    flex: 1.4;
    background: white;
    border-radius: 10px;
    border: 1.5px solid #E2E8F0;
    padding: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    position: relative;
}
.graph-panel h3 { font-size: 13px; font-weight: 700; color: #1E293B; margin-bottom: 10px; }

.graph-area {
    position: relative;
    width: 100%;
    height: 420px;
}

/* Graph nodes */
.gnode {
    position: absolute;
    width: 80px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    z-index: 2;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.gnode .ntype { font-size: 8px; opacity: 0.7; }
.n-host { background: #DBEAFE; border: 2px solid #3B82F6; color: #1E40AF; left: 180px; top: 20px; }
.n-user { background: #D1FAE5; border: 2px solid #10B981; color: #065F46; left: 20px; top: 110px; }
.n-proc1 { background: #FEE2E2; border: 2px solid #EF4444; color: #991B1B; left: 100px; top: 200px; }
.n-file { background: #FEF3C7; border: 2px solid #F59E0B; color: #92400E; left: 260px; top: 180px; }
.n-proc2 { background: #FEE2E2; border: 2px solid #EF4444; color: #991B1B; left: 100px; top: 310px; }
.n-ip { background: #E0E7FF; border: 2px solid #6366F1; color: #3730A3; left: 320px; top: 310px; }
.n-file2 { background: #FEF3C7; border: 2px solid #F59E0B; color: #92400E; left: 280px; top: 380px; }

/* Edge labels */
.edge-label {
    position: absolute;
    font-size: 8px;
    font-family: 'Courier New', monospace;
    color: #64748B;
    background: #F8FAFC;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid #E2E8F0;
    z-index: 3;
}

/* SVG edges */
.graph-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
}

.note-box {
    margin-top: 12px;
    background: #EFF6FF;
    border-left: 3px solid #3B82F6;
    padding: 8px 12px;
    font-size: 10px;
    color: #1E40AF;
    border-radius: 0 6px 6px 0;
}
</style>
</head>
<body>
<div class="title">How Logs Become a Temporal Graph</div>
<div class="subtitle">Step-by-step: Each log event becomes a node or edge, timestamps create the temporal dimension</div>

<div class="main">
    <!-- LEFT: Raw Logs -->
    <div class="log-panel">
        <h3>Raw Security Logs (Input)</h3>
        <table class="log-table">
            <tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Log Type</th></tr>
            <tr><td class="time">10:15:23</td><td class="user">admin</td><td class="action">LOGIN</td><td class="target">WORKSTATION-01</td><td><span class="log-badge badge-auth">Auth</span></td></tr>
            <tr><td class="time">10:16:01</td><td class="user">admin</td><td class="action">CREATE_PROC</td><td class="target">cmd.exe (PID 4821)</td><td><span class="log-badge badge-process">Process</span></td></tr>
            <tr><td class="time">10:16:05</td><td class="user">admin</td><td class="action">READ</td><td class="target">sensitive.docx</td><td><span class="log-badge badge-file">File</span></td></tr>
            <tr><td class="time">10:16:12</td><td class="user">admin</td><td class="action">WRITE</td><td class="target">evil.bat</td><td><span class="log-badge badge-file">File</span></td></tr>
            <tr><td class="time">10:17:30</td><td class="user">admin</td><td class="action">NETWORK_OUT</td><td class="target">192.168.1.50:4444</td><td><span class="log-badge badge-network">Network</span></td></tr>
            <tr><td class="time">10:18:02</td><td class="user">admin</td><td class="action">WRITE</td><td class="target">data.zip</td><td><span class="log-badge badge-file">File</span></td></tr>
        </table>
        <div class="note-box" style="margin-top: 10px;">
            These are the same kind of logs your OS, firewall, and antivirus generate every second. Each row = one event.
        </div>
    </div>

    <!-- CENTER: Arrow -->
    <div class="arrow-panel">
        <div class="big-arrow">&#10142;</div>
        <div class="arrow-text">Graph Construction</div>
    </div>

    <!-- RIGHT: Graph -->
    <div class="graph-panel">
        <h3>Temporal Graph (Output)</h3>
        <div class="graph-area">
            <svg class="graph-svg">
                <!-- User -> Host -->
                <line x1="60" y1="134" x2="220" y2="44" stroke="#94A3B8" stroke-width="2" marker-end="url(#arrowhead)"/>
                <!-- Host -> Proc1 -->
                <line x1="220" y1="68" x2="140" y2="200" stroke="#94A3B8" stroke-width="2" marker-end="url(#arrowhead)"/>
                <!-- Proc1 -> File -->
                <line x1="180" y1="224" x2="260" y2="204" stroke="#94A3B8" stroke-width="2" marker-end="url(#arrowhead)"/>
                <!-- Proc1 -> Proc2 -->
                <line x1="140" y1="248" x2="140" y2="310" stroke="#94A3B8" stroke-width="2" marker-end="url(#arrowhead)"/>
                <!-- Proc2 -> IP -->
                <line x1="180" y1="334" x2="320" y2="334" stroke="#94A3B8" stroke-width="2" marker-end="url(#arrowhead)"/>
                <!-- Proc2 -> File2 -->
                <line x1="180" y1="334" x2="280" y2="388" stroke="#94A3B8" stroke-width="2" marker-end="url(#arrowhead)"/>
                <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="#94A3B8"/>
                    </marker>
                </defs>
            </svg>

            <div class="gnode n-host">
                <span class="ntype">HOST</span>
                WORKSTATION-01
            </div>
            <div class="gnode n-user">
                <span class="ntype">USER</span>
                admin
            </div>
            <div class="gnode n-proc1">
                <span class="ntype">PROCESS</span>
                cmd.exe
            </div>
            <div class="gnode n-file">
                <span class="ntype">FILE</span>
                sensitive.docx
            </div>
            <div class="gnode n-proc2">
                <span class="ntype">PROCESS</span>
                evil.bat
            </div>
            <div class="gnode n-ip">
                <span class="ntype">IP</span>
                192.168.1.50
            </div>
            <div class="gnode n-file2">
                <span class="ntype">FILE</span>
                data.zip
            </div>

            <!-- Edge time labels -->
            <div class="edge-label" style="left: 110px; top: 72px;">10:15:23</div>
            <div class="edge-label" style="left: 155px; top: 160px;">10:16:01</div>
            <div class="edge-label" style="left: 205px; top: 200px;">10:16:05</div>
            <div class="edge-label" style="left: 148px; top: 270px;">10:16:12</div>
            <div class="edge-label" style="left: 230px; top: 315px;">10:17:30</div>
            <div class="edge-label" style="left: 200px; top: 360px;">10:18:02</div>
        </div>
        <div class="note-box">
            Each log event becomes an <b>edge</b> connecting two <b>nodes</b> (entities). The timestamp stays attached to the edge. This is what "temporal" means - the graph remembers WHEN things happened.
        </div>
    </div>
</div>
</body>
</html>
"""

# ============================================================
# DIAGRAM 3: TGNN Architecture
# ============================================================
TGNN_HTML = """
<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    width: 1200px;
    height: 750px;
    background: #F8FAFC;
    font-family: 'Segoe UI', sans-serif;
    padding: 28px 36px;
}
.title { font-size: 22px; font-weight: 700; color: #1E293B; margin-bottom: 6px; text-align: center; }
.subtitle { font-size: 12px; color: #64748B; margin-bottom: 22px; text-align: center; }

.arch {
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
}

/* Input layer */
.input-row {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: center;
}
.input-box {
    background: #EFF6FF;
    border: 2px solid #3B82F6;
    border-radius: 8px;
    padding: 10px 16px;
    text-align: center;
    min-width: 130px;
}
.input-box .lbl { font-size: 11px; font-weight: 700; color: #1E40AF; }
.input-box .val { font-size: 9px; color: #3B82F6; margin-top: 2px; }

/* Arrow down */
.arr-down {
    font-size: 20px;
    color: #94A3B8;
}

/* TGNN Main Box */
.tgnn-box {
    width: 90%;
    background: white;
    border: 2.5px solid #7C3AED;
    border-radius: 14px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.1);
}
.tgnn-header {
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    color: #7C3AED;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1.5px solid #EDE9FE;
}

.tgnn-layers {
    display: flex;
    gap: 14px;
    align-items: stretch;
    justify-content: center;
}

.layer-card {
    flex: 1;
    background: #FAF5FF;
    border: 1.5px solid #C4B5FD;
    border-radius: 10px;
    padding: 12px;
    text-align: center;
    min-width: 160px;
    max-width: 200px;
}
.layer-card .step-num {
    display: inline-block;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #7C3AED;
    color: white;
    font-size: 11px;
    font-weight: 700;
    line-height: 22px;
    margin-bottom: 6px;
}
.layer-card .layer-name {
    font-size: 12px;
    font-weight: 700;
    color: #5B21B6;
    margin-bottom: 6px;
}
.layer-card .layer-desc {
    font-size: 9.5px;
    color: #6D28D9;
    line-height: 1.4;
}

/* Arrow between layers */
.layer-arrow {
    display: flex;
    align-items: center;
    font-size: 20px;
    color: #A78BFA;
}

/* Output row */
.output-row {
    display: flex;
    gap: 20px;
    align-items: center;
    justify-content: center;
}
.output-box {
    border-radius: 8px;
    padding: 10px 18px;
    text-align: center;
    min-width: 120px;
}
.out-malicious { background: #FEE2E2; border: 2px solid #EF4444; }
.out-suspicious { background: #FEF3C7; border: 2px solid #F59E0B; }
.out-benign { background: #D1FAE5; border: 2px solid #10B981; }
.output-box .lbl { font-size: 12px; font-weight: 700; }
.output-box .val { font-size: 9px; margin-top: 2px; }
.out-malicious .lbl, .out-malicious .val { color: #991B1B; }
.out-suspicious .lbl, .out-suspicious .val { color: #92400E; }
.out-benign .lbl, .out-benign .val { color: #065F46; }

/* Bottom explain boxes */
.explain-row {
    display: flex;
    gap: 14px;
    width: 90%;
    margin-top: 4px;
}
.explain-card {
    flex: 1;
    background: white;
    border: 1.5px solid #E2E8F0;
    border-radius: 8px;
    padding: 10px;
}
.explain-card .ec-title {
    font-size: 11px;
    font-weight: 700;
    color: #1E293B;
    margin-bottom: 4px;
}
.explain-card .ec-desc {
    font-size: 9px;
    color: #475569;
    line-height: 1.4;
}
</style>
</head>
<body>
<div class="title">Temporal Graph Neural Network (TGNN) Architecture</div>
<div class="subtitle">How the AI processes the temporal graph step by step to detect attacks</div>

<div class="arch">
    <!-- INPUT -->
    <div class="input-row">
        <div class="input-box">
            <div class="lbl">Node Features</div>
            <div class="val">User type, Host OS,<br/>Process name, etc.</div>
        </div>
        <div class="input-box">
            <div class="lbl">Edge Features</div>
            <div class="val">Action type (login,<br/>read, write, connect)</div>
        </div>
        <div class="input-box">
            <div class="lbl">Timestamps</div>
            <div class="val">Exact time of each<br/>event (10:15:23...)</div>
        </div>
    </div>

    <div class="arr-down">&#11015;</div>

    <!-- TGNN BOX -->
    <div class="tgnn-box">
        <div class="tgnn-header">Temporal Graph Neural Network (Inside the AI Brain)</div>
        <div class="tgnn-layers">
            <div class="layer-card">
                <div class="step-num">1</div>
                <div class="layer-name">Time Encoding</div>
                <div class="layer-desc">Converts timestamps (10:15:23) into mathematical numbers that the neural network can understand. Uses sinusoidal encoding (like a clock turned into numbers).</div>
            </div>
            <div class="layer-arrow">&#10142;</div>
            <div class="layer-card">
                <div class="step-num">2</div>
                <div class="layer-name">Message Passing</div>
                <div class="layer-desc">Each node "talks" to its neighbors. A process node shares info with the user node and file node it connects to. This is how the GNN learns context.</div>
            </div>
            <div class="layer-arrow">&#10142;</div>
            <div class="layer-card">
                <div class="step-num">3</div>
                <div class="layer-name">Temporal Aggregation</div>
                <div class="layer-desc">Combines all messages from neighbors, BUT weights recent events more than old ones. An event from 2 minutes ago matters more than one from 2 hours ago.</div>
            </div>
            <div class="layer-arrow">&#10142;</div>
            <div class="layer-card">
                <div class="step-num">4</div>
                <div class="layer-name">Entity Memory</div>
                <div class="layer-desc">Each node remembers its own history. "This user logged in 5 times today" or "This process was created by unusual parent." Memory accumulates over time.</div>
            </div>
        </div>
    </div>

    <div class="arr-down">&#11015;</div>

    <!-- OUTPUT -->
    <div class="output-row">
        <div class="output-box out-malicious">
            <div class="lbl">MALICIOUS</div>
            <div class="val">High risk score<br/>(0.8 - 1.0)</div>
        </div>
        <div class="output-box out-suspicious">
            <div class="lbl">SUSPICIOUS</div>
            <div class="val">Medium risk score<br/>(0.4 - 0.8)</div>
        </div>
        <div class="output-box out-benign">
            <div class="lbl">BENIGN</div>
            <div class="val">Low risk score<br/>(0.0 - 0.4)</div>
        </div>
    </div>

    <!-- Bottom explain -->
    <div class="explain-row">
        <div class="explain-card">
            <div class="ec-title">What is "Message Passing"?</div>
            <div class="ec-desc">Think of it like people in a workplace passing notes. Each person (node) tells their neighbors what they know. After several rounds, everyone has a complete picture of what's happening. This is how GNNs "understand" the graph.</div>
        </div>
        <div class="explain-card">
            <div class="ec-title">What is "Temporal Aggregation"?</div>
            <div class="ec-desc">Normal GNNs treat all connections equally. Temporal GNNs say "this connection happened 5 minutes ago, so it's more important than one from 5 days ago." It's like prioritizing recent news over old news.</div>
        </div>
        <div class="explain-card">
            <div class="ec-title">What is "Entity Memory"?</div>
            <div class="ec-desc">Like a notebook each node carries. Every time something happens to that node, it writes it down. Over time, the notebook builds a profile: "This user always logs in at 9 AM" or "This file was suddenly accessed at 3 AM."</div>
        </div>
    </div>
</div>
</body>
</html>
"""

# ============================================================
# DIAGRAM 4: Technology Stack
# ============================================================
TECH_HTML = """
<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    width: 1200px;
    height: 780px;
    background: #F8FAFC;
    font-family: 'Segoe UI', sans-serif;
    padding: 28px 40px;
}
.title { font-size: 22px; font-weight: 700; color: #1E293B; margin-bottom: 6px; text-align: center; }
.subtitle { font-size: 12px; color: #64748B; margin-bottom: 22px; text-align: center; }

.stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    width: 100%;
}

.stack-layer {
    width: 90%;
    border-radius: 10px;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.layer-label {
    min-width: 140px;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    padding: 8px;
    border-radius: 6px;
}
.layer-label .lname { font-size: 13px; font-weight: 700; }
.layer-label .ldesc { font-size: 9px; opacity: 0.8; margin-top: 2px; }

.tech-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    flex: 1;
}
.chip {
    display: flex;
    align-items: center;
    gap: 6px;
    background: white;
    border: 1.5px solid #E2E8F0;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 11px;
    color: #334155;
    font-weight: 500;
}
.chip .cdot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

/* Colors per layer */
.l-present { background: #7C3AED; color: white; }
.l-api { background: #0EA5E9; color: white; }
.l-ai { background: #DC2626; color: white; }
.l-graph { background: #059669; color: white; }
.l-data { background: #D97706; color: white; }
.l-infra { background: #475569; color: white; }

.c-present { background: #7C3AED; }
.c-api { background: #0EA5E9; }
.c-ai { background: #DC2626; }
.c-graph { background: #059669; }
.c-data { background: #D97706; }
.c-infra { background: #475569; }

.layer-present { background: #F5F3FF; border: 1px solid #C4B5FD; }
.layer-api { background: #F0F9FF; border: 1px solid #7DD3FC; }
.layer-ai { background: #FEF2F2; border: 1px solid #FCA5A5; }
.layer-graph { background: #F0FDF4; border: 1px solid #6EE7B7; }
.layer-data { background: #FFFBEB; border: 1px solid #FCD34D; }
.layer-infra { background: #F8FAFC; border: 1px solid #CBD5E1; }
</style>
</head>
<body>
<div class="title">Technology Stack - What Each Tool Does and Where</div>
<div class="subtitle">From foundation (bottom) to user interface (top) - each technology has a specific role</div>

<div class="stack">
    <!-- Layer 6: Presentation (top) -->
    <div class="stack-layer layer-present">
        <div class="layer-label l-present">
            <div class="lname">Presentation</div>
            <div class="ldesc">What the user sees</div>
        </div>
        <div class="tech-chips">
            <div class="chip"><div class="cdot c-present"></div>Streamlit - Web dashboard for analysts</div>
            <div class="chip"><div class="cdot c-present"></div>Plotly - Interactive charts and graphs</div>
            <div class="chip"><div class="cdot c-present"></div>pyvis - Visualize the attack graph</div>
        </div>
    </div>

    <!-- Layer 5: API -->
    <div class="stack-layer layer-api">
        <div class="layer-label l-api">
            <div class="lname">API Layer</div>
            <div class="ldesc">Connects frontend to backend</div>
        </div>
        <div class="tech-chips">
            <div class="chip"><div class="cdot c-api"></div>FastAPI - Serves data to dashboard</div>
            <div class="chip"><div class="cdot c-api"></div>Pydantic - Validates data formats</div>
            <div class="chip"><div class="cdot c-api"></div>Uvicorn - Runs the web server</div>
        </div>
    </div>

    <!-- Layer 4: AI/ML -->
    <div class="stack-layer layer-ai">
        <div class="layer-label l-ai">
            <div class="lname">AI / ML Engine</div>
            <div class="ldesc">The brain of the system</div>
        </div>
        <div class="tech-chips">
            <div class="chip"><div class="cdot c-ai"></div>PyTorch - Deep learning framework</div>
            <div class="chip"><div class="cdot c-ai"></div>PyTorch Geometric - GNN operations on graphs</div>
            <div class="chip"><div class="cdot c-ai"></div>PyG Temporal - Temporal graph neural networks</div>
            <div class="chip"><div class="cdot c-ai"></div>scikit-learn - Traditional ML algorithms</div>
        </div>
    </div>

    <!-- Layer 3: Graph -->
    <div class="stack-layer layer-graph">
        <div class="layer-label l-graph">
            <div class="lname">Graph Layer</div>
            <div class="ldesc">Builds and stores the graph</div>
        </div>
        <div class="tech-chips">
            <div class="chip"><div class="cdot c-graph"></div>NetworkX - Build graphs in Python</div>
            <div class="chip"><div class="cdot c-graph"></div>Neo4j - Graph database (production)</div>
            <div class="chip"><div class="cdot c-graph"></div>Cytoscape.js - Graph visualization in browser</div>
        </div>
    </div>

    <!-- Layer 2: Data Processing -->
    <div class="stack-layer layer-data">
        <div class="layer-label l-data">
            <div class="lname">Data Processing</div>
            <div class="ldesc">Cleans and prepares logs</div>
        </div>
        <div class="tech-chips">
            <div class="chip"><div class="cdot c-data"></div>pandas - Manipulate log data tables</div>
            <div class="chip"><div class="cdot c-data"></div>NumPy - Fast number calculations</div>
            <div class="chip"><div class="cdot c-data"></div>Apache Arrow - Fast data exchange format</div>
        </div>
    </div>

    <!-- Layer 1: Infrastructure -->
    <div class="stack-layer layer-infra">
        <div class="layer-label l-infra">
            <div class="lname">Foundation</div>
            <div class="ldesc">Base tools and storage</div>
        </div>
        <div class="tech-chips">
            <div class="chip"><div class="cdot c-infra"></div>Python 3.10+ - Core programming language</div>
            <div class="chip"><div class="cdot c-infra"></div>SQLite/PostgreSQL - Store metadata and alerts</div>
            <div class="chip"><div class="cdot c-infra"></div>Docker - Package and deploy the system</div>
            <div class="chip"><div class="cdot c-infra"></div>MLflow - Track model experiments</div>
        </div>
    </div>
</div>
</body>
</html>
"""

# ============================================================
# DIAGRAM 5: Complete Workflow (11 Steps)
# ============================================================
WORKFLOW_HTML = """
<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    width: 1200px;
    height: 820px;
    background: #F8FAFC;
    font-family: 'Segoe UI', sans-serif;
    padding: 28px 36px;
}
.title { font-size: 22px; font-weight: 700; color: #1E293B; margin-bottom: 6px; text-align: center; }
.subtitle { font-size: 12px; color: #64748B; margin-bottom: 18px; text-align: center; }

.workflow {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
}

/* Phase headers */
.phase {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 2px;
}
.phase-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}
.phase-name {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.phase-line {
    flex: 1;
    height: 1px;
}

/* Step rows */
.steps-row {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: nowrap;
    margin-bottom: 4px;
}

.step-card {
    flex: 1;
    min-width: 90px;
    max-width: 130px;
    background: white;
    border-radius: 8px;
    border: 1.5px solid #E2E8F0;
    padding: 10px;
    text-align: center;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    position: relative;
}
.step-card .snum {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
}
.step-card .sname {
    font-size: 11px;
    font-weight: 700;
    color: #1E293B;
    margin-top: 6px;
    margin-bottom: 4px;
}
.step-card .sdesc {
    font-size: 8.5px;
    color: #64748B;
    line-height: 1.3;
}
.step-card .sicon {
    font-size: 20px;
    margin-bottom: 4px;
}

/* Arrow between steps */
.step-arrow {
    display: flex;
    align-items: center;
    font-size: 16px;
    color: #94A3B8;
    padding-top: 10px;
}

/* Phase colors */
.p-input .phase-dot, .s-input .snum { background: #3B82F6; }
.p-input .phase-name { color: #1E40AF; }
.p-input .phase-line { background: #BFDBFE; }
.s-input { border-color: #BFDBFE; }

.p-process .phase-dot, .s-process .snum { background: #10B981; }
.p-process .phase-name { color: #065F46; }
.p-process .phase-line { background: #A7F3D0; }
.s-process { border-color: #A7F3D0; }

.p-graph .phase-dot, .s-graph .snum { background: #F59E0B; }
.p-graph .phase-name { color: #92400E; }
.p-graph .phase-line { background: #FDE68A; }
.s-graph { border-color: #FDE68A; }

.p-detect .phase-dot, .s-detect .snum { background: #EF4444; }
.p-detect .phase-name { color: #991B1B; }
.p-detect .phase-line { background: #FECACA; }
.s-detect { border-color: #FECACA; }

.p-output .phase-dot, .s-output .snum { background: #7C3AED; }
.p-output .phase-name { color: #5B21B6; }
.p-output .phase-line { background: #DDD6FE; }
.s-output { border-color: #DDD6FE; }

/* Loop arrow */
.loop-section {
    display: flex;
    justify-content: center;
    margin: 4px 0;
}
.loop-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #FEF3C7;
    border: 1.5px dashed #F59E0B;
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 10px;
    color: #92400E;
    font-weight: 600;
}
.loop-arrow { font-size: 16px; }
</style>
</head>
<body>
<div class="title">Complete TGDetect Workflow - All 11 Steps</div>
<div class="subtitle">From raw logs to analyst dashboard - the full pipeline of how data transforms at each stage</div>

<div class="workflow">
    <!-- PHASE 1: Input -->
    <div class="phase p-input">
        <div class="phase-dot"></div>
        <div class="phase-name">Phase 1: Data Input</div>
        <div class="phase-line"></div>
    </div>
    <div class="steps-row">
        <div class="step-card s-input">
            <div class="snum">1</div>
            <div class="sicon">&#128196;</div>
            <div class="sname">Log Collection</div>
            <div class="sdesc">Gather raw logs from Windows events, auth logs, network packets, DNS queries, cloud APIs</div>
        </div>
        <div class="step-arrow">&#10142;</div>
        <div class="step-card s-input">
            <div class="snum">2</div>
            <div class="sicon">&#9881;&#65039;</div>
            <div class="sname">Parsing &amp; Normalization</div>
            <div class="sdesc">Clean messy logs, standardize formats, remove duplicates, extract key fields</div>
        </div>
        <div class="step-arrow">&#10142;</div>
        <div class="step-card s-input">
            <div class="snum">3</div>
            <div class="sicon">&#128269;</div>
            <div class="sname">Entity Resolution</div>
            <div class="sdesc">Merge same entities: "PC-01", "pc-01.local", "10.0.0.5" all become one node</div>
        </div>
    </div>

    <!-- PHASE 2: Graph Building -->
    <div class="phase p-graph" style="margin-top: 6px;">
        <div class="phase-dot"></div>
        <div class="phase-name">Phase 2: Graph Construction</div>
        <div class="phase-line"></div>
    </div>
    <div class="steps-row">
        <div class="step-card s-graph">
            <div class="snum">4</div>
            <div class="sicon">&#128279;</div>
            <div class="sname">Graph Construction</div>
            <div class="sdesc">Create nodes (users, hosts, processes, files, IPs) and edges (actions between them)</div>
        </div>
        <div class="step-arrow">&#10142;</div>
        <div class="step-card s-graph">
            <div class="snum">5</div>
            <div class="sicon">&#128202;</div>
            <div class="sname">Feature Engineering</div>
            <div class="sdesc">Assign numbers to each node/edge: "This user is admin=1, this process is rare=0.9"</div>
        </div>
    </div>

    <!-- PHASE 3: AI Detection -->
    <div class="phase p-detect" style="margin-top: 6px;">
        <div class="phase-dot"></div>
        <div class="phase-name">Phase 3: TGNN Detection</div>
        <div class="phase-line"></div>
    </div>
    <div class="steps-row">
        <div class="step-card s-detect">
            <div class="snum">6</div>
            <div class="sicon">&#129504;</div>
            <div class="sname">TGNN Processing</div>
            <div class="sdesc">The neural network processes the graph across time steps (t-2, t-1, t) and outputs scores</div>
        </div>
        <div class="step-arrow">&#10142;</div>
        <div class="step-card s-detect">
            <div class="snum">7</div>
            <div class="sicon">&#128737;&#65039;</div>
            <div class="sname">Detection</div>
            <div class="sdesc">Classify each event as Benign (safe), Suspicious (watch), or Malicious (alert!)</div>
        </div>
    </div>

    <!-- PHASE 4: Analysis -->
    <div class="phase p-output" style="margin-top: 6px;">
        <div class="phase-dot"></div>
        <div class="phase-name">Phase 4: Analysis &amp; Output</div>
        <div class="phase-line"></div>
    </div>
    <div class="steps-row">
        <div class="step-card s-output">
            <div class="snum">8</div>
            <div class="sicon">&#128279;</div>
            <div class="sname">Alert Correlation</div>
            <div class="sdesc">Group related alerts into one incident: "Login + file access + network call = one attack"</div>
        </div>
        <div class="step-arrow">&#10142;</div>
        <div class="step-card s-output">
            <div class="snum">9</div>
            <div class="sicon">&#128640;</div>
            <div class="sname">Path Reconstruction</div>
            <div class="sdesc">Trace back: Find the first entry point, follow the chain to the final target</div>
        </div>
        <div class="step-arrow">&#10142;</div>
        <div class="step-card s-output">
            <div class="snum">10</div>
            <div class="sicon">&#128270;</div>
            <div class="sname">Explainability</div>
            <div class="sdesc">Show WHY: "Flagged because unusual login time + rare process + data exfiltration"</div>
        </div>
        <div class="step-arrow">&#10142;</div>
        <div class="step-card s-output">
            <div class="snum">11</div>
            <div class="sicon">&#128187;</div>
            <div class="sname">Dashboard</div>
            <div class="sdesc">Security analyst sees all alerts, attack graphs, and timelines in one place</div>
        </div>
    </div>

    <!-- Feedback loop -->
    <div class="loop-section">
        <div class="loop-box">
            <span>Concept Drift Feedback Loop</span>
            <span class="loop-arrow">&#8635;</span>
            <span>Model learns from new patterns and adapts continuously</span>
        </div>
    </div>
</div>
</body>
</html>
"""

# ============================================================
# MAIN: Generate all diagrams
# ============================================================
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        diagrams = [
            ("dfd_overview.png", DFD_HTML, 1200, 700),
            ("graph_construction.png", GRAPH_HTML, 1200, 720),
            ("tgnn_architecture.png", TGNN_HTML, 1200, 750),
            ("tech_stack.png", TECH_HTML, 1200, 780),
            ("workflow_steps.png", WORKFLOW_HTML, 1200, 820),
        ]

        for filename, html, width, height in diagrams:
            page = await browser.new_page(viewport={"width": width, "height": height})
            await page.set_content(html, wait_until="networkidle")
            filepath = os.path.join(OUTPUT_DIR, filename)
            await page.screenshot(path=filepath, full_page=True)
            print(f"Generated: {filepath}")
            await page.close()

        await browser.close()

asyncio.run(main())
print("\nAll diagrams generated!")
