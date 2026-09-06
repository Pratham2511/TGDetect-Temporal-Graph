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
import { useGraphStats, useRecentMalicious, useTGNNSummary, useEvaluationRun, useEventsAnalytics } from '@/lib/tgdetect/services/hooks';
import { useModel } from '@/lib/model-context';
import { Cpu, ShieldCheck, Target, CheckCircle, Crosshair } from 'lucide-react';
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
  const { activeModel, activeModelId, apiHealth } = useModel();
  const statsRes = useGraphStats();
  const recentMalRes = useRecentMalicious(8);
  const summaryRes = useTGNNSummary(activeModelId);
  const evalRes = useEvaluationRun('test', undefined, activeModelId);

  if (statsRes.state === 'loading' && !statsRes.data) {
    return <LoadingState label="Connecting to backend and loading graph statistics…" />;
  }
  if (statsRes.state === 'failed' && apiHealth === 'offline') {
    return <ErrorState message={`Backend unavailable: ${statsRes.error}. Check that the TGDetect API server is running.`} />;
  }
  if (!statsRes.data) return <EmptyState title="No data" description="No graph statistics available" />;

  return (
    <div className="space-y-4">
      <SystemOverviewBanner activeModel={activeModel} apiHealth={apiHealth} />
      <DetectionPerformanceRow activeModel={activeModel} evalData={evalRes.data} />
      <DatasetAndModelSummaryRow activeModel={activeModel} summaryData={summaryRes.data} stats={statsRes.data} />
      <PipelineHeader stats={statsRes.data} activeModel={activeModel} />
      <KpiRow stats={statsRes.data} activeModel={activeModel} />
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
// System & Model Banner
// ─────────────────────────────────────────────────────────────────────────────

function SystemOverviewBanner({ activeModel, apiHealth }: { activeModel: any; apiHealth: string }) {
  return (
    <div className="tg-card p-4 bg-gradient-to-r from-[hsl(var(--card))] via-[hsl(var(--card))] to-[hsl(var(--primary)/0.05)] border border-[hsl(var(--border))]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-[hsl(var(--primary)/0.15)] border border-[hsl(var(--primary)/0.3)] flex items-center justify-center text-[hsl(var(--primary))]">
            <Cpu className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">{activeModel?.name ?? 'Active Detection Model'}</h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${
                activeModel?.target === 'edge'
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                  : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
              }`}>
                {activeModel?.target ?? 'node'} classification
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold">
                {activeModel?.evaluation_status ?? 'evaluated'}
              </span>
            </div>
            <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 font-mono flex items-center gap-3">
              <span>Checkpoint: <span className="text-[hsl(var(--foreground))]">{activeModel?.checkpoint ?? 'best_model.pt'}</span></span>
              <span>•</span>
              <span>Dataset: <span className="text-[hsl(var(--foreground))]">{activeModel?.dataset_name ?? 'mordor_empire'}</span></span>
              <span>•</span>
              <span>API Status: <span className={apiHealth === 'connected' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>{apiHealth.toUpperCase()}</span></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Trainable Params</div>
            <div className="text-sm font-mono font-bold text-[hsl(var(--primary))]">{formatInt(activeModel?.trainable_parameters ?? 38787)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection Performance KPI Row (Section 7 Requirement)
// ─────────────────────────────────────────────────────────────────────────────

function DetectionPerformanceRow({ activeModel, evalData }: { activeModel: any; evalData: any }) {
  const m = evalData?.metrics ?? activeModel?.metrics ?? {};
  const rocAuc = m.auc_roc ?? m.roc_auc ?? null;
  const prAuc = m.auc_pr ?? m.pr_auc ?? null;
  const f1 = m.f1 ?? null;
  const precision = m.precision ?? null;
  const recall = m.recall ?? null;
  const accuracy = m.accuracy ?? null;
  const recall1Pct = m.recall_at_1pct_fpr ?? m.recall_1pct_fpr ?? null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs px-1">
        <span className="font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] text-[11px] flex items-center gap-1.5">
          <Crosshair className="size-3.5 text-[hsl(var(--primary))]" />
          Model Detection Performance · {activeModel?.id ?? 'Current Checkpoint'}
        </span>
        <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
          Artifact-backed evaluation ({activeModel?.target === 'edge' ? 'test split · held-out flows' : 'test split · cyber range'})
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBlock
          label="ROC-AUC"
          value={rocAuc !== null ? rocAuc.toFixed(4) : '—'}
          hint="Discrimination capability"
          icon={TrendingUp}
          color="teal"
        />
        <StatBlock
          label="PR-AUC"
          value={prAuc !== null ? prAuc.toFixed(4) : '—'}
          hint="Precision-recall balance"
          icon={Target}
          color="info"
        />
        <StatBlock
          label="Best F1"
          value={f1 !== null ? f1.toFixed(4) : '—'}
          hint="Harmonic mean"
          icon={Activity}
          color="purple"
        />
        <StatBlock
          label="Precision"
          value={precision !== null ? precision.toFixed(4) : '—'}
          hint="Positive predictive value"
          icon={ShieldCheck}
          color="teal"
        />
        <StatBlock
          label="Recall"
          value={recall !== null ? recall.toFixed(4) : '—'}
          hint="True positive rate"
          icon={AlertTriangle}
          color="warning"
        />
        <StatBlock
          label={recall1Pct ? "Recall @ 1% FPR" : "Accuracy"}
          value={recall1Pct ? `${(recall1Pct * 100).toFixed(2)}%` : accuracy !== null ? accuracy.toFixed(4) : '—'}
          hint={recall1Pct ? "Operational benchmark" : "Overall accuracy"}
          icon={CheckCircle}
          color="teal"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset & Model Architecture Summary (Section 7 Requirement)
// ─────────────────────────────────────────────────────────────────────────────

function DatasetAndModelSummaryRow({ activeModel, summaryData, stats }: { activeModel: any; summaryData: any; stats: any }) {
  const isCTU = activeModel?.id === 'ctu13_ho_c47';
  const totalSamples = isCTU ? 1068851 : (stats?.graph?.total_events ?? 1219);
  const maliciousSamples = isCTU ? 9256 : (stats?.graph?.malicious_events ?? 19);
  const benignSamples = isCTU ? 1059595 : (stats?.graph?.benign_events ?? 1200);
  const malRatio = totalSamples > 0 ? (maliciousSamples / totalSamples) : 0;

  const inChannels = summaryData?.config?.in_channels ?? activeModel?.in_channels ?? 1;
  const edgeDim = summaryData?.config?.edge_dim ?? activeModel?.edge_dim ?? 37;
  const heads = summaryData?.output_heads ?? activeModel?.output_heads ?? ['node_classifier', 'snapshot_classifier'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Dataset Summary */}
      <div className="tg-card p-4 space-y-3">
        <SectionTitle right={<span className="text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">{isCTU ? 'Benchmark Partition' : 'Synthetic Cyber Range'}</span>}>
          Dataset Summary · {activeModel?.dataset_name ?? 'Active Dataset'}
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Total {isCTU ? 'Flows' : 'Events'}</div>
            <div className="text-base font-mono font-bold text-[hsl(var(--foreground))]">{formatInt(totalSamples)}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">evaluation scope</div>
          </div>
          <div className="p-2.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Benign {isCTU ? 'Traffic' : 'Events'}</div>
            <div className="text-base font-mono font-bold text-emerald-400">{formatInt(benignSamples)}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{(100 - malRatio * 100).toFixed(2)}% of total</div>
          </div>
          <div className="p-2.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Malicious {isCTU ? 'Botnet' : 'Attacks'}</div>
            <div className="text-base font-mono font-bold text-rose-400">{formatInt(maliciousSamples)}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{(malRatio * 100).toFixed(2)}% threat ratio</div>
          </div>
        </div>
        <div className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-2 flex items-center justify-between">
          <span>Type: <strong className="text-[hsl(var(--foreground))]">{isCTU ? 'CTU-13 NetFlow Capture 47' : 'Mordor Host Telemetry'}</strong></span>
          <span>Target: <strong className="text-[hsl(var(--foreground))]">{activeModel?.target?.toUpperCase() ?? 'EDGE'}</strong></span>
        </div>
      </div>

      {/* Model Architecture Summary */}
      <div className="tg-card p-4 space-y-3">
        <SectionTitle right={<span className="text-[10px] font-mono px-2 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300">GraphSAGE + GRU</span>}>
          Model Architecture Summary
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Total Params</div>
            <div className="text-base font-mono font-bold text-cyan-400">{formatInt(activeModel?.trainable_parameters ?? 38787)}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">100% trainable</div>
          </div>
          <div className="p-2.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Node / Edge Dim</div>
            <div className="text-base font-mono font-bold text-[hsl(var(--foreground))]">{inChannels} / {edgeDim}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">input features</div>
          </div>
          <div className="p-2.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Output Heads</div>
            <div className="text-base font-mono font-bold text-purple-400">{heads.length}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{heads.join(', ')}</div>
          </div>
        </div>
        <div className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-2 flex items-center justify-between">
          <span>GNN: <strong className="text-[hsl(var(--foreground))]">SAGEConv (2 layers)</strong></span>
          <span>Temporal: <strong className="text-[hsl(var(--foreground))]">GRU (hidden=64)</strong></span>
          <span>Loss: <strong className="text-[hsl(var(--foreground))]">BCEWithLogitsLoss</strong></span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline header
// ─────────────────────────────────────────────────────────────────────────────

function PipelineHeader({ stats, activeModel }: { stats: GraphStats; activeModel?: any }) {
  const isCtu13 = stats.dataset.toLowerCase().includes('ctu13');
  const isMordor = stats.dataset.toLowerCase().includes('mordor');
  const badgeLabel = isCtu13
    ? 'CTU-13 NetFlow Benchmark'
    : isMordor
    ? 'Mordor Cyber Range Telemetry'
    : 'Normalized Telemetry Stream';
  const badgeClass = isCtu13
    ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
    : isMordor
    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400';

  return (
    <div className="tg-card p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <SectionTitle>Backend Pipeline · {stats.dataset}</SectionTitle>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${badgeClass}`}>
              {badgeLabel}
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

function KpiRow({ stats, activeModel }: { stats: GraphStats; activeModel?: any }) {
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
// Events over time — stacked area chart (driven by real backend timeline)
// ─────────────────────────────────────────────────────────────────────────────

function EventsOverTimeCard({ stats, className }: { stats: GraphStats; className?: string }) {
  const { data: analytics, state } = useEventsAnalytics();

  const data = useMemo(() => {
    const rawTimeline = analytics?.timeline;
    if (rawTimeline && rawTimeline.length > 0) {
      return rawTimeline.map((b) => ({
        label: formatEpochTime(b.bucket_start).slice(0, 5),
        benign: b.benign,
        malicious: b.malicious,
      }));
    }
    return [];
  }, [analytics]);

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
      {state === 'loading' ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
          Loading authentic temporal event stream...
        </div>
      ) : data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
          No temporal events recorded for active dataset.
        </div>
      ) : (
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
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              formatter={(value: any, name: any) => [
                typeof value === 'number' && !Number.isNaN(value) ? formatInt(value) : '0',
                name,
              ]}
            />
            <Area type="monotone" dataKey="benign" stackId="1" stroke={CHART_COLORS.green} strokeWidth={1.5} fill="url(#benignGrad)" isAnimationActive={false} />
            <Area type="monotone" dataKey="malicious" stackId="1" stroke={CHART_COLORS.red} strokeWidth={1.5} fill="url(#malGrad)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
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
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={35} isAnimationActive={false}>
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
