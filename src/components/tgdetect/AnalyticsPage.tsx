'use client';

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
} from 'recharts';
import { TimeRangePicker } from './TimeRangePicker';
import {
  Database,
  Network,
  Activity,
  Shield,
  Brain,
  GitBranch,
  Search,
  Eye,
  ChevronRight,
  Target,
  Layers,
  TrendingUp,
  Info,
  Cpu,
  RefreshCw,
  BarChart3,
  ArrowRightLeft,
  AlertTriangle,
  Clock,
  Gauge,
} from 'lucide-react';
import {
  generateSourceTimeSeries,
  generateSourceMetrics,
  generateConceptDriftData,
  generateAttackChain,
  generateExplainabilityData,
  generateNodeTypeDistribution,
  generateEdgeTypeDistribution,
  driftAccuracyData,
  logSourceTypeData,
  universalEncoderWeights,
  domainInvarianceData,
  domainConfusionScore,
  rehearsalBufferData,
  driftDistanceData,
  attackChainPathScores,
  crossSourceCorrelations,
  tacticEmbeddingClusters,
  supConMetrics,
} from '@/lib/synthetic-data';
import type {
  SourceTimeSeriesPoint,
  SourceMetric,
  AttackChainStep,
  ExplainabilityEntry,
} from '@/lib/synthetic-data';

// ── Chart Constants ──────────────────────────────────────────────────

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
    fontSize: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
  },
};
const CHART_GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: 'hsl(var(--border))',
  opacity: 0.5,
};
const CHART_AXIS_STYLE = {
  tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
  axisLine: { stroke: 'hsl(var(--border))' },
  tickLine: false,
};
const CHART_COLORS = {
  cyan: 'hsl(var(--chart-1))',
  violet: 'hsl(var(--chart-2))',
  green: 'hsl(var(--chart-3))',
  amber: 'hsl(var(--chart-4))',
  red: 'hsl(var(--chart-5))',
  teal: 'hsl(var(--chart-6))',
};

const chartFormatter = (v: number) =>
  typeof v === 'number' ? (v % 1 === 0 ? String(v) : v.toFixed(3)) : String(v);

const TACTIC_COLORS: Record<string, string> = {
  'Reconnaissance': 'text-blue-400',
  'Initial Access': 'text-amber-400',
  'Execution': 'text-orange-400',
  'Persistence': 'text-yellow-400',
  'Privilege Escalation': 'text-red-400',
  'Defense Evasion': 'text-purple-400',
  'Credential Access': 'text-rose-400',
  'Discovery': 'text-cyan-400',
  'Lateral Movement': 'text-emerald-400',
  'Collection': 'text-teal-400',
  'Command & Control': 'text-pink-400',
  'Exfiltration': 'text-red-500',
  'Impact': 'text-red-600',
};

const TACTIC_BG_COLORS: Record<string, string> = {
  'Reconnaissance': 'bg-blue-400/10 border-blue-400/30',
  'Initial Access': 'bg-amber-400/10 border-amber-400/30',
  'Execution': 'bg-orange-400/10 border-orange-400/30',
  'Persistence': 'bg-yellow-400/10 border-yellow-400/30',
  'Privilege Escalation': 'bg-red-400/10 border-red-400/30',
  'Defense Evasion': 'bg-purple-400/10 border-purple-400/30',
  'Credential Access': 'bg-rose-400/10 border-rose-400/30',
  'Discovery': 'bg-cyan-400/10 border-cyan-400/30',
  'Lateral Movement': 'bg-emerald-400/10 border-emerald-400/30',
  'Collection': 'bg-teal-400/10 border-teal-400/30',
  'Command & Control': 'bg-pink-400/10 border-pink-400/30',
  'Exfiltration': 'bg-red-500/10 border-red-500/30',
  'Impact': 'bg-red-600/10 border-red-600/30',
};

const TACTIC_SEVERITY: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  'Reconnaissance': 'low',
  'Initial Access': 'medium',
  'Execution': 'medium',
  'Persistence': 'medium',
  'Privilege Escalation': 'high',
  'Defense Evasion': 'high',
  'Credential Access': 'high',
  'Discovery': 'medium',
  'Lateral Movement': 'high',
  'Collection': 'medium',
  'Command & Control': 'high',
  'Exfiltration': 'critical',
  'Impact': 'critical',
};

const SOURCE_COLORS: Record<string, string> = {
  DARPA: CHART_COLORS.cyan,
  UNSW: CHART_COLORS.violet,
  LANL: CHART_COLORS.teal,
  Fused: CHART_COLORS.green,
};

