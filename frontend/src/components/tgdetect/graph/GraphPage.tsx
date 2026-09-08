'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Filter, Maximize2, Search } from 'lucide-react';
import { useGraphEdges, useGraphNodes, useGraphStats } from '@/lib/tgdetect/services/hooks';
import { useDataset } from '@/lib/dataset-context';
import { formatInt, shortNodeId } from '@/lib/tgdetect/formatters';
import type { NodeType, RelationType } from '@/lib/tgdetect/types';
import { NODE_TYPES, RELATION_TYPES } from '@/lib/tgdetect/constants';
import {
  EmptyState,
  ErrorState,
  LabelPill,
  LoadingState,
  MonoId,
  NodeTypePill,
  RelationPill,
  SectionTitle,
} from '../shared/pills';
import { NodeLegend, RelationLegend } from '../shared/legends';
import { TemporalGraphViz } from '../shared/temporal-graph-viz';
import { useNodeEvents } from '@/lib/tgdetect/services/hooks';
import { formatEpochTime } from '@/lib/tgdetect/formatters';

export function GraphPage({ onNavigate }: { onNavigate?: (page: string, ctx?: Record<string, unknown>) => void }) {
  const { activeDataset, activeDatasetId } = useDataset();
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [maliciousOnly, setMaliciousOnly] = useState(false);
  const statsRes = useGraphStats();
  const nodesRes = useGraphNodes(1000, maliciousOnly);
  const edgesRes = useGraphEdges(2000, maliciousOnly);
  const [activeNodeTypes, setActiveNodeTypes] = useState<Set<NodeType>>(new Set(NODE_TYPES));
  const [activeRelations, setActiveRelations] = useState<Set<RelationType>>(new Set(RELATION_TYPES));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState('');

  const filteredNodes = useMemo(() => {
    if (!nodesRes.data) return [];
    return nodesRes.data.filter((n) => activeNodeTypes.has(n.node_type));
  }, [nodesRes.data, activeNodeTypes]);

  const filteredEdges = useMemo(() => {
    if (!edgesRes.data) return [];
    return edgesRes.data.filter((e) => {
      if (!activeRelations.has(e.relation as RelationType)) return false;
      if (maliciousOnly && e.label !== 1) return false;
      return true;
    });
  }, [edgesRes.data, activeRelations, maliciousOnly]);

  const nodeTypeCounts = useMemo(() => {
    if (statsRes.data?.graph?.node_types && Object.keys(statsRes.data.graph.node_types).length > 0) {
      return statsRes.data.graph.node_types;
    }
    const c: Partial<Record<NodeType, number>> = {};
    for (const n of nodesRes.data ?? []) c[n.node_type] = (c[n.node_type] ?? 0) + 1;
    return c;
  }, [statsRes.data, nodesRes.data]);

  const relationCounts = useMemo(() => {
    if (statsRes.data?.graph?.relation_types && Object.keys(statsRes.data.graph.relation_types).length > 0) {
      return statsRes.data.graph.relation_types;
    }
    const c: Partial<Record<RelationType, number>> = {};
    for (const e of edgesRes.data ?? []) {
      if (e.relation in RELATION_TYPES) c[e.relation as RelationType] = (c[e.relation as RelationType] ?? 0) + 1;
    }
    return c;
  }, [statsRes.data, edgesRes.data]);

  if (nodesRes.state === 'loading' || edgesRes.state === 'loading') {
    return <LoadingState label="Loading graph…" />;
  }
  if (nodesRes.state === 'failed') return <ErrorState message={`Failed: ${nodesRes.error}`} />;

  return (
    <div className="space-y-3">
      {/* Top controls */}
      <div className="tg-card p-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${activeDataset?.provenance === "benchmark" ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`} />
            <SectionTitle className="inline">Temporal Heterogeneous Graph</SectionTitle>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--primary))] font-semibold">
              {activeDataset?.name ?? activeDatasetId ?? 'ACTIVE DATASET'}
            </span>
          </div>
          <div className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono mt-0.5">
            PROVENANCE: {activeDataset?.provenance === 'benchmark' ? 'REFERENCE EVALUATION BENCHMARK' : 'LIVE UPLOADED TELEMETRY'} · PARTITION: {activeDatasetId ?? 'default'}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-[hsl(var(--muted-foreground))] font-mono">
            {formatInt(filteredNodes.length)} visual / {formatInt(statsRes.data?.graph?.total_nodes ?? nodesRes.data?.length ?? 0)} nodes · {formatInt(filteredEdges.length)} visual / {formatInt(statsRes.data?.graph?.total_edges ?? edgesRes.data?.length ?? 0)} edges
          </span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setShowEdgeLabels((v) => !v)}
            className={`px-2 py-1 text-[10px] font-mono border rounded flex items-center gap-1 ${
              showEdgeLabels ? 'bg-[hsl(var(--info-bg))] text-[hsl(var(--info))] border-[hsl(var(--info)/0.4)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
            }`}
          >
            {showEdgeLabels ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
            edge labels
          </button>
          <button
            type="button"
            onClick={() => setMaliciousOnly((v) => !v)}
            className={`px-2 py-1 text-[10px] font-mono border rounded ${
              maliciousOnly ? 'bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger))] border-[hsl(var(--danger)/0.4)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
            }`}
          >
            malicious only
          </button>
        </div>
      </div>

      {/* Filters + canvas + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Left rail: filters */}
        <div className="lg:col-span-1 space-y-3">
          <div className="tg-card p-3">
            <SectionTitle right={<Filter className="size-3 text-[hsl(var(--muted-foreground))]" />}>Filters</SectionTitle>
            <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1.5 mt-2">Node types</div>
            <NodeLegend
              counts={nodeTypeCounts}
              active={activeNodeTypes}
              onToggle={(t) => {
                const s = new Set(activeNodeTypes);
                if (s.has(t)) s.delete(t); else s.add(t);
                setActiveNodeTypes(s);
              }}
            />
            <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1.5 mt-3">Relations</div>
            <RelationLegend
              counts={relationCounts}
              active={activeRelations}
              onToggle={(r) => {
                const s = new Set(activeRelations);
                if (s.has(r)) s.delete(r); else s.add(r);
                setActiveRelations(s);
              }}
            />
            <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1.5 mt-3">Node search</div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-[hsl(var(--muted-foreground))]" />
              <input
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                placeholder="node_id substring…"
                className="w-full pl-7 pr-2 py-1 text-xs bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded font-mono"
              />
            </div>
          </div>
          <NodeInspectorPanel nodeId={selectedNodeId} nodes={nodesRes.data ?? []} onNavigate={onNavigate} />
        </div>

        {/* Canvas - Star of Platform */}
        <div className="lg:col-span-3 space-y-2">
          <div className="tg-panel hud-bracket p-0 overflow-hidden h-[74vh] relative border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg">
            {/* Tactical HUD Header Bar */}
            <div className="absolute top-0 inset-x-0 z-10 px-3.5 py-2 bg-[hsl(var(--card)/0.92)] backdrop-blur-md border-b border-[hsl(var(--border))] flex items-center justify-between gap-2 text-[10px] font-mono pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <span className={`size-1.5 rounded-full ${activeDataset?.provenance === "benchmark" ? "bg-amber-400" : "bg-[hsl(var(--primary))] animate-pulse"}`} />
                <span className="font-bold tracking-wider text-[hsl(var(--primary))]">
                  SYS://TEMPORAL_GRAPH // {(activeDataset?.name ?? activeDatasetId ?? 'TOPOLOGY').toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))]">
                <span>NODES: <strong className="text-[hsl(var(--foreground))]">{filteredNodes.length}</strong></span>
                <span>•</span>
                <span>EDGES: <strong className="text-[hsl(var(--foreground))]">{filteredEdges.length}</strong></span>
                <span>•</span>
                <span>MALICIOUS: <strong className={filteredEdges.filter(e => e.label === 1).length > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{filteredEdges.filter(e => e.label === 1).length}</strong></span>
              </div>
            </div>

            {(nodesRes.data?.length ?? 0) === 0 || (edgesRes.data?.length ?? 0) === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[hsl(var(--background)/0.5)]">
                <div className="size-12 rounded-lg border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-3">
                  <Maximize2 className="size-6" />
                </div>
                <div className="text-sm font-bold font-mono tracking-wider text-[hsl(var(--foreground))]">NO GRAPH TOPOLOGY AVAILABLE</div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-md mt-1 mb-4 font-mono leading-relaxed">
                  The active dataset &quot;{activeDataset?.name ?? activeDatasetId}&quot; has zero graph relationships produced or has not been processed into temporal graph artifacts.
                </p>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('datasets')}
                    className="px-3 py-1.5 text-xs font-mono font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded hover:opacity-90 transition-opacity shadow-sm"
                  >
                    Open Datasets &amp; Ingestion Pipeline →
                  </button>
                )}
              </div>
            ) : filteredNodes.length === 0 || filteredEdges.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[hsl(var(--background)/0.5)]">
                <Filter className="size-8 text-[hsl(var(--muted-foreground))] mb-2 opacity-60" />
                <div className="text-sm font-bold font-mono tracking-wider text-[hsl(var(--foreground))]">FILTER RESTRICTION ACTIVE</div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-md mt-1 mb-3 font-mono">
                  0 of {nodesRes.data?.length ?? 0} nodes match current filter criteria.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNodeTypes(new Set(NODE_TYPES));
                    setActiveRelations(new Set(RELATION_TYPES));
                    setMaliciousOnly(false);
                  }}
                  className="px-3 py-1 text-xs font-mono border border-[hsl(var(--border))] rounded bg-[hsl(var(--card))] hover:bg-[hsl(var(--card-hover))]"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <TemporalGraphViz
                nodes={filteredNodes}
                edges={filteredEdges}
                selectedNodeId={selectedNodeId ?? undefined}
                onSelectNode={(id) => setSelectedNodeId(id)}
                showEdgeLabels={showEdgeLabels}
                maliciousOnly={maliciousOnly}
                maxNodes={300}
              />
            )}

            {/* Tactical HUD Footer Overlay */}
            <div className="absolute bottom-2 left-3 z-10 pointer-events-none">
              <div className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--card)/0.88)] backdrop-blur-xs px-2.5 py-1 rounded border border-[hsl(var(--border))]">
                PAN: DRAG · ZOOM: SCROLL · SELECT: CLICK NODE
              </div>
            </div>
          </div>
          <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] flex items-center justify-between px-1">
            <span>Force-directed physics simulation · Flow attributes mapped to node radius & edge weights</span>
            <span className="text-cyan-400/80">Directed Graph Architecture</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Node inspector panel
