#!/usr/bin/env python3
"""
TGDetect - In-Depth Temporal GNN Architecture Study Diagram
Multi-layer architecture showing the complete TGNN pipeline with proper academic naming.
"""

import asyncio
from playwright.async_api import async_playwright

HTML_PATH = "/home/z/my-project/scripts/tgnn_architecture.html"
OUTPUT_PNG = "/home/z/my-project/download/TGDetect_TGNN_Architecture_Study.png"
OUTPUT_PDF = "/home/z/my-project/download/TGDetect_TGNN_Architecture_Study.pdf"

html_content = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --text: #1F2937;
  --text-sub: #4B5563;
  --text-muted: #9CA3AF;
  --bg: #FFFFFF;
  --surface: #F9FAFB;
  --border: #E5E7EB;
  --border-light: #F3F4F6;
  --blue: #3B82F6;
  --blue-dark: #1E40AF;
  --cyan: #06B6D4;
  --purple: #8B5CF6;
  --purple-dark: #5B21B6;
  --amber: #F59E0B;
  --amber-dark: #92400E;
  --green: #10B981;
  --green-dark: #065F46;
  --red: #EF4444;
  --teal: #14B8A6;
  --connector: #94A3B8;
  --connector-light: #CBD5E1;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

#root {
  width: fit-content;
  min-width: 1400px;
  margin: 0 auto;
  padding: 0 16px 20px 16px;
}

/* Title Block */
.arch-title {
  text-align: center;
  margin-bottom: 28px;
  padding-top: 8px;
}
.arch-title h1 {
  font-size: 26px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.5px;
  margin-bottom: 8px;
}
.arch-title h1 span {
  color: var(--blue-dark);
}
.arch-title .subtitle {
  font-size: 14px;
  color: var(--text-sub);
  font-weight: 400;
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.5;
}

/* Layer Container */
.arch-layer {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 20px 26px 18px;
  margin-bottom: 14px;
  position: relative;
}
.arch-layer .layer-tag {
  position: absolute;
  top: -11px;
  left: 20px;
  background: var(--bg);
  padding: 2px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  border-radius: 4px;
  color: var(--text-sub);
  border: 1.5px solid var(--border);
}

/* Phase group inside layers */
.phase-group {
  background: var(--bg);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 16px 20px 14px;
  margin-bottom: 12px;
}
.phase-group:last-child { margin-bottom: 0; }

.phase-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
  padding: 7px 14px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Color schemes for phases - same-hue blue-gray progression */
