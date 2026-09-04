'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { NODE_TYPE_META } from '@/lib/tgdetect/constants';
import { colorHex } from '@/lib/tgdetect/constants';
import { relationIsAttack, shortNodeId } from '@/lib/tgdetect/formatters';
import type { GraphEdge, GraphNode, NodeType } from '@/lib/tgdetect/types';
import type { ChainSubgraph } from '@/lib/tgdetect/types';

// ─────────────────────────────────────────────────────────────────────────────
// useIsDarkMode — subscribe to <html> class changes without setState-in-effect
// ─────────────────────────────────────────────────────────────────────────────

function subscribeDarkMode(cb: () => void): () => void {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
}

function getDarkSnapshot(): boolean {
  return typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : false;
}

function getDarkServerSnapshot(): boolean {
  return false;
}

function useIsDarkMode(): boolean {
  return useSyncExternalStore(subscribeDarkMode, getDarkSnapshot, getDarkServerSnapshot);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal node / edge representations with computed physics state
// ─────────────────────────────────────────────────────────────────────────────

interface VisNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Pre-computed severity 0..1 for color saturation. */
  severity: number;
  /** Outgoing + incoming edges count. */
  degree: number;
}

interface VisEdge {
  src: string;
  dst: string;
  relation: string;
  label: number; // 0/1
  ts: number;
}

export interface GraphSelection {
  nodeId?: string;
  edgeId?: string;
}

interface TemporalGraphVizProps {
  nodes: GraphNode[] | ChainSubgraph['nodes'];
  edges: GraphEdge[] | ChainSubgraph['edges'];
  /** Highlight all events from this chain. */
  highlightChainId?: string | null;
  /** Selected node id (external control). */
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string | null) => void;
  /** Show edge labels (relation names) — toggled by user. */
  showEdgeLabels?: boolean;
  /** When true, dim benign edges to emphasize malicious. */
  maliciousOnly?: boolean;
  /** Max nodes to render (sampling). Default 300. */
  maxNodes?: number;
  /** Optional class. */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — build vis graph from any of the 3 input shapes
// ─────────────────────────────────────────────────────────────────────────────

function toVisNodes(
  nodes: GraphNode[] | ChainSubgraph['nodes'],
  maxNodes: number,
): Map<string, VisNode> {
  const arr = Array.isArray(nodes) ? nodes : [];
  // Sample if too many
  const sample = arr.length > maxNodes ? arr.slice(0, maxNodes) : arr;
  const out = new Map<string, VisNode>();
  for (let i = 0; i < sample.length; i++) {
    const n = sample[i];
    const id = 'node_id' in n ? n.node_id : n.id;
    const type = ('node_type' in n ? (n as { node_type: NodeType }).node_type : 'UNKNOWN') as NodeType;
    const degree = 'out_degree' in n ? n.out_degree + n.in_degree : 1;
    const malCount = 'malicious_events' in n ? n.malicious_events : 0;
    const total = 'out_degree' in n ? n.out_degree + n.in_degree : 1;
    const severity = total > 0 ? Math.min(1, malCount / total) : 0;
    // Deterministic initial placement around a circle
    const angle = (i / Math.max(sample.length, 1)) * Math.PI * 2;
    out.set(id, {
      id,
      type,
      x: 400 + 200 * Math.cos(angle),
      y: 300 + 200 * Math.sin(angle),
      vx: 0,
      vy: 0,
      radius: 6 + Math.min(10, Math.sqrt(degree) * 1.5),
      severity,
      degree,
    });
  }
  return out;
}