const CLUSTER_COLORS = [
  CHART_COLORS.cyan, CHART_COLORS.violet, CHART_COLORS.green,
  CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.teal,
];
const CLUSTER_NAMES = ['Initial Access', 'Execution', 'Credential Access', 'Lateral Movement', 'C2', 'Exfiltration'];

// ── Helper Components ──────────────────────────────────────────────────

function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case 'DARPA TC':
      return <Shield className="w-4 h-4 text-blue-400" />;
    case 'UNSW-NB15':
      return <Network className="w-4 h-4 text-purple-400" />;
    case 'LANL NetFlow':
      return <Activity className="w-4 h-4 text-cyan-400" />;
    default:
      return <Database className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />;
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatLogNumber(v: number): string {
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v);
}

// ── Tab 1: Source Analysis ─────────────────────────────────────────────

function SourceAnalysisTab() {
  const sourceMetrics = useMemo(() => generateSourceMetrics(), []);
  const sourceTimeSeries = useMemo(() => generateSourceTimeSeries(), []);

  const stackedBarData = useMemo(() => {
    return sourceMetrics.map((m) => ({
      source: m.source,
      total: m.totalEvents,
    }));
  }, [sourceMetrics]);

  const logSourceTotal = useMemo(() => logSourceTypeData.reduce((s, d) => s + d.count, 0), []);

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sourceMetrics.map((metric: SourceMetric) => (
          <Card key={metric.source} className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SourceIcon source={metric.source} />
                  <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    {metric.source}
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] border-[hsl(var(--border-light))] text-[hsl(var(--muted-foreground))]">
                  {metric.topTactic}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[hsl(var(--secondary))] rounded-lg p-3">
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Total Events</p>
                  <p className="text-lg font-semibold text-[hsl(var(--muted-foreground))] mt-1">{formatNumber(metric.totalEvents)}</p>
                </div>
                <div className="bg-[hsl(var(--secondary))] rounded-lg p-3">
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Malicious</p>
                  <p className="text-lg font-semibold text-red-400 mt-1">{formatNumber(metric.malicious)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[hsl(var(--muted-foreground))]">Detection Rate</span>
                  <span className="text-emerald-400 font-medium">{metric.detectionRate}%</span>
                </div>
                <Progress value={metric.detectionRate} className="h-1.5 bg-[hsl(var(--secondary))]" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[hsl(var(--muted-foreground))]">Avg Confidence</span>
                  <span className="text-blue-400 font-medium">{metric.avgConfidence}%</span>
                </div>
                <Progress value={metric.avgConfidence} className="h-1.5 bg-[hsl(var(--secondary))]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GAP C1 — Log Source Type Breakdown */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Log Source Type Breakdown</CardTitle>
          <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">Distribution of ingested event types across all sources</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {logSourceTypeData.map((item) => {
            const pct = (item.count / logSourceTotal) * 100;
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[hsl(var(--muted-foreground))]">{item.name}</span>
                  <span className="tabular-nums text-[hsl(var(--muted-foreground))]">{formatNumber(item.count)} <span className="opacity-60">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="h-2 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Multi-line Detection Chart */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Detection Counts Over 24h — Per Source</CardTitle>
          <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">Real-time detection counts from each log source over a 24-hour window</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sourceTimeSeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid {...CHART_GRID_STYLE} />
                <XAxis {...CHART_AXIS_STYLE} dataKey="time" />
                <YAxis {...CHART_AXIS_STYLE} tickFormatter={chartFormatter} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
                <Line type="monotone" dataKey="darpa" name="DARPA" stroke={SOURCE_COLORS.DARPA} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="unsw" name="UNSW" stroke={SOURCE_COLORS.UNSW} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="lanl" name="LANL" stroke={SOURCE_COLORS.LANL} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Stacked Bar Chart — Total Events (BUG B2: log scale) */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Total Event Volume by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid {...CHART_GRID_STYLE} />
                <XAxis {...CHART_AXIS_STYLE} dataKey="source" />
                <YAxis {...CHART_AXIS_STYLE} scale="log" domain={['auto', 'auto']} tickFormatter={formatLogNumber} />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => formatNumber(v)} />
                <Bar dataKey="total" name="Total Events" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]}>
                  {stackedBarData.map((_, idx) => (
                    <Cell key={idx} fill={[SOURCE_COLORS.DARPA, SOURCE_COLORS.UNSW, SOURCE_COLORS.LANL][idx]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-center mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Y-axis uses logarithmic scale</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab 2: Fused Temporal Graph ─────────────────────────────────────────

function FusedTemporalGraphTab() {
  const sourceTimeSeries = useMemo(() => generateSourceTimeSeries(), []);
  const nodeTypes = useMemo(() => generateNodeTypeDistribution(), []);
  const edgeTypes = useMemo(() => generateEdgeTypeDistribution(), []);
  const sourceMetrics = useMemo(() => generateSourceMetrics(), []);

  const sourceContribution = useMemo(() => {
    const total = sourceMetrics.reduce((s, m) => s + m.totalEvents, 0);
    return sourceMetrics.map((m) => ({
      name: m.source,
      value: Math.round((m.totalEvents / total) * 100),
    }));
  }, [sourceMetrics]);

  const sourcePieColors = [SOURCE_COLORS.DARPA, SOURCE_COLORS.UNSW, SOURCE_COLORS.LANL];

  const edgeColors = [CHART_COLORS.cyan, CHART_COLORS.violet, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.green, CHART_COLORS.red];

  return (
    <div className="space-y-6">
      {/* Detailed Explanation Card */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Heterogeneous Continuous-Time TGNN Fusion</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-3">
            TGDetect ingests heterogeneous log sources — <span className="text-blue-400 font-medium">DARPA TC v3</span> (enterprise network engagements with full PCAP), <span className="text-purple-400 font-medium">UNSW-NB15</span> (labeled network behavior with 9 attack families), and <span className="text-cyan-400 font-medium">LANL NetFlow</span> (unlabeled enterprise traffic with 1.8B+ flows) — each with fundamentally different schemas, event types, and temporal resolutions.
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-3">
            The TGNN encoder maps all events from every source into a shared embedding space with <span className="text-blue-400 font-medium">embed_dim=64</span>, normalizing across heterogeneous feature sets. Temporal edges are then constructed between events that occur within configurable time windows (default: 300s), creating a unified temporal graph where nodes from different sources can participate in the same temporal neighborhoods.
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
            This fused graph enables cross-source correlation that would be impossible in siloed analysis. For example, a DNS tunneling alert detected in UNSW-NB15 combined with a large outbound data transfer observed in LANL NetFlow within the same temporal window strengthens the detection of a complete C2→Exfiltration chain.
          </p>
        </CardContent>
      </Card>

      {/* GAP C2 — UniversalEncoder Feature Weights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {universalEncoderWeights.map((w) => (
          <div key={w.name} className="tg-card p-4">
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">{w.name}</p>
            <p className="metric-value-sm" style={{ color: 'hsl(var(--primary))' }}>{w.weight}%</p>
          </div>
        ))}
      </div>

      {/* GAP C3 — MultiResTimeEncoder Spec */}
      <div className="tg-card p-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="section-title">MultiResTimeEncoder</span>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>TIME_DIM: <span className="font-mono text-[hsl(var(--foreground))]">32</span></span>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Fine: <span className="font-mono text-[hsl(var(--foreground))]">0.1–10Hz</span></span>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Coarse: <span className="font-mono text-[hsl(var(--foreground))]">0.001–0.1Hz</span></span>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Encoding: <span className="font-mono text-[hsl(var(--foreground))]">Cosine sinusoidal</span></span>
      </div>

      {/* GAP C4 — CausalHTAConv Callout */}
      <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ borderLeft: '3px solid hsl(var(--warning))', background: 'hsl(var(--warning-bg))', color: 'hsl(var(--muted-foreground))' }}>
        <strong style={{ color: 'hsl(var(--warning))' }}>CausalHTAConv</strong> — Hierarchical Temporal Attention enforces a strict causal attention boundary: each event can only attend to events that occurred <em>before</em> it in the temporal sequence. This prevents information leakage from future events and ensures the model learns truly predictive (not post-hoc) temporal patterns.
      </div>

      {/* D1 — Graph Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Nodes', value: '1,847', icon: Target },
          { label: 'Active Edges', value: '12,453', icon: GitBranch },
          { label: 'Temporal Windows', value: '48', icon: Clock },
          { label: 'Window', value: '300s', icon: Activity },
        ].map((s) => (
          <div key={s.label} className="tg-card p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.1)' }}>
              <s.icon className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">{s.label}</p>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))] tabular-nums">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Fused Graph Score Line Chart */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Fused Temporal Graph — Detection Score Over Time</CardTitle>
          </div>
          <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">Combined detection signal from all three heterogeneous log sources after TGNN fusion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sourceTimeSeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="fusedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SOURCE_COLORS.Fused} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={SOURCE_COLORS.Fused} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID_STYLE} />
                <XAxis {...CHART_AXIS_STYLE} dataKey="time" />
                <YAxis {...CHART_AXIS_STYLE} tickFormatter={chartFormatter} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="fused" name="Fused Score" stroke={SOURCE_COLORS.Fused} strokeWidth={2} fill="url(#fusedGradient)" />
                <Line type="monotone" dataKey="darpa" name="DARPA" stroke={SOURCE_COLORS.DARPA} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                <Line type="monotone" dataKey="unsw" name="UNSW" stroke={SOURCE_COLORS.UNSW} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                <Line type="monotone" dataKey="lanl" name="LANL" stroke={SOURCE_COLORS.LANL} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pie + Bar Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Node Type Pie */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Node Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={nodeTypes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2} stroke="none">
                    {nodeTypes.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Edge Type Bar */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Edge Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={edgeTypes} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                  <CartesianGrid {...CHART_GRID_STYLE} horizontal={false} />
                  <XAxis type="number" {...CHART_AXIS_STYLE} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={{ stroke: 'hsl(var(--border))' }} width={75} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]}>
                    {edgeTypes.map((_, idx) => (
                      <Cell key={idx} fill={edgeColors[idx % edgeColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Source Contribution Pie */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Source Contribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceContribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3} stroke="none" minAngle={8} label={({ name, value }) => `${name} ${value}%`}>
                    {sourceContribution.map((_, idx) => (
                      <Cell key={idx} fill={sourcePieColors[idx]} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* D2 — Cross-Source Correlation Table */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Cross-Source Correlations</CardTitle>
          <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">High-confidence correlations detected across heterogeneous sources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  {['Correlation ID', 'Source A', 'Source B', 'Time Delta', 'Shared Node', 'Fused Score'].map(col => (
                    <th key={col} className="section-title pb-3 pt-3 px-4 text-left first:pl-6 last:pr-6">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crossSourceCorrelations.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < crossSourceCorrelations.length - 1 ? '1px solid hsl(var(--border-light))' : 'none' }} className="hover:bg-[hsl(var(--card-hover))] transition-colors">
                    <td className="py-3 px-4 pl-6 font-mono" style={{ color: 'hsl(var(--primary))', fontSize: '12px' }}>{c.id}</td>
                    <td className="py-3 px-4 text-[hsl(var(--muted-foreground))]">{c.srcA}</td>
                    <td className="py-3 px-4 text-[hsl(var(--muted-foreground))]">{c.srcB}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[hsl(var(--muted-foreground))]">{c.dt}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[hsl(var(--muted-foreground))]">{c.node}</td>
                    <td className="py-3 px-4 pr-6">
                      <span className="badge-success" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px' }}>{(c.score * 100).toFixed(0)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab 3: Concept Drift ────────────────────────────────────────────────

function ConceptDriftTab() {
  const driftData = useMemo(() => generateConceptDriftData(), []);

  return (
    <div className="space-y-6">
      {/* Drift Comparison Chart — BUG B1 fix: use driftAccuracyData */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Detection Accuracy Over Training Epochs</CardTitle>
          </div>
          <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">Comparison of V16 Apex with and without adaptation mechanisms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={driftAccuracyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid {...CHART_GRID_STYLE} />
                <XAxis {...CHART_AXIS_STYLE} dataKey="epoch" />
                <YAxis {...CHART_AXIS_STYLE} domain={[58, 100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine x={6} stroke={CHART_COLORS.amber} strokeDasharray="6 3" label={{ value: 'Drift Onset', position: 'top', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Line type="monotone" dataKey="v16Apex" name="V16 Apex" stroke={CHART_COLORS.green} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="noRehearsal" name="No Rehearsal" stroke={CHART_COLORS.violet} strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="baseline" name="Baseline" stroke={CHART_COLORS.red} strokeWidth={2} strokeDasharray="2 2" dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* GAP C8 — Drift Distance Gauge */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="tg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Drift Distance</p>
          </div>
          <p className="metric-value-sm text-[hsl(var(--foreground))]">{driftDistanceData.current.toFixed(3)}</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Threshold: {driftDistanceData.threshold.toFixed(3)}</p>
        </div>
        <div className="tg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" style={{ color: 'hsl(var(--warning))' }} />
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Capacity Used</p>
          </div>
          <p className="metric-value-sm" style={{ color: 'hsl(var(--warning))' }}>{driftDistanceData.percentage}%</p>
          <div className="h-2 rounded-full bg-[hsl(var(--secondary))] mt-2 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${driftDistanceData.percentage}%`, background: 'hsl(var(--warning))' }} />
          </div>
        </div>
        <div className="tg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Status</p>
          </div>
          <p className="metric-value-sm text-emerald-400">{driftDistanceData.status}</p>
          <div className="h-[60px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={driftDistanceData.sparkline}>
                <Line type="monotone" dataKey="d" stroke={CHART_COLORS.cyan} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Explanation */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">How Adaptation Works</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-4">
            In network security, <span className="text-red-400 font-medium">concept drift</span> refers to the phenomenon where the statistical distribution of network traffic changes over time. A static model trained on historical data will inevitably degrade in accuracy as the gap between training distribution and operational distribution widens.
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-4">
            TGDetect's TGNN addresses this through three complementary mechanisms. First, a <span className="text-blue-400 font-medium">Gradient Reversal Layer</span> applies adversarial training. Second, a <span className="text-purple-400 font-medium">Rehearsal Buffer</span> stores 10% of historical graph snapshots. Third, <span className="text-cyan-400 font-medium">Supervised Contrastive Loss</span> pulls embeddings of same-class events closer.
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
            The measurable impact is dramatic: V16_Apex maintains <span className="text-emerald-400 font-medium">97%+ accuracy over 20 consecutive training epochs</span>, while an identical architecture without adaptation degrades to approximately 60%. This 37-percentage-point gap represents the difference between operational reliability and progressive blindness.
          </p>
        </CardContent>
      </Card>

      {/* Mechanism Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gradient Reversal + C5 Domain Invariance */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-400/10 border border-blue-400/30">
                <ArrowRightLeft className="w-4 h-4 text-blue-400" />
              </div>
              <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Gradient Reversal Layer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {/* C5 Domain Invariance Monitor */}
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Domain Confusion Score</p>
            <p className="metric-value-sm" style={{ color: 'hsl(var(--primary))' }}>{domainConfusionScore}%</p>
            <div className="space-y-2 mt-3">
              {domainInvarianceData.map((d) => (
                <div key={d.name} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[hsl(var(--muted-foreground))]">{d.name}</span>
                    <span className="tabular-nums text-[hsl(var(--muted-foreground))]">{d.score}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: CHART_COLORS.cyan }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mt-3">
              Adversarial training forces the shared encoder to learn <span className="text-blue-400">source-invariant representations</span>.
            </p>
          </CardContent>
        </Card>

        {/* Rehearsal Buffer + C7 */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-400/10 border border-purple-400/30">
                <RefreshCw className="w-4 h-4 text-purple-400" />
              </div>
              <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Rehearsal Buffer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {/* C7 Rehearsal Buffer Status */}
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Capacity</p>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">{rehearsalBufferData.capacity.toLocaleString()}</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">/ {rehearsalBufferData.max.toLocaleString()}</span>
              <span className="text-[10px] badge-warning ml-auto" style={{ padding: '1px 6px', borderRadius: '9999px' }}>{((rehearsalBufferData.capacity / rehearsalBufferData.max) * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-[hsl(var(--secondary))] overflow-hidden mb-3">
              <div className="h-full rounded-full" style={{ width: `${(rehearsalBufferData.capacity / rehearsalBufferData.max) * 100}%`, background: CHART_COLORS.violet }} />
            </div>
            <div className="space-y-2">
              {rehearsalBufferData.sources.map((s) => (
                <div key={s.name} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[hsl(var(--muted-foreground))]">{s.name}</span>
                    <span className="tabular-nums text-[hsl(var(--muted-foreground))]">{s.count.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(s.count / rehearsalBufferData.max) * 100}%`, background: CHART_COLORS.violet }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mt-3">
              Circular buffer replays historical snapshots alongside new data, preventing <span className="text-purple-400">catastrophic forgetting</span>.
            </p>
          </CardContent>
        </Card>

        {/* SupCon + E1 */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/30">
                <Cpu className="w-4 h-4 text-cyan-400" />
              </div>
              <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Supervised Contrastive Loss</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {/* E1 SupCon Enhancement */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="badge-info" style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '9999px' }}>Tactic Separation: {supConMetrics.tacticSeparation}σ</span>
              <span className="badge-success" style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '9999px' }}>Compactness: {supConMetrics.clusterCompactness}</span>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
              Pulls embeddings of same-class events closer while pushing different-class events apart. Creates <span className="text-cyan-400">well-separated temporal neighborhoods</span> that remain stable as the data distribution shifts.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Tab 4: Attack Backtracking ───────────────────────────────────────────

function AttackBacktrackingTab() {
  const attackChain = useMemo(() => generateAttackChain(), []);

  const getStepConnectorColor = (tactic: string) => {
    const sev = TACTIC_SEVERITY[tactic] || 'low';
    switch (sev) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-400';
      case 'medium': return 'bg-amber-400';
      default: return 'bg-blue-400';
    }
  };

  const getStepDotColor = (tactic: string) => {
    const sev = TACTIC_SEVERITY[tactic] || 'low';
    switch (sev) {
      case 'critical': return 'bg-red-400 border-red-500 shadow-red-500/30';
      case 'high': return 'bg-orange-400 border-orange-500 shadow-orange-500/30';
      case 'medium': return 'bg-amber-400 border-amber-500 shadow-amber-500/30';
      default: return 'bg-blue-400 border-blue-500 shadow-blue-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* GAP C9 Summary Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="tg-card p-4">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Total Steps</p>
          <p className="metric-value-sm text-[hsl(var(--foreground))]">{attackChain.length}</p>
        </div>
        <div className="tg-card p-4">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Avg Path Score</p>
          <p className="metric-value-sm" style={{ color: 'hsl(var(--primary))' }}>{(attackChainPathScores.reduce((a, b) => a + b, 0) / attackChainPathScores.length).toFixed(3)}</p>
        </div>
        <div className="tg-card p-4">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Min Path Score</p>
          <p className="metric-value-sm text-[hsl(var(--foreground))]">{Math.min(...attackChainPathScores).toFixed(3)}</p>
        </div>
        <div className="tg-card p-4">
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Max Path Score</p>
          <p className="metric-value-sm text-emerald-400">{Math.max(...attackChainPathScores).toFixed(3)}</p>
        </div>
      </div>

      {/* Detailed Explanation Card */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Attack Chain Backtracking Engine</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-3">
            The backtracking engine is TGDetect's incident response accelerator. When the TGNN produces a high-confidence detection alert, the engine traces <span className="text-blue-400 font-medium">backwards through the temporal graph</span> to reconstruct the full attack narrative.
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
            The result is a complete, multi-step attack reconstruction — from initial compromise through privilege escalation, lateral movement, C2, and data exfiltration. Each step includes a confidence score and verifiable evidence, enabling analysts to <span className="text-emerald-400 font-medium">immediately understand what happened, when, and on which nodes</span>.
          </p>
        </CardContent>
      </Card>

      {/* Attack Chain Timeline */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Reconstructed Attack Chain</CardTitle>
          </div>
          <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">Auto-reconstructed from alert TGD-0012 back to initial compromise — 9 steps across 4 nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {attackChain.map((step: AttackChainStep, idx: number) => {
              const isLast = idx === attackChain.length - 1;
              const pathScore = attackChainPathScores[idx];
              return (
                <div key={step.step} className="relative flex gap-4 pb-6">
                  {/* Timeline Connector */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 shrink-0 shadow-lg ${getStepDotColor(step.tactic)} text-gray-900`}>
                      {step.step}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 mt-1 ${getStepConnectorColor(step.tactic)}`} />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className={`flex-1 rounded-lg border p-4 mb-2 ${TACTIC_BG_COLORS[step.tactic] || 'bg-[hsl(var(--secondary))] border-[hsl(var(--border-light))]'}`}>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{step.event}</span>
                      <Badge variant="outline" className={`text-[10px] ${TACTIC_COLORS[step.tactic]} border-current/30`}>{step.tactic}</Badge>
                      {/* C9 Path Score */}
                      <span className="text-[10px] ml-auto font-mono tabular-nums" style={{ color: 'hsl(var(--primary))' }}>
                        Path: {pathScore.toFixed(3)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">Timestamp</span>
                        <p className="text-[hsl(var(--muted-foreground))] font-mono mt-0.5">{step.timestamp}</p>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">Node</span>
                        <p className="text-[hsl(var(--muted-foreground))] font-mono mt-0.5">{step.node}</p>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">Attention Weight</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={step.attentionWeight * 100} className="h-2 bg-[hsl(var(--secondary))] flex-1" />
                          <span className="text-[hsl(var(--muted-foreground))] font-medium w-10 text-right">{step.attentionWeight.toFixed(2)}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">Confidence</span>
                        <p className={`font-medium mt-0.5 ${
                          step.confidence >= 98 ? 'text-emerald-400' : step.confidence >= 96 ? 'text-blue-400' : 'text-amber-400'
                        }`}>
                          {step.confidence}%
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[hsl(var(--border-light))]">
                      <div className="flex items-start gap-1.5">
                        <Info className="w-3 h-3 text-[hsl(var(--muted-foreground))] mt-0.5 shrink-0" />
                        <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono">{step.evidence}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab 5: Explainability ───────────────────────────────────────────────

function ExplainabilityTab() {
  const explainData = useMemo(() => generateExplainabilityData(), []);

  const tacticDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    explainData.forEach((e: ExplainabilityEntry) => {
      counts[e.tactic] = (counts[e.tactic] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([tactic, count]) => ({ tactic, count }))
      .sort((a, b) => b.count - a.count);
  }, [explainData]);

  const tacticBarColors = [CHART_COLORS.green, CHART_COLORS.cyan, CHART_COLORS.violet, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.red];

  return (
    <div className="space-y-6">
      {/* C10 — Analyst Narrative */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Analyst Narrative — TGD-0012</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg p-3" style={{ borderLeft: '3px solid hsl(var(--chart-1))' }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'hsl(var(--chart-1))' }}>WHAT</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">A multi-stage APT chain was detected spanning 9 steps from initial phishing to 2.4GB data exfiltration, involving 4 network nodes.</p>
          </div>
          <div className="rounded-lg p-3" style={{ borderLeft: '3px solid hsl(var(--chart-4))' }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'hsl(var(--chart-4))' }}>WHEN</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">Attack window: 08:14:22 – 11:03:41 UTC (2h 49m 19s). Temporal graph detected abnormal acceleration at 09:01 (lateral movement onset).</p>
          </div>
          <div className="rounded-lg p-3" style={{ borderLeft: '3px solid hsl(var(--chart-2))' }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'hsl(var(--chart-2))' }}>HOW</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">Spear-phishing → macro execution → registry persistence → credential dump (Mimikatz) → WMI lateral movement → privilege escalation → data staging → DNS tunneling C2 → HTTPS exfiltration.</p>
          </div>
          <div className="rounded-lg p-3" style={{ borderLeft: '3px solid hsl(var(--chart-3))' }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'hsl(var(--chart-3))' }}>WHY</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">Cross-source temporal correlation: DARPA TC detected the phishing delivery, LANL NetFlow captured the lateral movement traffic, and UNSW-NB15 flagged the DNS tunneling beacon — all within the same 300s temporal window.</p>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Explanation Card */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Temporal Explainability via MITRE ATT&CK</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed mb-3">
            Temporal explainability goes beyond simple feature importance — it answers <span className="text-blue-400 font-medium">why each specific event was flagged as malicious</span>. TGDetect's TGNN exposes its internal reasoning through attention weights, temporal contribution scores, and graph neighborhood influence.
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
            All signals are mapped directly to the <span className="text-amber-400 font-medium">MITRE ATT&CK framework</span>, enabling faster triage and clearer communication with stakeholders.
          </p>
        </CardContent>
      </Card>

      {/* BUG B3 — Explainability Table (proper table) */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Attention-Weighted Event Explanations</CardTitle>
          <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">Each detection mapped to its MITRE ATT&CK tactic with temporal contribution scores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'hsl(var(--border))' }}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  {['Event ID', 'Time', 'Source', 'Tactic', 'Attn Wt', 'Temp Ctrb', 'Nbhd', 'Class.', 'Reasoning'].map(col => (
                    <th key={col} className="section-title pb-3 pt-3 px-4 text-left first:pl-6 last:pr-6">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {explainData.map((entry, i) => (
                  <tr key={entry.eventId}
                    style={{ borderBottom: i < explainData.length - 1 ? '1px solid hsl(var(--border-light))' : 'none' }}
                    className="hover:bg-[hsl(var(--card-hover))] transition-colors">
                    <td className="py-3 px-4 pl-6 font-mono text-xs" style={{ color: 'hsl(var(--primary))' }}>{entry.eventId}</td>
                    <td className="py-3 px-4 font-mono text-xs" style={{ color: 'hsl(var(--foreground))' }}>{entry.timestamp}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))' }}>{entry.source}</span>
                    </td>
                    <td className="py-3 px-4"><span className="badge-purple text-xs px-2 py-0.5 rounded-full">{entry.tactic}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 min-w-[90px]">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'hsl(var(--border))' }}>
                          <div className="h-full rounded-full" style={{ width: `${entry.attentionWeight * 100}%`, background: 'hsl(var(--chart-1))' }} />
                        </div>
                        <span className="text-xs tabular-nums">{entry.attentionWeight.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 min-w-[90px]">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'hsl(var(--border))' }}>
                          <div className="h-full rounded-full" style={{ width: `${entry.temporalContribution * 100}%`, background: 'hsl(var(--chart-2))' }} />
                        </div>
                        <span className="text-xs tabular-nums">{entry.temporalContribution.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs tabular-nums text-right">{entry.graphNeighborhood}</td>
                    <td className="py-3 px-4">
                      <span className={entry.classification === 'Malicious' ? 'badge-danger' : 'badge-success'} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '9999px' }}>{entry.classification}</span>
                    </td>
                    <td className="py-3 px-4 pr-6 text-xs max-w-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{entry.reasoning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tactic Distribution Mini Chart */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">MITRE ATT&CK Tactic Distribution</CardTitle>
          <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">Frequency of detected tactics across all analyzed events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tacticDistribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid {...CHART_GRID_STYLE} />
                <XAxis dataKey="tactic" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={{ stroke: 'hsl(var(--border))' }} angle={-20} textAnchor="end" height={60} />
                <YAxis {...CHART_AXIS_STYLE} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Events" radius={[4, 4, 0, 0]}>
                  {tacticDistribution.map((_, idx) => (
                    <Cell key={idx} fill={tacticBarColors[idx % tacticBarColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* C6 — Tactic Embedding Cluster ScatterChart */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Tactic Embedding Clusters</CardTitle>
          <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">2D t-SNE projection of event embeddings colored by MITRE ATT&CK tactic cluster</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid {...CHART_GRID_STYLE} />
                <XAxis {...CHART_AXIS_STYLE} dataKey="x" name="TSNE-1" type="number" domain={[-5, 5]} />
                <YAxis {...CHART_AXIS_STYLE} dataKey="y" name="TSNE-2" type="number" domain={[-5, 5]} />
                <ZAxis range={[40, 40]} />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(_v: number, name: string) => [name, 'Cluster']} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {CLUSTER_NAMES.map((name, idx) => {
                  const pts = tacticEmbeddingClusters.filter(p => p.cluster === idx);
                  return (
                    <Scatter key={name} name={name} data={pts} fill={CLUSTER_COLORS[idx]} />
                  );
                })}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function AnalyticsPage({ timeRange, onTimeRangeChange }: { timeRange: string; onTimeRangeChange: (r: string) => void }) {
  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Analytics
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Comprehensive detection analytics across DARPA TC, UNSW-NB15, and LANL NetFlow log sources.
          </p>
        </div>
        <TimeRangePicker value={timeRange as '1h' | '6h' | '12h' | '24h' | '7d' | '30d'} onChange={onTimeRangeChange} />
      </div>

      <Separator className="bg-[hsl(var(--border))]" />

      {/* Tabs — 5-tab structure (Phase 3) */}
      <Tabs defaultValue="sources" className="w-full">
        <div className="overflow-x-auto scrollbar-hide">
          <TabsList className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] h-auto p-1 flex-wrap">
            <TabsTrigger value="sources" className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-[hsl(var(--muted-foreground))] text-xs px-3 py-2">
              <Database className="w-3.5 h-3.5 mr-1.5" />
              Source Analysis
            </TabsTrigger>
            <TabsTrigger value="fusion" className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-[hsl(var(--muted-foreground))] text-xs px-3 py-2">
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              Fused Temporal Graph
            </TabsTrigger>
            <TabsTrigger value="drift" className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-[hsl(var(--muted-foreground))] text-xs px-3 py-2">
              <Brain className="w-3.5 h-3.5 mr-1.5" />
              Concept Drift
            </TabsTrigger>
            <TabsTrigger value="attack-backtracking" className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-[hsl(var(--muted-foreground))] text-xs px-3 py-2">
              <GitBranch className="w-3.5 h-3.5 mr-1.5" />
              Attack Backtracking
            </TabsTrigger>
            <TabsTrigger value="explainability" className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-[hsl(var(--muted-foreground))] text-xs px-3 py-2">
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Explainability
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="sources" className="mt-6">
          <SourceAnalysisTab />
        </TabsContent>

        <TabsContent value="fusion" className="mt-6">
          <FusedTemporalGraphTab />
        </TabsContent>

        <TabsContent value="drift" className="mt-6">
          <ConceptDriftTab />
        </TabsContent>

        <TabsContent value="attack-backtracking" className="mt-6">
          <AttackBacktrackingTab />
        </TabsContent>

        <TabsContent value="explainability" className="mt-6">
          <ExplainabilityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