.phase-blue .phase-title { background: #EFF6FF; color: #1E40AF; border-left: 3px solid #3B82F6; }
.phase-cyan .phase-title { background: #ECFEFF; color: #0E7490; border-left: 3px solid #06B6D4; }
.phase-purple .phase-title { background: #F5F3FF; color: #5B21B6; border-left: 3px solid #8B5CF6; }
.phase-amber .phase-title { background: #FFFBEB; color: #92400E; border-left: 3px solid #F59E0B; }
.phase-green .phase-title { background: #ECFDF5; color: #065F46; border-left: 3px solid #10B981; }
.phase-teal .phase-title { background: #F0FDFA; color: #115E59; border-left: 3px solid #14B8A6; }
.phase-red .phase-title { background: #FEF2F2; color: #991B1B; border-left: 3px solid #EF4444; }

/* Component boxes */
.comp-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding-left: 12px;
}
.comp-box {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 10px 16px;
  min-width: 140px;
  flex: 0 1 auto;
}
.comp-box .comp-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 3px;
}
.comp-box .comp-desc {
  font-size: 11px;
  color: var(--text-sub);
  line-height: 1.45;
}
.comp-box.highlight {
  border-color: var(--blue);
  background: #EFF6FF;
}
.comp-box.highlight .comp-name {
  color: var(--blue-dark);
}

/* Small inline tags */
.tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  margin-right: 4px;
  margin-top: 4px;
}
.tag-blue { background: #DBEAFE; color: #1E40AF; }
.tag-purple { background: #EDE9FE; color: #5B21B6; }
.tag-cyan { background: #CFFAFE; color: #0E7490; }
.tag-amber { background: #FEF3C7; color: #92400E; }
.tag-green { background: #D1FAE5; color: #065F46; }
.tag-teal { background: #CCFBF1; color: #115E59; }
.tag-red { background: #FEE2E2; color: #991B1B; }
.tag-gray { background: #F3F4F6; color: #4B5563; }

/* Detail description row */
.detail-row {
  display: flex;
  gap: 16px;
  padding-left: 12px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.detail-item {
  font-size: 11.5px;
  color: var(--text-sub);
  line-height: 1.5;
  max-width: 420px;
}
.detail-item strong {
  color: var(--text);
  font-weight: 600;
}

/* Data flow arrows between layers */
.arrow-row {
  text-align: center;
  margin: 4px 0;
  position: relative;
}
.arrow-row svg {
  display: inline-block;
}

/* Objective tag */
.obj-tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.obj-1 { background: #DBEAFE; color: #1E40AF; border: 1px solid #93C5FD; }
.obj-2 { background: #EDE9FE; color: #5B21B6; border: 1px solid #C4B5FD; }
.obj-3 { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
.obj-4 { background: #D1FAE5; color: #065F46; border: 1px solid #6EE7B7; }

/* Log source pill */
.log-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-left: 12px;
}
.log-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 6px 14px 6px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}
.log-pill .pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-auth { background: #3B82F6; }
.dot-audit { background: #8B5CF6; }
.dot-netflow { background: #06B6D4; }
.dot-dns { background: #F59E0B; }
.dot-cloud { background: #10B981; }

/* Math notation */
.math {
  font-family: 'Cambria Math', 'Times New Roman', serif;
  font-style: italic;
  font-size: 12px;
  color: var(--purple-dark);
}

/* Two-column detail */
.two-col {
  display: flex;
  gap: 24px;
  padding-left: 12px;
  flex-wrap: wrap;
}
.two-col > * {
  flex: 1;
  min-width: 280px;
}

/* Sub-section headers */
.sub-header {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-sub);
  margin: 10px 0 6px 12px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

/* Legend */
.arch-legend {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 28px;
  padding: 16px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-sub);
}
.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1.5px solid;
}

/* Horizontal data flow */
.hflow {
  display: flex;
  align-items: center;
  gap: 0;
  padding-left: 12px;
  margin-top: 8px;
}
.hflow-node {
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 6px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}
.hflow-arrow {
  font-size: 16px;
  color: var(--connector);
  padding: 0 6px;
  font-weight: 700;
}

/* Nested component group */
.nested-group {
  border: 1.5px dashed var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 8px 0 0 12px;
  position: relative;
}
.nested-group .nested-label {
  position: absolute;
  top: -9px;
  left: 10px;
  background: var(--bg);
  padding: 0 6px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.nested-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.nested-box {
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 11.5px;
}
.nested-box .nb-title {
  font-weight: 700;
  color: var(--text);
  margin-bottom: 2px;
}
.nested-box .nb-desc {
  color: var(--text-sub);
  font-size: 10.5px;
  line-height: 1.4;
}

/* Inline formula block */
.formula-block {
  background: #F9FAFB;
  border: 1px solid var(--border);
  border-left: 3px solid var(--purple);
  border-radius: 0 6px 6px 0;
  padding: 10px 16px;
  margin: 8px 0 0 12px;
  font-family: 'Cambria Math', 'Times New Roman', serif;
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
}
.formula-block .formula-label {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 700;
  color: var(--purple-dark);
  margin-bottom: 4px;
}

/* PDF Page Rules */
@page {
  size: letter;
  margin: 56px 46px 52px 46px;
}
.arch-layer {
  break-inside: avoid;
  page-break-inside: avoid;
}
.arrow-row {
  break-inside: avoid;
  page-break-inside: avoid;
}
.arch-legend {
  break-inside: avoid;
  page-break-inside: avoid;
}
.arch-title {
  break-after: avoid;
  page-break-after: avoid;
}

/* Feedback loop annotation */
.feedback-loop {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #FFF7ED;
  border: 1.5px dashed #F59E0B;
  border-radius: 8px;
  margin: 8px 0 0 12px;
  font-size: 12px;
  color: var(--amber-dark);
  font-weight: 500;
}
.feedback-loop .fl-arrow {
  font-size: 14px;
  color: #F59E0B;
}
</style>
</head>
<body>
<div id="root">

<div class="arch-title">
  <h1><span>TGDetect</span> &mdash; Heterogeneous Continuous-Time TGNN Architecture</h1>
  <div class="subtitle">In-Depth Architecture Study &middot; Multi-Step Cyberattack Detection Framework<br>Aligned with Objectives O1&ndash;O4</div>
</div>

<!-- ============================================================ -->
<!-- LAYER 1: MULTI-SOURCE DATA INGESTION (Objective 1) -->
<!-- ============================================================ -->
<div class="arch-layer">
  <div class="layer-tag">Layer 1 &mdash; Multi-Source Data Ingestion &amp; Preprocessing</div>
  <span class="obj-tag obj-1">OBJ 1</span>

  <div class="phase-group phase-blue">
    <div class="phase-title">1.1 Heterogeneous Log Source Collection</div>
    <div class="log-pills">
      <div class="log-pill"><span class="pill-dot dot-auth"></span>Authentication Logs</div>
      <div class="log-pill"><span class="pill-dot dot-audit"></span>System Audit Logs</div>
      <div class="log-pill"><span class="pill-dot dot-netflow"></span>Network Flow Data</div>
      <div class="log-pill"><span class="pill-dot dot-dns"></span>DNS Query Logs</div>
      <div class="log-pill"><span class="pill-dot dot-cloud"></span>Cloud API Logs</div>
    </div>
    <div class="detail-row">
      <div class="detail-item"><strong>Entity Types:</strong> Users, Processes, Files, IP Addresses, Domains, Ports, Cloud Resources, Registry Keys</div>
      <div class="detail-item"><strong>Event Types:</strong> Process Creation, File Read/Write, Network Connection, DNS Resolution, Authentication, Privilege Escalation, API Call</div>
    </div>
  </div>

  <div class="phase-group phase-blue">
    <div class="phase-title">1.2 Temporal Normalization &amp; Entity Resolution</div>
    <div class="two-col">
      <div>
        <div class="sub-header">Normalization Pipeline</div>
        <div class="hflow">
          <div class="hflow-node">Raw Timestamps</div>
          <div class="hflow-arrow">&rarr;</div>
          <div class="hflow-node">UTC Standardization</div>
          <div class="hflow-arrow">&rarr;</div>
          <div class="hflow-node">Continuous-Time</div>
          <div class="hflow-arrow">&rarr;</div>
          <div class="hflow-node"><span class="math">t &isin; &#8477;<sup>+</sup></span></div>
        </div>
        <div class="detail-item" style="margin-top:8px;"><strong>Entity Resolution:</strong> Deduplication via hashing (SHA-256 of entity attributes). Cross-source identity linking (e.g., PID-to-User mapping, IP-to-Domain correlation).</div>
      </div>
      <div>
        <div class="sub-header">Schema Unification</div>
        <div class="comp-row">
          <div class="comp-box">
            <div class="comp-name">Unified Event Schema</div>
            <div class="comp-desc"><span class="math">(src, dst, action, t, attrs)</span></div>
          </div>
        </div>
        <div class="detail-item" style="margin-top:8px;"><strong>Feature Extraction:</strong> Categorical encoding of action types, numerical features from event attributes, temporal features from timestamp deltas.</div>
      </div>
    </div>
  </div>
</div>

<!-- Arrow -->
<div class="arrow-row">
  <svg width="40" height="28" viewBox="0 0 40 28"><path d="M20 2 L20 20 M14 14 L20 20 L26 14" stroke="#94A3B8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
</div>

<!-- ============================================================ -->
<!-- LAYER 2: TEMPORAL GRAPH CONSTRUCTION (Objective 1) -->
<!-- ============================================================ -->
<div class="arch-layer">
  <div class="layer-tag">Layer 2 &mdash; Heterogeneous Temporal Graph Construction</div>
  <span class="obj-tag obj-1">OBJ 1</span>

  <div class="phase-group phase-cyan">
    <div class="phase-title">2.1 Graph Schema Definition</div>
    <div class="two-col">
      <div>
        <div class="comp-row">
          <div class="comp-box highlight">
            <div class="comp-name">Nodes (Entities)</div>
            <div class="comp-desc">Each unique entity becomes a node with type-specific initial feature vector. <span class="tag tag-blue">Heterogeneous</span></div>
          </div>
          <div class="comp-box highlight">
            <div class="comp-name">Edges (Interactions)</div>
            <div class="comp-desc">Each event becomes a directed, timestamped edge connecting source to destination entity.</div>
          </div>
        </div>
      </div>
      <div>
        <div class="comp-row">
          <div class="comp-box">
            <div class="comp-name">Node Features</div>
            <div class="comp-desc"><span class="math">h<sub>v</sub><sup>(0)</sup></span> &mdash; Type-specific initial embedding. Dimension: <span class="math">d</span></div>
          </div>
          <div class="comp-box">
            <div class="comp-name">Edge Features</div>
            <div class="comp-desc"><span class="math">e<sub>uv</sub></span> &mdash; Action type encoding + attribute vector. Includes timestamp <span class="math">t<sub>uv</sub></span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="formula-block">
      <div class="formula-label">Formal Graph Definition</div>
      <span class="math">G<sub>t</sub> = (V, E, T, A)</span> where <span class="math">V</span> = set of heterogeneous nodes, <span class="math">E</span> = set of directed edges, <span class="math">T : E &rarr; &#8477;<sup>+</sup></span> assigns continuous timestamps, <span class="math">A : E &rarr; &#8477;<sup>k</sup></span> assigns edge feature vectors.
    </div>
  </div>

  <div class="phase-group phase-cyan">
    <div class="phase-title">2.2 Continuous-Time Temporal Graph Construction</div>
    <div class="two-col">
      <div>
        <div class="sub-header">Edge Temporal Ordering</div>
        <div class="detail-item">Events are indexed as a chronologically sorted sequence. Each new event <span class="math">e<sub>i</sub> = (u, v, t<sub>i</sub>, a<sub>i</sub>)</span> is appended to the temporal edge list, maintaining the invariant <span class="math">t<sub>1</sub> &le; t<sub>2</sub> &le; ... &le; t<sub>n</sub></span>.</div>
        <div class="detail-item" style="margin-top:6px;"><strong>Sliding Window:</strong> A configurable temporal window <span class="math">&Delta;W</span> retains only recent edges for online inference, preventing unbounded memory growth.</div>
      </div>
      <div>
        <div class="sub-header">Graph Storage</div>
        <div class="comp-row">
          <div class="comp-box">
            <div class="comp-name">In-Memory Graph</div>
            <div class="comp-desc">CSR format adjacency + timestamp array for fast temporal neighborhood queries.</div>
          </div>
          <div class="comp-box">
            <div class="comp-name">Persistent Storage</div>
            <div class="comp-desc">Neo4j / NetworkX serialization for full provenance graph persistence.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Arrow -->
<div class="arrow-row">
  <svg width="40" height="28" viewBox="0 0 40 28"><path d="M20 2 L20 20 M14 14 L20 20 L26 14" stroke="#94A3B8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
</div>

<!-- ============================================================ -->
<!-- LAYER 3: TGNN CORE (Objective 1) -->
<!-- ============================================================ -->
<div class="arch-layer">
  <div class="layer-tag">Layer 3 &mdash; Heterogeneous Continuous-Time TGNN Core Engine</div>
  <span class="obj-tag obj-1">OBJ 1</span>

  <div class="phase-group phase-purple">
    <div class="phase-title">3.1 Continuous-Time Time Encoding Module</div>
    <div class="two-col">
      <div>
        <div class="comp-row">
          <div class="comp-box highlight">
            <div class="comp-name">Sinusoidal Time Encoding</div>
            <div class="comp-desc">Projects scalar timestamps into high-dimensional space preserving temporal proximity relationships.</div>
          </div>
          <div class="comp-box">
            <div class="comp-name">Time Decay Function</div>
            <div class="comp-desc">Exponential decay weights recent interactions higher than distant ones.</div>
          </div>
        </div>
      </div>
      <div>
        <div class="formula-block" style="margin-left:0;">
          <div class="formula-label">Sinusoidal Time Encoding</div>
          <span class="math">TE(t) = [sin(&omega;<sub>1</sub>t), cos(&omega;<sub>1</sub>t), ..., sin(&omega;<sub>d/2</sub>t), cos(&omega;<sub>d/2</sub>t)]</span><br>
          where <span class="math">&omega;<sub>k</sub> = 1 / 10000<sup>2k/d</sup></span> (positional encoding frequencies)
        </div>
      </div>
    </div>
    <div class="formula-block">
      <div class="formula-label">Temporal Attention Weight</div>
      <span class="math">&alpha;<sub>uv</sub><sup>(t)</sup> = exp(-&sigma; &middot; |t - t<sub>uv</sub>|) &middot; softmax(W<sub>a</sub> &middot; [h<sub>u</sub> &#9650; h<sub>v</sub> &#9650; TE(t<sub>uv</sub>)])</span> &mdash; Combines temporal recency with learned attention over node states and time embeddings.
    </div>
  </div>

  <div class="phase-group phase-purple">
    <div class="phase-title">3.2 Neighborhood Message Passing (Temporal Attention)</div>
    <div class="two-col">
      <div>
        <div class="hflow">
          <div class="hflow-node">Source Node <span class="math">h<sub>u</sub></span></div>
          <div class="hflow-arrow">&rarr;</div>
          <div class="hflow-node">Linear Transform <span class="math">W<sub>&phi;</sub></span></div>
          <div class="hflow-arrow">&rarr;</div>
          <div class="hflow-node">Temporal Attention <span class="math">&alpha;</span></div>
          <div class="hflow-arrow">&rarr;</div>
          <div class="hflow-node">Weighted Aggregate <span class="math">&Sigma;</span></div>
          <div class="hflow-arrow">&rarr;</div>
          <div class="hflow-node">Message <span class="math">m<sub>v</sub></span></div>
        </div>
        <div class="detail-item" style="margin-top:8px;"><strong>Multi-Head Attention:</strong> <span class="math">K</span> independent attention heads compute parallel message representations, concatenated and projected: <span class="math">m<sub>v</sub> = ||<sub>k=1</sub><sup>K</sup> W<sub>k</sub> &middot; Attn<sub>k</sub>(N<sub>t</sub>(v))</span></div>
      </div>
      <div>
        <div class="formula-block" style="margin-left:0;">
          <div class="formula-label">Message Computation</div>
          <span class="math">m<sub>v</sub><sup>(l)</sup>(t) = &Sigma;<sub>u&isin;N<sub>t</sub>(v)</sub> &alpha;<sub>uv</sub><sup>(l)</sup>(t) &middot; &phi;(h<sub>u</sub><sup>(l)</sup>, e<sub>uv</sub>, TE(t<sub>uv</sub>))</span><br><br>
          <span class="math">N<sub>t</sub>(v)</span> = temporal neighborhood of <span class="math">v</span> at time <span class="math">t</span> (all edges <span class="math">(u,v,t') : t' &le; t</span>)
        </div>
      </div>
    </div>
  </div>

  <div class="phase-group phase-purple">
    <div class="phase-title">3.3 Temporal Aggregation Module</div>
    <div class="comp-row">
      <div class="comp-box">
        <div class="comp-name">Temporal Attention Pooling</div>
        <div class="comp-desc">Attention-weighted aggregation over all timestamps in the neighborhood window. Learns which time steps matter most for the current classification.</div>
      </div>
      <div class="comp-box">
        <div class="comp-name">Sliding Window Aggregation</div>
        <div class="comp-desc">Aggregates messages within a configurable time window <span class="math">&Delta;W</span>, enabling efficient online processing without recomputing full history.</div>
      </div>
      <div class="comp-box">
        <div class="comp-name">RNN/GRU Temporal Encoder</div>
        <div class="comp-desc">Sequentially processes chronologically ordered messages through a GRU cell, capturing temporal dynamics and event ordering effects.</div>
      </div>
    </div>
    <div class="formula-block">
      <div class="formula-label">Node State Update</div>
      <span class="math">h<sub>v</sub><sup>(l+1)</sup>(t) = GRU(h<sub>v</sub><sup>(l)</sup>(t), AGG({m<sub>v</sub><sup>(l)</sup>(t<sub>i</sub>) : t<sub>i</sub> &isin; [t - &Delta;W, t]}))</span> &mdash; Updates node embedding by aggregating temporally-weighted messages from neighbors.
    </div>
  </div>

  <div class="phase-group phase-purple">
    <div class="phase-title">3.4 Persistent Entity Memory Module</div>
    <div class="two-col">
      <div>
        <div class="comp-row">
          <div class="comp-box highlight">
            <div class="comp-name">Entity Memory Bank</div>
            <div class="comp-desc">Per-node trainable memory matrix <span class="math">M<sub>v</sub> &isin; &#8477;<sup>m&times;d</sup></span> that persists across timesteps.</div>
          </div>
          <div class="comp-box">
            <div class="comp-name">Memory Read/Write Gates</div>
            <div class="comp-desc">Learned gates control which information is read from and written to memory at each event.</div>
          </div>
        </div>
        <div class="detail-item" style="margin-top:8px;"><strong>Purpose:</strong> Captures long-term behavioral patterns for each entity (e.g., "User X typically accesses these files every morning"). Enables detection of deviations from established baselines.</div>
      </div>
      <div>
        <div class="formula-block" style="margin-left:0;">
          <div class="formula-label">Memory Update Mechanism</div>
          <span class="math">r<sub>v</sub><sup>(t)</sup> = &sigma;(W<sub>r</sub> &middot; [h<sub>v</sub><sup>(l)</sup>(t) || m<sub>v</sub><sup>(old)</sup>])</span> &mdash; Read gate<br>
          <span class="math">w<sub>v</sub><sup>(t)</sup> = &sigma;(W<sub>w</sub> &middot; [h<sub>v</sub><sup>(l)</sup>(t) || m<sub>v</sub><sup>(old)</sup>])</span> &mdash; Write gate<br>
          <span class="math">m<sub>v</sub><sup>(new)</sup> = r<sub>v</sub> &odot; m<sub>v</sub><sup>(old)</sup> + w<sub>v</sub> &odot; h<sub>v</sub><sup>(l)</sup>(t)</span> &mdash; Memory update
        </div>
      </div>
    </div>
  </div>

  <div class="phase-group phase-purple">
    <div class="phase-title">3.5 Heterogeneous Type-Aware Processing</div>
    <div class="comp-row">
      <div class="comp-box">
        <div class="comp-name">Type-Specific Projection</div>
        <div class="comp-desc">Separate linear projections <span class="math">W<sub>&tau;</sub></span> for each node/edge type <span class="math">&tau;</span>, enabling type-aware feature transformation.</div>
      </div>
      <div class="comp-box">
        <div class="comp-name">Type Embedding</div>
        <div class="comp-desc">Learnable type embeddings <span class="math">e<sub>&tau;</sub></span> concatenated to node features, providing structural type information to the model.</div>
      </div>
      <div class="comp-box">
        <div class="comp-name">Cross-Type Attention</div>
        <div class="comp-desc">Attention mechanism that modulates message strength based on source-target type pair, capturing cross-type interaction significance.</div>
      </div>
    </div>
    <div class="formula-block">
      <div class="formula-label">Type-Aware Message Function</div>
      <span class="math">&phi;<sub>&tau;(u),&tau;(v),&tau;(e)</sub>(h<sub>u</sub>, e<sub>uv</sub>, TE(t)) = W<sub>&tau;(v)</sub> &middot; MLP([W<sub>&tau;(u)</sub>h<sub>u</sub> || W<sub>&tau;(e)</sub>e<sub>uv</sub> || TE(t<sub>uv</sub>) || e<sub>&tau;(u)</sub> || e<sub>&tau;(v)</sub>])</span>
    </div>
  </div>

  <div class="phase-group phase-purple">
    <div class="phase-title">3.6 Classification Head</div>
    <div class="hflow">
      <div class="hflow-node">Final Embedding <span class="math">h<sub>v</sub><sup>(L)</sup>(t)</span></div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">MLP Decoder</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Softmax / Sigmoid</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node" style="border-color:#EF4444; color:#991B1B;">Attack Label <span class="math">y&#770;</span></div>
    </div>
    <div class="detail-row">
      <div class="detail-item"><strong>Binary Classification:</strong> <span class="math">y&#770; = &sigma;(W<sub>out</sub> &middot; h<sub>v</sub><sup>(L)</sup>(t) + b)</span> &mdash; Malicious vs. Benign event prediction.</div>
      <div class="detail-item"><strong>Multi-Class:</strong> APT, LotL, Zero-day, Benign &mdash; Cross-type attack categorization with hierarchical classification.</div>
      <div class="detail-item"><strong>Output:</strong> Event-level classification with confidence score, plus node-level anomaly scores for graph-wide detection.</div>
    </div>
  </div>
</div>

<!-- Arrow -->
<div class="arrow-row">
  <svg width="40" height="28" viewBox="0 0 40 28"><path d="M20 2 L20 20 M14 14 L20 20 L26 14" stroke="#94A3B8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
</div>

<!-- ============================================================ -->
<!-- LAYER 4: CONCEPT DRIFT ADAPTATION (Objective 2) -->
<!-- ============================================================ -->
<div class="arch-layer">
  <div class="layer-tag">Layer 4 &mdash; Online Concept Drift Adaptation</div>
  <span class="obj-tag obj-2">OBJ 2</span>

  <div class="phase-group phase-amber">
    <div class="phase-title">4.1 Drift Detection Engine</div>
    <div class="two-col">
      <div>
        <div class="comp-row">
          <div class="comp-box highlight">
            <div class="comp-name">Statistical Drift Detector</div>
            <div class="comp-desc">ADWIN (Adaptive Windowing) or Page-Hinkley test monitors prediction error distribution for significant changes.</div>
          </div>
          <div class="comp-box">
            <div class="comp-name">Feature Distribution Monitor</div>
            <div class="comp-desc">KL divergence / KS test compares incoming feature distributions against reference window statistics.</div>
          </div>
        </div>
      </div>
      <div>
        <div class="formula-block" style="margin-left:0;">
          <div class="formula-label">Drift Detection Condition</div>
          <span class="math">H<sub>0</sub>: D(P<sub>ref</sub>, P<sub>new</sub>) &le; &epsilon;</span> (null hypothesis: no drift)<br>
          <span class="math">H<sub>1</sub>: D(P<sub>ref</sub>, P<sub>new</sub>) &gt; &epsilon;</span> (drift detected)<br><br>
          When <span class="math">H<sub>1</sub></span> accepted &rarr; trigger adaptation pipeline.
        </div>
      </div>
    </div>
  </div>

  <div class="phase-group phase-amber">
    <div class="phase-title">4.2 Incremental Model Adaptation</div>
    <div class="hflow">
      <div class="hflow-node">Drift Signal</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Buffer Recent Labeled Data</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Selective Replay</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Fine-Tune TGNN</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">EWC Regularization</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Updated Model</div>
    </div>
    <div class="two-col">
      <div>
        <div class="sub-header">Elastic Weight Consolidation (EWC)</div>
        <div class="detail-item"><strong>Prevents Catastrophic Forgetting:</strong> Computes Fisher Information Matrix <span class="math">F</span> on old data. Adds penalty <span class="math">&lambda; &Sigma;<sub>i</sub> F<sub>i</sub>(&theta;<sub>i</sub> - &theta;<sub>i</sub><sup>*</sup>)<sup>2</sup></span> to loss, constraining important parameters from changing too much.</div>
      </div>
      <div>
        <div class="sub-header">Experience Replay Buffer</div>
        <div class="detail-item"><strong>Maintains Old Knowledge:</strong> Reservoir-sampled buffer of representative past events interleaved with new data during fine-tuning. Buffer size <span class="math">B</span> with FIFO replacement.</div>
      </div>
    </div>
    <div class="feedback-loop">
      <span class="fl-arrow">&circlearrow;</span>
      Continuous Feedback Loop: Detection Accuracy Monitor &rarr; Drift Detection &rarr; Model Update &rarr; Accuracy Re-evaluation &rarr; (repeat)
    </div>
  </div>
</div>

<!-- Arrow -->
<div class="arrow-row">
  <svg width="40" height="28" viewBox="0 0 40 28"><path d="M20 2 L20 20 M14 14 L20 20 L26 14" stroke="#94A3B8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
</div>

<!-- ============================================================ -->
<!-- LAYER 5: ATTACK BACKTRACKING ENGINE (Objective 3) -->
<!-- ============================================================ -->
<div class="arch-layer">
  <div class="layer-tag">Layer 5 &mdash; Attack Backtracking &amp; Path Reconstruction Engine</div>
  <span class="obj-tag obj-3">OBJ 3</span>

  <div class="phase-group phase-teal">
    <div class="phase-title">5.1 Alert-Triggered Backtracking</div>
    <div class="hflow">
      <div class="hflow-node">Detection Alert <span class="math">y&#770;<sub>v</sub>(t)</span></div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Identify Alert Node</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Reverse BFS/DFS</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Temporal Path Scoring</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Attack Chain</div>
    </div>
    <div class="two-col">
      <div>
        <div class="comp-row">
          <div class="comp-box highlight">
            <div class="comp-name">Temporal Subgraph Extraction</div>
            <div class="comp-desc">Extracts the connected temporal subgraph <span class="math">G'<sub>t</sub></span> rooted at the alert node, traversing backward through temporal edges.</div>
          </div>
          <div class="comp-box">
            <div class="comp-name">Attention-Based Path Ranking</div>
            <div class="comp-desc">Uses TGNN attention weights <span class="math">&alpha;<sub>uv</sub></span> to rank edges by contribution to the malicious classification.</div>
          </div>
        </div>
      </div>
      <div>
        <div class="formula-block" style="margin-left:0;">
          <div class="formula-label">Path Significance Score</div>
          <span class="math">S(path) = &Sigma;<sub>e<sub>i</sub>&isin;path</sub> &alpha;<sub>e<sub>i</sub></sub> &middot; P(malicious|e<sub>i</sub>)</span><br>
          <span class="math">&times; temporal_coherence(path)</span><br><br>
          Paths with <span class="math">S(path) &gt; threshold &tau;</span> are included in the reconstructed attack chain.
        </div>
      </div>
    </div>
  </div>

  <div class="phase-group phase-teal">
    <div class="phase-title">5.2 Multi-Step Attack Scenario Reconstruction</div>
    <div class="comp-row">
      <div class="comp-box">
        <div class="comp-name">Initial Compromise Identification</div>
        <div class="comp-desc">Finds the earliest node in the attack chain &mdash; the point of initial entry (e.g., phishing email, exploited vulnerability).</div>
      </div>
      <div class="comp-box">
        <div class="comp-name">Lateral Movement Tracing</div>
        <div class="comp-desc">Traces the attacker's movement across the network: which machines were compromised, what credentials were used, what data was accessed.</div>
      </div>
      <div class="comp-box">
        <div class="comp-name">Impact Assessment</div>
        <div class="comp-desc">Identifies all affected entities (files, credentials, machines) and the blast radius of the attack for IR prioritization.</div>
      </div>
    </div>
    <div class="detail-row">
      <div class="detail-item"><strong>Output Format:</strong> Chronologically ordered attack timeline with entities, actions, timestamps, and confidence scores for each step in the chain.</div>
      <div class="detail-item"><strong>Visualization:</strong> Interactive temporal graph visualization (pyvis/Plotly) highlighting the attack path in red, normal activity in gray.</div>
    </div>
  </div>
</div>

<!-- Arrow -->
<div class="arrow-row">
  <svg width="40" height="28" viewBox="0 0 40 28"><path d="M20 2 L20 20 M14 14 L20 20 L26 14" stroke="#94A3B8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
</div>

<!-- ============================================================ -->
<!-- LAYER 6: TEMPORAL EXPLAINABILITY (Objective 4) -->
<!-- ============================================================ -->
<div class="arch-layer">
  <div class="layer-tag">Layer 6 &mdash; Temporal Explainability via MITRE ATT&amp;CK Mapping</div>
  <span class="obj-tag obj-4">OBJ 4</span>

  <div class="phase-group phase-green">
    <div class="phase-title">6.1 Attention Weight Extraction &amp; Temporal Mapping</div>
    <div class="hflow">
      <div class="hflow-node">TGNN Attention Weights <span class="math">{&alpha;<sub>uv</sub>}</span></div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Top-K Edge Selection</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Temporal Ordering</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Behavioral Pattern Extraction</div>
    </div>
    <div class="detail-row">
      <div class="detail-item"><strong>Attention Aggregation:</strong> Per-edge attention scores are aggregated per entity pair and time window to identify the most influential interactions contributing to the classification.</div>
      <div class="detail-item"><strong>Temporal Pattern:</strong> Extracts <strong>when</strong> (timestamp progression), <strong>how</strong> (action sequence), and <strong>why</strong> (attention-weighted significance) each event contributed.</div>
    </div>
  </div>

  <div class="phase-group phase-green">
    <div class="phase-title">6.2 MITRE ATT&amp;CK Framework Mapping</div>
    <div class="two-col">
      <div>
        <div class="comp-row">
          <div class="comp-box highlight">
            <div class="comp-name">Tactic-Level Mapping</div>
            <div class="comp-desc">Maps detected behavior sequences to MITRE ATT&amp;CK tactics (Initial Access, Execution, Persistence, Privilege Escalation, Lateral Movement, Exfiltration).</div>
          </div>
          <div class="comp-box">
            <div class="comp-name">Technique-Level Mapping</div>
            <div class="comp-desc">Fine-grained mapping to specific techniques (e.g., T1059.001 &mdash; PowerShell, T1003 &mdash; OS Credential Dumping).</div>
          </div>
        </div>
        <div class="detail-item" style="margin-top:8px;"><strong>Mapping Algorithm:</strong> Rule-based + embedding similarity. Each detected action type is matched against the MITRE ATT&amp;CK technique database using action-type taxonomy and behavioral features.</div>
      </div>
      <div>
        <div class="sub-header">Output Annotations</div>
        <div class="comp-row">
          <div class="comp-box">
            <div class="comp-name">Tactic Tag</div>
            <div class="comp-desc"><span class="tag tag-green">TA0001</span> Initial Access</div>
          </div>
          <div class="comp-box">
            <div class="comp-name">Technique Tag</div>
            <div class="comp-desc"><span class="tag tag-amber">T1566.001</span> Spearphishing Attachment</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="phase-group phase-green">
    <div class="phase-title">6.3 LLM-Generated Natural Language Explanation</div>
    <div class="hflow">
      <div class="hflow-node">Attack Path + ATT&amp;CK Mapping</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Structured Prompt Builder</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">LLM (GPT / Local Model)</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node" style="border-color:#10B981; color:#065F46;">Human-Readable Narrative</div>
    </div>
    <div class="two-col">
      <div>
        <div class="sub-header">Prompt Template</div>
        <div class="detail-item">"Given the following temporal attack sequence: [chronological events with timestamps, entities, actions, ATT&amp;CK technique IDs, and attention scores], generate a security analyst report explaining what was detected, when each step occurred, how the attacker progressed, and why each action was classified as malicious."</div>
      </div>
      <div>
        <div class="sub-header">Explanation Dimensions</div>
        <div class="comp-row">
          <div class="comp-box">
            <div class="comp-name"><span class="tag tag-blue">WHAT</span></div>
            <div class="comp-desc">The detected attack type and affected entities.</div>
          </div>
          <div class="comp-box">
            <div class="comp-name"><span class="tag tag-amber">WHEN</span></div>
            <div class="comp-desc">Temporal progression and timeline of the attack.</div>
          </div>
          <div class="comp-box">
            <div class="comp-name"><span class="tag tag-purple">HOW</span></div>
            <div class="comp-desc">Attack techniques used, mapped to ATT&amp;CK.</div>
          </div>
          <div class="comp-box">
            <div class="comp-name"><span class="tag tag-red">WHY</span></div>
            <div class="comp-desc">Model reasoning via attention weight attribution.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ============================================================ -->
<!-- LAYER 7: INFERENCE / DEPLOYMENT -->
<!-- ============================================================ -->
<div class="arrow-row" style="margin-bottom:0;">
  <svg width="40" height="28" viewBox="0 0 40 28"><path d="M20 2 L20 20 M14 14 L20 20 L26 14" stroke="#94A3B8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
</div>

<div class="arch-layer" style="margin-bottom:0;">
  <div class="layer-tag">Layer 7 &mdash; Online Inference &amp; Deployment</div>

  <div class="phase-group phase-teal">
    <div class="phase-title">7.1 Real-Time Event Stream Processing</div>
    <div class="hflow">
      <div class="hflow-node">Live Log Stream</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Event Parser</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Graph Update</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">TGNN Inference</div>
      <div class="hflow-arrow">&rarr;</div>
      <div class="hflow-node">Alert + Explanation</div>
    </div>
    <div class="detail-row">
      <div class="detail-item"><strong>Latency Target:</strong> End-to-end processing &le; 500ms per event from log ingestion to alert generation.</div>
      <div class="detail-item"><strong>API Layer:</strong> FastAPI REST endpoints for event submission, alert querying, and explanation retrieval.</div>
      <div class="detail-item"><strong>Dashboard:</strong> Streamlit + Plotly + pyvis for real-time temporal graph visualization, alert monitoring, and attack path exploration.</div>
    </div>
  </div>
</div>

<!-- ============================================================ -->
<!-- LEGEND -->
<!-- ============================================================ -->
<div class="arch-legend">
  <div class="legend-item"><div class="legend-dot" style="border-color:#3B82F6;background:#EFF6FF;"></div>Data Ingestion (OBJ 1)</div>
  <div class="legend-item"><div class="legend-dot" style="border-color:#06B6D4;background:#ECFEFF;"></div>Graph Construction (OBJ 1)</div>
  <div class="legend-item"><div class="legend-dot" style="border-color:#8B5CF6;background:#F5F3FF;"></div>TGNN Core (OBJ 1)</div>
  <div class="legend-item"><div class="legend-dot" style="border-color:#F59E0B;background:#FFFBEB;"></div>Concept Drift (OBJ 2)</div>
  <div class="legend-item"><div class="legend-dot" style="border-color:#14B8A6;background:#F0FDFA;"></div>Attack Backtracking (OBJ 3)</div>
  <div class="legend-item"><div class="legend-dot" style="border-color:#10B981;background:#ECFDF5;"></div>Explainability (OBJ 4)</div>
  <div class="legend-item"><div class="legend-dot" style="border-color:#94A3B8;background:#F9FAFB;"></div>General / Infrastructure</div>
</div>

</div>
</body>
</html>"""

async def render():
    with open(HTML_PATH, 'w') as f:
        f.write(html_content)
    print(f"HTML written to {HTML_PATH}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={'width': 1500, 'height': 900},
            device_scale_factor=2
        )
        await page.goto(f'file://{HTML_PATH}', wait_until='networkidle')
        await page.wait_for_timeout(2000)

        # Auto-resize to fit content
        root = page.locator('#root')
        bbox = await root.bounding_box()
        if bbox:
            fit_w = max(1500, int(bbox['width'] + 120))
            fit_h = int(bbox['height'] + 120)
            await page.set_viewport_size({'width': fit_w, 'height': fit_h})
            await page.wait_for_timeout(500)

        # Screenshot PNG
        await root.screenshot(path=OUTPUT_PNG)
        print(f"PNG saved: {OUTPUT_PNG}")

        # PDF with proper header and footer
        header_html = '''
        <table style="width:100%; font-size:9px; font-family:Inter,Helvetica,Arial,sans-serif; color:#9CA3AF; padding:0 4px; border-collapse:collapse;">
          <tr>
            <td style="text-align:left; color:#6B7280; font-weight:600; width:50%;">TGDetect &mdash; Heterogeneous Continuous-Time TGNN Architecture</td>
            <td style="text-align:right; color:#9CA3AF; width:50%;">In-Depth Architecture Study</td>
          </tr>
        </table>
        <div style="border-bottom:1px solid #E5E7EB; margin-top:4px;"></div>
        '''
        footer_html = '''
        <div style="border-top:1px solid #E5E7EB; margin-bottom:4px;"></div>
        <table style="width:100%; font-size:9px; font-family:Inter,Helvetica,Arial,sans-serif; color:#9CA3AF; padding:0 4px; border-collapse:collapse;">
          <tr>
            <td style="text-align:left; width:50%;">Poster B16 &nbsp;|&nbsp; Final Year Project</td>
            <td style="text-align:right; width:50%;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></td>
          </tr>
        </table>
        '''
        await page.pdf(
            path=OUTPUT_PDF,
            print_background=True,
            display_header_footer=True,
            header_template=header_html,
            footer_template=footer_html,
            margin={'top': '56px', 'bottom': '52px', 'left': '46px', 'right': '46px'},
            format='Letter'
        )
        print(f"PDF saved: {OUTPUT_PDF}")

        await browser.close()

asyncio.run(render())
