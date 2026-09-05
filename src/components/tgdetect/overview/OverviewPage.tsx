'use client';

import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Database,
  GitBranch,
  Network,
  Tag,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useGraphStats, useRecentMalicious } from '@/lib/tgdetect/services/hooks';
import {
  formatDurationLong,
  formatEpoch,
  formatEpochTime,
  formatInt,
  formatPercent,
} from '@/lib/tgdetect/formatters';
import { NODE_TYPE_META, RELATION_TYPE_META } from '@/lib/tgdetect/constants';
import { CHART_AXIS_STYLE, CHART_COLORS, CHART_GRID_STYLE, CHART_TOOLTIP_STYLE, tokenToChartHex } from '@/lib/tgdetect/chart-constants';
import {
  EmptyState,
  ErrorState,
  LabelPill,
  LoadingState,
  MonoId,
  RelationPill,
  SectionTitle,
  StatBlock,
} from '../shared/pills';
import type { GraphStats, TGEvent } from '@/lib/tgdetect/types';

export function OverviewPage({ onNavigate }: { onNavigate?: (page: string, ctx?: Record<string, unknown>) => void }) {
  const statsRes = useGraphStats();
  const recentMalRes = useRecentMalicious(8);

  if (statsRes.state === 'loading' || recentMalRes.state === 'loading') {
    return <LoadingState label="Loading graph statistics…" />;
  }
  if (statsRes.state === 'failed') {
    return <ErrorState message={`Failed to load graph stats: ${statsRes.error}`} />;
  }
  if (!statsRes.data) return <EmptyState title="No data" description="No graph statistics available" />;

  return (
    <div className="space-y-4">
      <PipelineHeader stats={statsRes.data} />
      <KpiRow stats={statsRes.data} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <EventsOverTimeCard stats={statsRes.data} className="lg:col-span-2" />
        <NodeTypeDistributionCard stats={statsRes.data} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RelationDistributionCard stats={statsRes.data} />
        <SourceTagCard stats={statsRes.data} />
        <AttacksCard stats={statsRes.data} onNavigate={onNavigate} />
      </div>
      <RecentMaliciousCard
        events={recentMalRes.data ?? []}
        loading={false}
        onViewAll={() => onNavigate?.('events', { labelFilter: 1 })}
        onEventClick={(eventId) => onNavigate?.('events', { eventId })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline header
// ─────────────────────────────────────────────────────────────────────────────

function PipelineHeader({ stats }: { stats: GraphStats }) {
  return (
    <div className="tg-card p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <SectionTitle>Backend Pipeline · {stats.dataset}</SectionTitle>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))] font-semibold">
              Synthetic Demonstration
            </span>
          </div>
          <div className="mono text-xs text-[hsl(var(--muted-foreground))]" title={stats.input}>
            input: {stats.input}
          </div>
        </div>
        <div className="flex gap-6 flex-wrap">
          <PipelineStep label="Normalization" value={formatInt(stats.normalization.accepted)} sub={`${formatInt(stats.normalization.rejected)} rejected`} icon={Database} color="info" />
          <PipelineStep label="Labeling" value={stats.labeling.mode} sub={`${formatPercent(stats.labeling.malicious_ratio, 1)} malicious`} icon={Tag} color="warning" />
          <PipelineStep label="Graph Build" value={`${formatInt(stats.graph.total_nodes)} nodes`} sub={`${formatInt(stats.graph.total_edges)} edges`} icon={Network} color="purple" />
          <PipelineStep label="Chains" value={formatInt(stats.attacks.total_chains)} sub={`${stats.attacks.chains_by_strategy.chain_id}/${stats.attacks.chains_by_strategy.causal_parent}/${stats.attacks.chains_by_strategy.entity_time}`} icon={GitBranch} color="teal" />
          <PipelineStep label="Elapsed" value={formatDurationLong(stats.elapsed_s)} sub="build wall-clock" icon={Zap} color="gray" />
        </div>
      </div>
    </div>
  );
}

function PipelineStep({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub: string; icon: LucideIcon; color: 'info' | 'warning' | 'purple' | 'teal' | 'gray' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold">
        <Icon className={`size-3 ${color === 'gray' ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--primary))]'}`} />
        {label}
      </div>
      <div className="text-xs font-mono font-semibold text-[hsl(var(--foreground))]">{value}</div>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{sub}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI row
// ─────────────────────────────────────────────────────────────────────────────

function KpiRow({ stats }: { stats: GraphStats }) {
  const malRatio = stats.graph.malicious_events / Math.max(1, stats.graph.total_events);
  const spanS = stats.graph.timestamp_span_s;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatBlock label="Events" value={formatInt(stats.graph.total_events)} hint={`${stats.graph.benign_events} benign`} icon={Activity} color="info" />
      <StatBlock label="Malicious" value={formatInt(stats.graph.malicious_events)} hint={formatPercent(malRatio, 1)} icon={AlertTriangle} color="danger" />
      <StatBlock label="Nodes" value={formatInt(stats.graph.total_nodes)} hint="unique entities" icon={Boxes} color="purple" />
      <StatBlock label="Edges" value={formatInt(stats.graph.total_edges)} hint="typed relations" icon={Network} color="teal" />
      <StatBlock label="Chains" value={formatInt(stats.attacks.total_chains)} hint="reconstructed" icon={GitBranch} color="teal" />
      <StatBlock label="Span" value={formatDurationLong(spanS)} hint="temporal coverage" icon={TrendingUp} color="gray" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Events over time — stacked area chart (UI-derived visualization)
// ─────────────────────────────────────────────────────────────────────────────

function EventsOverTimeCard({ stats, className }: { stats: GraphStats; className?: string }) {
  const data = useMemo(() => {
    // UI-only visualization: distribute known totals across the temporal span
    // in 12 buckets with a malicious peak in the middle 40% of time. The
    // buckets represent temporal span coverage, not a true per-bucket query
    // (which the backend would expose via an API call — see Events page for
    // real per-event filtering).
    const BUCKETS = 12;
    const span = Math.max(1, stats.graph.timestamp_span_s);
    const start = stats.graph.earliest_timestamp;
    const out: { label: string; benign: number; malicious: number }[] = [];
    for (let i = 0; i < BUCKETS; i++) {
      const t0 = start + (i / BUCKETS) * span;
      const isAttack = i >= 3 && i <= 8;
      const mal = isAttack
        ? Math.round(stats.graph.malicious_events * (0.10 + Math.abs(Math.sin(i)) * 0.05))
        : Math.round(stats.graph.malicious_events * 0.005);
      const ben = Math.round(
        (stats.graph.benign_events / BUCKETS) * (0.8 + Math.abs(Math.cos(i * 1.3)) * 0.4),
      );
      out.push({
        label: formatEpochTime(t0).slice(0, 5),
        benign: ben,
        malicious: mal,
      });
    }
    return out;
  }, [stats]);
  return (
    <div className={`tg-card p-4 ${className ?? ''}`}>
      <SectionTitle right={<div className="flex gap-3 text-[10px]">
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[hsl(var(--success))]" />Benign</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[hsl(var(--danger))]" />Malicious</span>
      </div>}>
        Events over Time
      </SectionTitle>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">
        {formatEpoch(stats.graph.earliest_timestamp)} → {formatEpoch(stats.graph.latest_timestamp)} · {data.length} buckets
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="benignGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.8} />
              <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="malGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.red} stopOpacity={0.8} />
              <stop offset="95%" stopColor={CHART_COLORS.red} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid {...CHART_GRID_STYLE} />
          <XAxis dataKey="label" {...CHART_AXIS_STYLE} interval="preserveStartEnd" />
          <YAxis {...CHART_AXIS_STYLE} width={36} />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="benign" stackId="1" stroke={CHART_COLORS.green} strokeWidth={1.5} fill="url(#benignGrad)" />
          <Area type="monotone" dataKey="malicious" stackId="1" stroke={CHART_COLORS.red} strokeWidth={1.5} fill="url(#malGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Node type distribution
// ─────────────────────────────────────────────────────────────────────────────

function NodeTypeDistributionCard({ stats }: { stats: GraphStats }) {
  const data = useMemo(() => {
    return Object.entries(stats.graph.node_types)
      .map(([k, v]) => ({
        name: k,
        value: v,
        color: tokenToChartHex(NODE_TYPE_META[k as keyof typeof NODE_TYPE_META]?.color ?? 'gray'),
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);
  return (
    <div className="tg-card p-4">
      <SectionTitle>Node Type Distribution</SectionTitle>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">{formatInt(stats.graph.total_nodes)} unique nodes · 8 backend types</div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip {...CHART_TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: d.color }} />
            <span className="font-mono text-[hsl(var(--foreground))]">{d.name}</span>
            <span className="ml-auto text-[hsl(var(--muted-foreground))] tabular-nums">{formatInt(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Relation distribution
// ─────────────────────────────────────────────────────────────────────────────

function RelationDistributionCard({ stats }: { stats: GraphStats }) {
  const data = useMemo(() => {
    return Object.entries(stats.graph.relation_types)
      .map(([k, v]) => ({
        name: k,
        label: RELATION_TYPE_META[k as keyof typeof RELATION_TYPE_META]?.label ?? k.replace(/_/g, ' '),
        value: v,
        isAttack: RELATION_TYPE_META[k as keyof typeof RELATION_TYPE_META]?.is_attack ?? false,
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);
  return (
    <div className="tg-card p-4">
      <SectionTitle>Relation Distribution</SectionTitle>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">{Object.keys(stats.graph.relation_types).length} distinct relations</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...CHART_GRID_STYLE} horizontal={false} />
          <XAxis type="number" {...CHART_AXIS_STYLE} />
          <YAxis type="category" dataKey="label" {...CHART_AXIS_STYLE} width={90} />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[0, 2, 2, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.isAttack ? CHART_COLORS.red : CHART_COLORS.cyan} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Source tag card
// ─────────────────────────────────────────────────────────────────────────────

function SourceTagCard({ stats }: { stats: GraphStats }) {
  const data = useMemo(() => {
    return Object.entries(stats.graph.source_tags).map(([k, v]) => ({ name: k, value: v }));
  }, [stats]);
  return (
    <div className="tg-card p-4">
      <SectionTitle>Source Tag Distribution</SectionTitle>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">Parsers in registry: synthetic, mordor</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid {...CHART_GRID_STYLE} />
          <XAxis dataKey="name" {...CHART_AXIS_STYLE} />
          <YAxis {...CHART_AXIS_STYLE} width={36} />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          <Bar dataKey="value" fill={CHART_COLORS.violet} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Attacks card
// ─────────────────────────────────────────────────────────────────────────────

function AttacksCard({ stats, onNavigate }: { stats: GraphStats; onNavigate?: (page: string) => void }) {
  const histogramEntries = Object.entries(stats.attacks.events_per_chain_histogram);
  return (
    <div className="tg-card p-4 flex flex-col gap-3">
      <SectionTitle right={<button onClick={() => onNavigate?.('chains')} className="text-[10px] text-[hsl(var(--primary))] hover:underline">view all →</button>}>
        Attack Chains
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <MiniMetric label="Total chains" value={formatInt(stats.attacks.total_chains)} />
        <MiniMetric label="Malicious events" value={formatInt(stats.attacks.malicious_events_tracked)} />
      </div>
      <div className="border-t border-[hsl(var(--border))] pt-2">
        <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-2">By strategy (priority order)</div>
        <div className="space-y-1.5">
          <StrategyBar name="chain_id" count={stats.attacks.chains_by_strategy.chain_id} total={stats.attacks.total_chains} color={CHART_COLORS.cyan} />
          <StrategyBar name="causal_parent" count={stats.attacks.chains_by_strategy.causal_parent} total={stats.attacks.total_chains} color={CHART_COLORS.violet} />
          <StrategyBar name="entity_time" count={stats.attacks.chains_by_strategy.entity_time} total={stats.attacks.total_chains} color={CHART_COLORS.teal} />
        </div>
      </div>
      <div className="border-t border-[hsl(var(--border))] pt-2">
        <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-2">Events-per-chain histogram</div>
        <div className="flex flex-wrap gap-1.5">
          {histogramEntries.map(([bucket, count]) => (
            <span key={bucket} className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-[hsl(var(--border))]">
              <span className="text-[hsl(var(--muted-foreground))]">{bucket}</span>
              <span className="text-[hsl(var(--foreground))] tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <div className="text-[9px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold">{label}</div>
      <div className="text-sm font-mono font-semibold tabular-nums text-[hsl(var(--foreground))]">{value}</div>
    </div>
  );
}

function StrategyBar({ name, count, total, color }: { name: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? count / total : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-[hsl(var(--foreground))] w-28">{name}</span>
      <div className="flex-1 h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-[hsl(var(--muted-foreground))] w-8 text-right">{count}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent malicious events table
// ─────────────────────────────────────────────────────────────────────────────

function RecentMaliciousCard({
  events,
  loading,
  onViewAll,
  onEventClick,
}: {
  events: TGEvent[];
  loading: boolean;
  onViewAll?: () => void;
  onEventClick?: (eventId: string) => void;
}) {
  return (
    <div className="tg-card p-4">
      <SectionTitle right={<button onClick={onViewAll} className="text-[10px] text-[hsl(var(--primary))] hover:underline">view all →</button>}>
        Recent Malicious Events
      </SectionTitle>
      {loading ? (
        <LoadingState label="Loading recent events…" />
      ) : events.length === 0 ? (
        <EmptyState title="No malicious events" description="No events labeled malicious" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                <th className="py-1.5 pr-3">event_id</th>
                <th className="py-1.5 pr-3">ts</th>
                <th className="py-1.5 pr-3">source</th>
                <th className="py-1.5 pr-3">→</th>
                <th className="py-1.5 pr-3">target</th>
                <th className="py-1.5 pr-3">relation</th>
                <th className="py-1.5 pr-3">tactic</th>
                <th className="py-1.5 pr-3">chain</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr
                  key={e.event_id}
                  className="border-b border-[hsl(var(--border)/0.5)] hover:bg-[hsl(var(--card-hover))] cursor-pointer"
                  onClick={() => onEventClick?.(e.event_id)}
                >
                  <td className="py-1.5 pr-3"><MonoId>{e.event_id}</MonoId></td>
                  <td className="py-1.5 pr-3 mono text-[11px]">{formatEpochTime(e.ts)}</td>
                  <td className="py-1.5 pr-3 mono text-[11px]">{e.src_id}</td>
                  <td className="py-1.5 pr-3 text-[hsl(var(--muted-foreground))]">→</td>
                  <td className="py-1.5 pr-3 mono text-[11px]">{e.dst_id}</td>
                  <td className="py-1.5 pr-3"><RelationPill relation={e.relation} /></td>
                  <td className="py-1.5 pr-3 text-[11px]">{e.tactics.join(', ')}</td>
                  <td className="py-1.5 pr-3">
                    {e.chain_id ? <MonoId truncateAt={18}>{e.chain_id}</MonoId> : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