function toVisEdges(
  edges: GraphEdge[] | ChainSubgraph['edges'],
  nodeMap: Map<string, VisNode>,
): VisEdge[] {
  const out: VisEdge[] = [];
  for (const e of edges) {
    const srcId = e.src_id;
    const dstId = e.dst_id;
    if (!nodeMap.has(srcId) || !nodeMap.has(dstId)) continue;
    out.push({
      src: srcId,
      dst: dstId,
      relation: e.relation,
      label: e.label,
      ts: e.ts,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function TemporalGraphViz({
  nodes,
  edges,
  highlightChainId,
  selectedNodeId,
  onSelectNode,
  showEdgeLabels = false,
  maliciousOnly = false,
  maxNodes = 300,
  className,
}: TemporalGraphVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ x: number; y: number; mode: 'pan' | 'node'; nodeId?: string } | null>(null);

  // Build vis graph
  const vis = useMemo(() => {
    const nodeMap = toVisNodes(nodes, maxNodes);
    const edgeArr = toVisEdges(edges, nodeMap);
    return { nodeMap, edgeArr };
  }, [nodes, edges, maxNodes]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Detect dark mode reactively via useSyncExternalStore (no setState in effect).
  const isDark = useIsDarkMode();

  // Force simulation tick
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { nodeMap, edgeArr } = vis;
      // Repulsion (Coulomb-ish)
      const arr = Array.from(nodeMap.values());
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist2 = Math.max(50, dx * dx + dy * dy);
          const force = 600 / dist2;
          const dist = Math.sqrt(dist2);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }
      // Attraction (springs) along edges
      for (const e of edgeArr) {
        const a = nodeMap.get(e.src);
        const b = nodeMap.get(e.dst);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const target = 90;
        const force = (dist - target) * 0.01;
        const fx = (dx / (dist || 1)) * force;
        const fy = (dy / (dist || 1)) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      // Centering + damping
      const cx = size.w / 2;
      const cy = size.h / 2;
      for (const n of arr) {
        n.vx += (cx - n.x) * 0.005;
        n.vy += (cy - n.y) * 0.005;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vis, size]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const { nodeMap, edgeArr } = vis;
    const selected = selectedNodeId ?? null;
    const highlightSet = new Set<string>();
    // Highlight nodes that participate in malicious edges or chain edges.
    if (highlightChainId && Array.isArray(edges)) {
      for (const e of edges) {
        if ('chain_id' in e && e.chain_id === highlightChainId) {
          highlightSet.add(e.src_id);
          highlightSet.add(e.dst_id);
        }
      }
    }

    // Draw edges
    for (const e of edgeArr) {
      const a = nodeMap.get(e.src);
      const b = nodeMap.get(e.dst);
      if (!a || !b) continue;
      const isMalicious = e.label === 1;
      if (maliciousOnly && !isMalicious) continue;
      const isAttack = relationIsAttack(e.relation);
      const isHighlighted = highlightSet.has(e.src) && highlightSet.has(e.dst);
      let strokeColor = isDark ? '#3a4a5f' : '#cbd5e1';
      let strokeWidth = 1;
      if (isMalicious) {
        strokeColor = colorHex('red', isDark);
        strokeWidth = isAttack ? 2 : 1.5;
      }
      if (isHighlighted) {
        strokeColor = colorHex('teal', isDark);
        strokeWidth = 2.5;
      }
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = isHighlighted ? 1 : (isMalicious ? 0.85 : 0.45);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const ax = b.x - Math.cos(angle) * (b.radius + 4);
      const ay = b.y - Math.sin(angle) * (b.radius + 4);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(
        ax - Math.cos(angle - Math.PI / 6) * 6,
        ay - Math.sin(angle - Math.PI / 6) * 6,
      );
      ctx.lineTo(
        ax - Math.cos(angle + Math.PI / 6) * 6,
        ay - Math.sin(angle + Math.PI / 6) * 6,
      );
      ctx.closePath();
      ctx.fillStyle = strokeColor;
      ctx.fill();
      // Edge label
      if (showEdgeLabels) {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillStyle = isDark ? '#7d95ae' : '#667085';
        ctx.textAlign = 'center';
        ctx.fillText(e.relation, midX, midY - 4);
      }
      ctx.restore();
    }

    // Draw nodes
    for (const n of nodeMap.values()) {
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      const meta = NODE_TYPE_META[n.type];
      const baseColor = colorHex(meta.color, isDark);
      const isSelected = n.id === selected;
      const isHovered = n.id === hovered;
      const isHighlighted = highlightSet.has(n.id);
      // Stroke ring for selection/hover
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = colorHex('cyan', isDark);
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = isDark ? '#7d95ae' : '#667085';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // Node fill — blend base color with red if malicious
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      let fillColor = baseColor;
      if (n.severity > 0) {
        // Mix with red proportional to severity
        fillColor = mixColors(baseColor, colorHex('red', isDark), n.severity);
      }
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = isHighlighted ? 1 : 0.9;
      ctx.fill();
      ctx.strokeStyle = isDark ? '#0c1929' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      ctx.stroke();
      // Label on hover/selected
      if (isSelected || isHovered) {
        ctx.font = '11px ui-monospace, monospace';
        const label = shortNodeId(n.id);
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = isDark ? 'rgba(7,21,37,0.95)' : 'rgba(255,255,255,0.95)';
        ctx.fillRect(n.x + 8, n.y - 6, textWidth + 8, 14);
        ctx.fillStyle = isDark ? '#d8e5f2' : '#0f1b2d';
        ctx.textAlign = 'left';
        ctx.fillText(label, n.x + 12, n.y + 4);
      }
      ctx.restore();
    }
  }, [vis, size, isDark, selectedNodeId, hovered, pan, zoom, showEdgeLabels, maliciousOnly, highlightChainId]);

  // Mouse handlers
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Convert to graph coords
    const wx = (mx - pan.x) / zoom;
    const wy = (my - pan.y) / zoom;
    if (dragRef.current?.mode === 'pan') {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      dragRef.current.x = e.clientX;
      dragRef.current.y = e.clientY;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }
    if (dragRef.current?.mode === 'node' && dragRef.current.nodeId) {
      const n = vis.nodeMap.get(dragRef.current.nodeId);
      if (n) {
        n.x = wx;
        n.y = wy;
        n.vx = 0;
        n.vy = 0;
      }
      return;
    }
    // Hover detection
    let hover: string | null = null;
    for (const n of vis.nodeMap.values()) {
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) {
        hover = n.id;
        break;
      }
    }
    if (hover !== hovered) setHovered(hover);
  }, [pan, zoom, vis, hovered]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - pan.x) / zoom;
    const wy = (my - pan.y) / zoom;
    // Find node under cursor
    let found: string | null = null;
    for (const n of vis.nodeMap.values()) {
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) {
        found = n.id;
        break;
      }
    }
    if (found) {
      dragRef.current = { x: e.clientX, y: e.clientY, mode: 'node', nodeId: found };
    } else {
      dragRef.current = { x: e.clientX, y: e.clientY, mode: 'pan' };
    }
  }, [pan, zoom, vis]);

  const onMouseUp = useCallback(() => {
    if (dragRef.current?.mode === 'node' && dragRef.current.nodeId) {
      onSelectNode?.(dragRef.current.nodeId);
    }
    dragRef.current = null;
  }, [onSelectNode]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    const delta = -e.deltaY * 0.001;
    setZoom((z) => Math.max(0.2, Math.min(3, z + delta)));
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-[hsl(var(--background))] overflow-hidden ${className ?? ''}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { dragRef.current = null; setHovered(null); }}
        onWheel={onWheel}
      />
      {/* Hover tooltip */}
      {hovered && (() => {
        const n = vis.nodeMap.get(hovered);
        if (!n) return null;
        const meta = NODE_TYPE_META[n.type];
        return (
          <div className="absolute top-2 left-2 px-2 py-1 rounded text-[10px] font-mono bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg pointer-events-none z-10">
            <div className="text-[hsl(var(--foreground))]">{meta.label}</div>
            <div className="text-[hsl(var(--muted-foreground))]">{shortNodeId(n.id)}</div>
            <div className="text-[hsl(var(--muted-foreground))]">deg={n.degree}</div>
          </div>
        );
      })()}
      {/* Zoom controls */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          className="size-6 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] text-xs"
        >+</button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}
          className="size-6 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] text-xs"
        >−</button>
        <button
          type="button"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="size-6 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] text-[9px] font-mono"
        >0</button>
      </div>
      {/* Selected node detail chip */}
      {selectedNodeId && vis.nodeMap.has(selectedNodeId) && (() => {
        const n = vis.nodeMap.get(selectedNodeId)!;
        const meta = NODE_TYPE_META[n.type];
        return (
          <div className="absolute top-2 right-2 px-2 py-1.5 rounded bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg z-10 text-[10px] font-mono">
            <div className="text-[hsl(var(--foreground))] font-semibold">{meta.label} · {shortNodeId(n.id)}</div>
            <div className="text-[hsl(var(--muted-foreground))]">type: {n.type} · deg: {n.degree} · sev: {n.severity.toFixed(2)}</div>
            <button
              type="button"
              onClick={() => onSelectNode?.(null)}
              className="mt-1 text-[9px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >clear ✕</button>
          </div>
        );
      })()}
    </div>
  );
}

// Color mixer — blend two hex colors by amount 0..1 (1 = full target).
function mixColors(a: string, b: string, t: number): string {
  const ra = parseInt(a.slice(1, 3), 16);
  const ga = parseInt(a.slice(3, 5), 16);
  const ba = parseInt(a.slice(5, 7), 16);
  const rb = parseInt(b.slice(1, 3), 16);
  const gb = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ra + (rb - ra) * t);
  const g = Math.round(ga + (gb - ga) * t);
  const bl = Math.round(ba + (bb - ba) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}