// ─────────────────────────────────────────────────────────────────────────────

function NodeInspectorPanel({
  nodeId,
  nodes,
  onNavigate,
}: {
  nodeId: string | null;
  nodes: any[];
  onNavigate?: (page: string, ctx?: Record<string, unknown>) => void;
}) {
  const eventsRes = useNodeEvents(nodeId);
  if (!nodeId) {
    return (
      <div className="tg-card p-3">
        <SectionTitle>Node Inspector</SectionTitle>
        <EmptyState
          title="No node selected"
          description="Click a node in the canvas to inspect its metadata and related events."
        />
      </div>
    );
  }
  const node = nodes.find((n) => n.node_id === nodeId);
  return (
    <div className="tg-card p-3 space-y-2">
      <SectionTitle>Node Inspector</SectionTitle>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold">node_id</div>
        <div className="mono text-xs break-all">{nodeId}</div>
      </div>
      {node && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type"><NodeTypePill type={node.node_type} /></Field>
            <Field label="Severity">{(((node.malicious_events ?? 0) / Math.max(1, (node.in_degree ?? 0) + (node.out_degree ?? 0)))).toFixed(2)}</Field>
            <Field label="Out degree"><span className="mono text-xs">{node.out_degree}</span></Field>
            <Field label="In degree"><span className="mono text-xs">{node.in_degree}</span></Field>
            <Field label="Malicious events"><span className="mono text-xs text-[hsl(var(--danger))]">{node.malicious_events}</span></Field>
            <Field label="First seen"><span className="mono text-[10px]">{formatEpochTime(node.first_seen_ts)}</span></Field>
            <Field label="Last seen"><span className="mono text-[10px]">{formatEpochTime(node.last_seen_ts)}</span></Field>
          </div>
        </>
      )}
      <div className="border-t border-[hsl(var(--border))] pt-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold">
            Related events ({eventsRes.data?.length ?? 0})
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('events', { nodeId })}
            className="text-[10px] text-[hsl(var(--primary))] hover:underline"
          >open in events →</button>
        </div>
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {eventsRes.state === 'loading' && <LoadingState label="Loading…" />}
          {(eventsRes.data ?? []).slice(0, 10).map((e) => (
            <button
              key={e.event_id}
              type="button"
              onClick={() => onNavigate?.('events', { eventId: e.event_id })}
              className="block w-full text-left text-[10px] mono px-1.5 py-0.5 hover:bg-[hsl(var(--card-hover))] rounded"
            >
              <div className="flex items-center gap-1">
                <span className="text-[hsl(var(--muted-foreground))]">{formatEpochTime(e.ts)}</span>
                <RelationPill relation={e.relation} />
                <LabelPill label={e.label} />
              </div>
              <div className="text-[hsl(var(--muted-foreground))] truncate">
                {e.src_id} → {e.dst_id}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[9px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold">{label}</div>
      <div>{children}</div>
    </div>
  );
}
