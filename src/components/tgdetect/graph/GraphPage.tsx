'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Filter, Maximize2, Search } from 'lucide-react';
import { useGraphEdges, useGraphNodes } from '@/lib/tgdetect/services/hooks';
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
  const nodesRes = useGraphNodes();
  const edgesRes = useGraphEdges();
  const [activeNodeTypes, setActiveNodeTypes] = useState<Set<NodeType>>(new Set(NODE_TYPES));
  const [activeRelations, setActiveRelations] = useState<Set<RelationType>>(new Set(RELATION_TYPES));
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [maliciousOnly, setMaliciousOnly] = useState(false);
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
    const c: Partial<Record<NodeType, number>> = {};
    for (const n of nodesRes.data ?? []) c[n.node_type] = (c[n.node_type] ?? 0) + 1;
    return c;
  }, [nodesRes.data]);

  const relationCounts = useMemo(() => {
    const c: Partial<Record<RelationType, number>> = {};
    for (const e of edgesRes.data ?? []) {
      if (e.relation in RELATION_TYPES) c[e.relation as RelationType] = (c[e.relation as RelationType] ?? 0) + 1;
    }
    return c;
  }, [edgesRes.data]);

  if (nodesRes.state === 'loading' || edgesRes.state === 'loading') {
    return <LoadingState label="Loading graph…" />;
  }
  if (nodesRes.state === 'failed') return <ErrorState message={`Failed: ${nodesRes.error}`} />;

  return (
    <div className="space-y-3">
      {/* Top controls */}
      <div className="tg-card p-3 flex flex-wrap items-center gap-3">
        <SectionTitle className="flex-1">Temporal Heterogeneous Graph</SectionTitle>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-[hsl(var(--muted-foreground))]">
            {formatInt(filteredNodes.length)} / {formatInt(nodesRes.data?.length ?? 0)} nodes · {formatInt(filteredEdges.length)} / {formatInt(edgesRes.data?.length ?? 0)} edges
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
          <NodeInspectorPanel nodeId={selectedNodeId} onNavigate={onNavigate} />
        </div>

        {/* Canvas */}
        <div className="lg:col-span-3">
          <div className="tg-card p-0 overflow-hidden h-[70vh] relative">
            {filteredNodes.length === 0 || filteredEdges.length === 0 ? (
              <EmptyState
                title="No graph data"
                description="Adjust filters to see graph elements."
                icon={Maximize2}
              />
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
          </div>
          <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 px-1">
            Drag to pan · scroll to zoom · click node to inspect · node fill blends base color with red by malicious ratio · directed edges shown with arrowheads
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
  onNavigate,
}: {
  nodeId: string | null;
  onNavigate?: (page: string, ctx?: Record<string, unknown>) => void;
}) {
  const nodesRes = useGraphNodes();
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
  const node = nodesRes.data?.find((n) => n.node_id === nodeId);
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
            <Field label="Severity">{(node.malicious_events / Math.max(1, node.in_degree + node.out_degree)).toFixed(2)}</Field>
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
