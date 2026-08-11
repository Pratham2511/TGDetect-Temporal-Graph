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
} from 'lucide-react';
import {
  generateSourceTimeSeries,
  generateSourceMetrics,
  generateConceptDriftData,
  generateAttackChain,
  generateExplainabilityData,
  generateNodeTypeDistribution,
  generateEdgeTypeDistribution,
} from '@/lib/synthetic-data';
import type {
  SourceTimeSeriesPoint,
  SourceMetric,
  AttackChainStep,
  ExplainabilityEntry,
} from '@/lib/synthetic-data';
import { useTheme } from '@/lib/theme-context';

// ── Constants ──────────────────────────────────────────────────────────

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
  DARPA: '#3b82f6',
  UNSW: '#8b5cf6',
  LANL: '#06b6d4',
  Fused: '#10b981',
};

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
      return <Database className="w-4 h-4 text-[var(--text-secondary)]" />;
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// ── Tab 1: Source Analysis ─────────────────────────────────────────────

function SourceAnalysisTab() {
  const sourceMetrics = useMemo(() => generateSourceMetrics(), []);
  const sourceTimeSeries = useMemo(() => generateSourceTimeSeries(), []);
  const { theme } = useTheme();

  const axisColor = theme === 'dark' ? '#6b7280' : '#64748b';
  const gridColor = theme === 'dark' ? '#1f2937' : '#e2e8f0';
  const axisLineColor = theme === 'dark' ? '#374151' : '#cbd5e1';
  const chartTooltipStyle = theme === 'dark' ? {
    contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12, color: '#9ca3af' },
    labelStyle: { color: '#9ca3af' },
  } : {
    contentStyle: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#475569' },
    labelStyle: { color: '#475569' },
  };

  // Build stacked bar data
  const stackedBarData = useMemo(() => {
    const totals = sourceMetrics.map((m) => ({
      source: m.source,
      total: m.totalEvents,
    }));
    return totals;
  }, [sourceMetrics]);

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sourceMetrics.map((metric: SourceMetric) => (
          <Card
            key={metric.source}
            className="bg-[var(--bg-card)] border-[var(--border-primary)]"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SourceIcon source={metric.source} />
                  <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
                    {metric.source}
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] border-[var(--border-secondary)] text-[var(--text-secondary)]"
                >
                  {metric.topTactic}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--bg-input)] rounded-lg p-3">
                  <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                    Total Events
                  </p>
                  <p className="text-lg font-semibold text-[var(--text-secondary)] mt-1">
                    {formatNumber(metric.totalEvents)}
                  </p>
                </div>
                <div className="bg-[var(--bg-input)] rounded-lg p-3">
                  <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                    Malicious
                  </p>
                  <p className="text-lg font-semibold text-red-400 mt-1">
                    {formatNumber(metric.malicious)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Detection Rate</span>
                  <span className="text-emerald-400 font-medium">
                    {metric.detectionRate}%
                  </span>
                </div>
                <Progress
                  value={metric.detectionRate}
                  className="h-1.5 bg-[var(--bg-input)]"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Avg Confidence</span>
                  <span className="text-blue-400 font-medium">
                    {metric.avgConfidence}%
                  </span>
                </div>
                <Progress
                  value={metric.avgConfidence}
                  className="h-1.5 bg-[var(--bg-input)]"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Multi-line Detection Chart */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
            Detection Counts Over 24h — Per Source
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-muted)]">
            Real-time detection counts from each log source over a 24-hour
            window
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sourceTimeSeries}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: axisLineColor }}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: axisLineColor }}
                  tickFormatter={chartFormatter}
                />
                <Tooltip {...chartTooltipStyle} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="darpa"
                  name="DARPA"
                  stroke={SOURCE_COLORS.DARPA}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="unsw"
                  name="UNSW"
                  stroke={SOURCE_COLORS.UNSW}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="lanl"
                  name="LANL"
                  stroke={SOURCE_COLORS.LANL}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Stacked Bar Chart — Total Events */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
            Total Event Volume by Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stackedBarData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                />
                <XAxis
                  dataKey="source"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: axisLineColor }}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: axisLineColor }}
                  tickFormatter={formatNumber}
                />
                <Tooltip
                  {...chartTooltipStyle}
                  formatter={(v: number) => formatNumber(v)}
                />
                <Bar
                  dataKey="total"
                  name="Total Events"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                >
                  {stackedBarData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        [
                          SOURCE_COLORS.DARPA,
                          SOURCE_COLORS.UNSW,
                          SOURCE_COLORS.LANL,
                        ][idx]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab 2: Fused Temporal Graph ─────────────────────────────────────────

function FusedTemporalGraphTab() {
  const sourceTimeSeries = useMemo(
    () => generateSourceTimeSeries(),
    []
  );
  const nodeTypes = useMemo(() => generateNodeTypeDistribution(), []);
  const edgeTypes = useMemo(() => generateEdgeTypeDistribution(), []);
  const sourceMetrics = useMemo(() => generateSourceMetrics(), []);
  const { theme } = useTheme();

  const axisColor = theme === 'dark' ? '#6b7280' : '#64748b';
  const gridColor = theme === 'dark' ? '#1f2937' : '#e2e8f0';
  const axisLineColor = theme === 'dark' ? '#374151' : '#cbd5e1';
  const chartTooltipStyle = theme === 'dark' ? {
    contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12, color: '#9ca3af' },
    labelStyle: { color: '#9ca3af' },
  } : {
    contentStyle: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#475569' },
    labelStyle: { color: '#475569' },
  };

  // Source contribution data for pie chart
  const sourceContribution = useMemo(() => {
    const total = sourceMetrics.reduce((s, m) => s + m.totalEvents, 0);
    return sourceMetrics.map((m) => ({
      name: m.source,
      value: Math.round((m.totalEvents / total) * 100),
    }));
  }, [sourceMetrics]);

  const sourcePieColors = [
    SOURCE_COLORS.DARPA,
    SOURCE_COLORS.UNSW,
    SOURCE_COLORS.LANL,
  ];

  const edgeColors = [
    '#3b82f6',
    '#8b5cf6',
    '#06b6d4',
    '#f59e0b',
    '#10b981',
    '#ec4899',
  ];

  return (
    <div className="space-y-6">
      {/* Detailed Explanation Card */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Heterogeneous Continuous-Time TGNN Fusion
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            TGDetect ingests heterogeneous log sources — <span className="text-blue-400 font-medium">DARPA TC v3</span> (enterprise network engagements with full PCAP), <span className="text-purple-400 font-medium">UNW-NB15</span> (labeled network behavior with 9 attack families), and <span className="text-cyan-400 font-medium">LANL NetFlow</span> (unlabeled enterprise traffic with 1.8B+ flows) — each with fundamentally different schemas, event types, and temporal resolutions.
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            The TGNN encoder maps all events from every source into a shared embedding space with <span className="text-blue-400 font-medium">embed_dim=64</span>, normalizing across heterogeneous feature sets. Temporal edges are then constructed between events that occur within configurable time windows (default: 300s), creating a unified temporal graph where nodes from different sources can participate in the same temporal neighborhoods.
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            This fused graph enables cross-source correlation that would be impossible in siloed analysis. For example, a DNS tunneling alert detected in UNSW-NB15 combined with a large outbound data transfer observed in LANL NetFlow within the same temporal window strengthens the detection of a complete C2→Exfiltration chain, increasing the fused graph score beyond what either source could produce independently.
          </p>
        </CardContent>
      </Card>

      {/* Fused Graph Score Line Chart */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Fused Temporal Graph — Detection Score Over Time
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-[var(--text-muted)]">
            Combined detection signal from all three heterogeneous log sources
            after TGNN fusion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sourceTimeSeries}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient
                    id="fusedGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={SOURCE_COLORS.Fused}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={SOURCE_COLORS.Fused}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: axisLineColor }}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: axisLineColor }}
                  tickFormatter={chartFormatter}
                />
                <Tooltip {...chartTooltipStyle} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="fused"
                  name="Fused Score"
                  stroke={SOURCE_COLORS.Fused}
                  strokeWidth={2}
                  fill="url(#fusedGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="darpa"
                  name="DARPA"
                  stroke={SOURCE_COLORS.DARPA}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="unsw"
                  name="UNSW"
                  stroke={SOURCE_COLORS.UNSW}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="lanl"
                  name="LANL"
                  stroke={SOURCE_COLORS.LANL}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pie + Bar Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Node Type Pie */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Node Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={nodeTypes}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {nodeTypes.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(v: number) => `${v}%`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Edge Type Bar */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Edge Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={edgeTypes}
                  layout="vertical"
                  margin={{
                    top: 5,
                    right: 20,
                    left: 80,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridColor}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={{ stroke: axisLineColor }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 10 }}
                    axisLine={{ stroke: axisLineColor }}
                    width={75}
                  />
                  <Tooltip {...chartTooltipStyle} />
                  <Bar
                    dataKey="value"
                    name="Count"
                    radius={[0, 4, 4, 0]}
                  >
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
        <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Source Contribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceContribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={3}
                    stroke="none"
                    label={({ name, value }) => `${name} ${value}%`}
                  >
                    {sourceContribution.map((_, idx) => (
                      <Cell key={idx} fill={sourcePieColors[idx]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(v: number) => `${v}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Tab 3: Concept Drift ────────────────────────────────────────────────

function ConceptDriftTab() {
  const driftData = useMemo(() => generateConceptDriftData(), []);
  const { theme } = useTheme();

  const axisColor = theme === 'dark' ? '#6b7280' : '#64748b';
  const gridColor = theme === 'dark' ? '#1f2937' : '#e2e8f0';
  const axisLineColor = theme === 'dark' ? '#374151' : '#cbd5e1';
  const chartTooltipStyle = theme === 'dark' ? {
    contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12, color: '#9ca3af' },
    labelStyle: { color: '#9ca3af' },
  } : {
    contentStyle: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#475569' },
    labelStyle: { color: '#475569' },
  };

  return (
    <div className="space-y-6">
      {/* Drift Comparison Chart */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Detection Accuracy Over Training Epochs
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-[var(--text-muted)]">
            Comparison of model accuracy with and without concept drift
            adaptation over 20 training epochs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={driftData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient
                    id="adaptGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#10b981"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="#10b981"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id="noAdaptGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#ef4444"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="#ef4444"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                />
                <XAxis
                  dataKey="epoch"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: axisLineColor }}
                  label={{
                    value: 'Epoch',
                    position: 'insideBottom',
                    offset: -5,
                    fill: axisColor,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: axisLineColor }}
                  domain={[50, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  {...chartTooltipStyle}
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="withAdaptation"
                  name="With Adaptation"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#adaptGradient)"
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="monotone"
                  dataKey="withoutAdaptation"
                  name="Without Adaptation"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  fill="url(#noAdaptGradient)"
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Explanation */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
            How Adaptation Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
            In network security, <span className="text-red-400 font-medium">concept drift</span> refers to the phenomenon where the statistical distribution of network traffic changes over time — new attack variants emerge, legitimate traffic patterns shift as organizations evolve, and adversaries continuously adapt their tactics to evade detection. A static model trained on historical data will inevitably degrade in accuracy as the gap between training distribution and operational distribution widens, creating dangerous blind spots that sophisticated threat actors can exploit.
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
            TGDetect's TGNN addresses this through three complementary mechanisms operating in concert. First, a <span className="text-blue-400 font-medium">Gradient Reversal Layer</span> applies adversarial training by reversing gradient flow from a domain classifier, forcing the shared encoder to learn source-invariant representations that generalize across DARPA, UNSW, and LANL distributions without overfitting to any single source's idiosyncrasies. Second, a <span className="text-purple-400 font-medium">Rehearsal Buffer</span> stores 10% of historical graph snapshots in a circular buffer and replays them alongside new data during each adaptation step, preventing catastrophic forgetting of previously learned attack signatures. Third, <span className="text-cyan-400 font-medium">Supervised Contrastive Loss</span> pulls embeddings of same-class events closer while pushing different-class events apart, creating well-separated temporal neighborhoods that remain stable even as the underlying data distribution shifts.
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
            The measurable impact is dramatic: as shown in the chart above, V16_Apex with all three mechanisms active maintains <span className="text-emerald-400 font-medium">97%+ accuracy over 20 consecutive training epochs</span>, while an identical architecture without adaptation degrades from 96.5% to approximately 60% as the data distribution drifts. This 37-percentage-point gap represents the difference between a system that remains operationally reliable and one that becomes progressively blind to emerging threats.
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            For real-world deployment, this capability is essential. Advanced Persistent Threats (APTs) such as APT29, APT41, and Lazarus Group continuously evolve their tooling, infrastructure, and tradecraft — often shifting from one initial access vector to another within weeks. A detector that cannot adapt would require expensive and time-consuming manual retraining cycles, leaving organizations exposed during the gap. TGDetect's online adaptation ensures continuous, autonomous coverage without human intervention.
          </p>
        </CardContent>
      </Card>

      {/* Mechanism Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-400/10 border border-blue-400/30">
                <ArrowRightLeft className="w-4 h-4 text-blue-400" />
              </div>
              <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
                Gradient Reversal Layer
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Adversarial training component that reverses gradient flow from
              the domain classifier, forcing the shared encoder to learn
              <span className="text-blue-400"> source-invariant representations</span>.
              This ensures the model generalizes across DARPA, UNSW, and LANL
              distributions without overfitting to any single source.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-400/10 border border-purple-400/30">
                <RefreshCw className="w-4 h-4 text-purple-400" />
              </div>
              <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
                Rehearsal Buffer (10% Snapshots)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Stores 10% of historical graph snapshots in a circular buffer.
              During each adaptation step, stored examples are replayed alongside
              new data, preventing{' '}
              <span className="text-purple-400">catastrophic forgetting</span>{' '}
              while preserving detection accuracy on legacy attack patterns.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/30">
                <Cpu className="w-4 h-4 text-cyan-400" />
              </div>
              <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
                Supervised Contrastive Loss
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Pulls embeddings of same-class events closer while pushing
              different-class events apart. This creates{' '}
              <span className="text-cyan-400">well-separated temporal neighborhoods</span>{' '}
              that remain stable even as the underlying data distribution
              shifts, ensuring robust classification boundaries.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Threat Intelligence: Attack Backtracking ────────────────────────────

function AttackBacktrackingTab() {
  const attackChain = useMemo(() => generateAttackChain(), []);
  const { theme } = useTheme();

  const getStepConnectorColor = (tactic: string) => {
    const sev = TACTIC_SEVERITY[tactic] || 'low';
    switch (sev) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-400';
      case 'medium':
        return 'bg-amber-400';
      default:
        return 'bg-blue-400';
    }
  };

  const getStepDotColor = (tactic: string) => {
    const sev = TACTIC_SEVERITY[tactic] || 'low';
    switch (sev) {
      case 'critical':
        return 'bg-red-400 border-red-500 shadow-red-500/30';
      case 'high':
        return 'bg-orange-400 border-orange-500 shadow-orange-500/30';
      case 'medium':
        return 'bg-amber-400 border-amber-500 shadow-amber-500/30';
      default:
        return 'bg-blue-400 border-blue-500 shadow-blue-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Detailed Explanation Card */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Attack Chain Backtracking Engine
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            The backtracking engine is TGDetect's incident response accelerator. When the TGNN produces a high-confidence detection alert, the engine doesn't just flag the individual event — it traces <span className="text-blue-400 font-medium">backwards through the temporal graph</span> to reconstruct the full attack narrative. Starting from the detected alert (e.g., a data exfiltration event), it follows causal edges in reverse temporal order, identifying the sequence of precursor events that led to the detection.
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            The backtracking algorithm leverages the TGNN's learned <span className="text-purple-400 font-medium">attention weights</span> to determine the most likely attack path at each step. At every node in the temporal graph, the engine examines all incoming causal edges and selects the one with the highest attention weight, effectively following the path of strongest causal influence. This produces a ranked chain of events, each annotated with its confidence score, the node it originated from, and the specific evidence (e.g., log artifacts, command strings, network flows) that links it to the attack.
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            The result is a complete, multi-step attack reconstruction — from initial compromise (e.g., a spear-phishing email) through privilege escalation, lateral movement, command-and-control establishment, and ultimately data exfiltration. Each step includes a confidence score (typically 95–99.7%) and verifiable evidence, enabling analysts to <span className="text-emerald-400 font-medium">immediately understand exactly what happened, when it happened, and on which nodes</span>. This dramatically reduces mean-time-to-respond (MTTR) by eliminating the manual forensic investigation that traditionally follows each alert.
          </p>
        </CardContent>
      </Card>

      {/* Attack Chain Timeline */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Reconstructed Attack Chain
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-[var(--text-muted)]">
            Auto-reconstructed from alert TGD-0012 back to initial compromise —
            9 steps across 4 nodes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {attackChain.map((step: AttackChainStep, idx: number) => {
              const isLast = idx === attackChain.length - 1;
              return (
                <div key={step.step} className="relative flex gap-4 pb-6">
                  {/* Timeline Connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold z-10 shrink-0 shadow-lg ${getStepDotColor(step.tactic)} ${theme === 'dark' ? 'text-gray-900' : 'text-white'}`}
                    >
                      {step.step}
                    </div>
                    {!isLast && (
                      <div
                        className={`w-0.5 flex-1 mt-1 ${getStepConnectorColor(step.tactic)}`}
                      />
                    )}
                  </div>

                  {/* Step Content */}
                  <div
                    className={`flex-1 rounded-lg border p-4 mb-2 ${TACTIC_BG_COLORS[step.tactic] || 'bg-[var(--bg-input)] border-[var(--border-secondary)]'}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-[var(--text-secondary)]">
                        {step.event}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${TACTIC_COLORS[step.tactic]} border-current/30`}
                      >
                        {step.tactic}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      {/* Timestamp */}
                      <div>
                        <span className="text-[var(--text-muted)]">
                          Timestamp
                        </span>
                        <p className="text-[var(--text-secondary)] font-mono mt-0.5">
                          {step.timestamp}
                        </p>
                      </div>

                      {/* Node */}
                      <div>
                        <span className="text-[var(--text-muted)]">
                          Node
                        </span>
                        <p className="text-[var(--text-secondary)] font-mono mt-0.5">
                          {step.node}
                        </p>
                      </div>

                      {/* Attention Weight */}
                      <div>
                        <span className="text-[var(--text-muted)]">
                          Attention Weight
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress
                            value={step.attentionWeight * 100}
                            className="h-2 bg-[var(--bg-input)] flex-1"
                          />
                          <span className="text-[var(--text-secondary)] font-medium w-10 text-right">
                            {step.attentionWeight.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Confidence */}
                      <div>
                        <span className="text-[var(--text-muted)]">
                          Confidence
                        </span>
                        <p
                          className={`font-medium mt-0.5 ${
                            step.confidence >= 98
                              ? 'text-emerald-400'
                              : step.confidence >= 96
                                ? 'text-blue-400'
                                : 'text-amber-400'
                          }`}
                        >
                          {step.confidence}%
                        </p>
                      </div>
                    </div>

                    {/* Evidence */}
                    <div className="mt-3 pt-2 border-t border-[var(--border-secondary)]">
                      <div className="flex items-start gap-1.5">
                        <Info className="w-3 h-3 text-[var(--text-muted)] mt-0.5 shrink-0" />
                        <span className="text-xs text-[var(--text-secondary)] font-mono">
                          {step.evidence}
                        </span>
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

// ── Threat Intelligence: Explainability ─────────────────────────────────

function ExplainabilityTab() {
  const explainData = useMemo(() => generateExplainabilityData(), []);
  const { theme } = useTheme();

  // MITRE ATT&CK tactic distribution for mini bar chart
  const tacticDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    explainData.forEach((e: ExplainabilityEntry) => {
      counts[e.tactic] = (counts[e.tactic] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([tactic, count]) => ({ tactic, count }))
      .sort((a, b) => b.count - a.count);
  }, [explainData]);

  const tacticBarColors = [
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#06b6d4',
    '#f59e0b',
    '#ef4444',
  ];

  const axisColor = theme === 'dark' ? '#6b7280' : '#64748b';
  const gridColor = theme === 'dark' ? '#1f2937' : '#e2e8f0';
  const axisLineColor = theme === 'dark' ? '#374151' : '#cbd5e1';
  const chartTooltipStyle = theme === 'dark' ? {
    contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12, color: '#9ca3af' },
    labelStyle: { color: '#9ca3af' },
  } : {
    contentStyle: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#475569' },
    labelStyle: { color: '#475569' },
  };

  return (
    <div className="space-y-6">
      {/* Detailed Explanation Card */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Temporal Explainability via MITRE ATT&CK
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            Temporal explainability goes beyond simple feature importance — it answers <span className="text-blue-400 font-medium">why each specific event was flagged as malicious</span>, not just that it was flagged. Unlike traditional black-box detectors that output a binary or score, TGDetect's TGNN exposes its internal reasoning through multiple complementary signals: attention weights, temporal contribution scores, and graph neighborhood influence. Each of these metrics is computed per-event and per-detection, giving analysts a multi-dimensional view into the model's decision-making process.
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
            <span className="text-purple-400 font-medium">Attention weights</span> indicate how strongly each event influenced the final classification decision — a weight of 0.98 means the event was nearly decisive in flagging the detection, while 0.85 indicates strong but not overwhelming influence. <span className="text-cyan-400 font-medium">Temporal contribution</span> measures how much the timing and ordering of events (relative to their neighbors in the temporal graph) contributed to the classification — events that are temporally anomalous (e.g., a DNS query at 3 AM following a lateral movement event) receive higher temporal scores. <span className="text-emerald-400 font-medium">Graph neighborhood</span> counts the number of connected events in the temporal graph that influenced this detection — higher values indicate the detection is supported by a richer context of correlated events across the graph.
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Crucially, all of these signals are mapped directly to the <span className="text-amber-400 font-medium">MITRE ATT&CK framework</span>, so analysts can immediately understand which attack stage each event corresponds to — from Initial Access through Exfiltration. This mapping bridges the gap between machine learning outputs and the tactical frameworks that SOC teams already use daily, enabling faster triage, more informed escalation decisions, and clearer communication with stakeholders about the nature and severity of detected threats.
          </p>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
              Attention-Weighted Event Explanations
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-[var(--text-muted)]">
            Each detection mapped to its MITRE ATT&CK tactic with temporal
            contribution scores and reasoning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Table Header */}
              <div className="grid grid-cols-[80px,70px,65px,110px,110px,110px,60px,80px,1fr] gap-2 pb-2 border-b border-[var(--border-secondary)]">
                {[
                  'Event ID',
                  'Time',
                  'Source',
                  'Tactic',
                  'Attention Wt',
                  'Temporal Ctrb',
                  'Graph Nbhd',
                  'Class.',
                  'Reasoning',
                ].map((h) => (
                  <span
                    key={h}
                    className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium"
                  >
                    {h}
                  </span>
                ))}
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-[var(--border-secondary)]">
                {explainData.map((entry: ExplainabilityEntry) => (
                  <div
                    key={entry.eventId}
                    className="grid grid-cols-[80px,70px,65px,110px,110px,110px,60px,80px,1fr] gap-2 py-3 items-center hover:bg-[var(--bg-input)] transition-colors"
                  >
                    {/* Event ID */}
                    <span className="text-xs text-[var(--text-secondary)] font-mono">
                      {entry.eventId}
                    </span>

                    {/* Timestamp */}
                    <span className="text-xs text-[var(--text-secondary)] font-mono">
                      {entry.timestamp}
                    </span>

                    {/* Source */}
                    <Badge
                      variant="outline"
                      className={`text-[10px] justify-center ${
                        entry.source === 'DARPA'
                          ? 'border-blue-400/30 text-blue-400'
                          : entry.source === 'UNSW'
                            ? 'border-purple-400/30 text-purple-400'
                            : 'border-cyan-400/30 text-cyan-400'
                      }`}
                    >
                      {entry.source}
                    </Badge>

                    {/* Tactic */}
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${TACTIC_COLORS[entry.tactic]} border-current/30`}
                    >
                      {entry.tactic}
                    </Badge>

                    {/* Attention Weight Bar */}
                    <div className="flex items-center gap-1.5">
                      <Progress
                        value={entry.attentionWeight * 100}
                        className="h-2 bg-[var(--bg-input)] flex-1"
                      />
                      <span className="text-[10px] text-[var(--text-secondary)] w-8 text-right font-mono">
                        {entry.attentionWeight.toFixed(2)}
                      </span>
                    </div>

                    {/* Temporal Contribution Bar */}
                    <div className="flex items-center gap-1.5">
                      <Progress
                        value={entry.temporalContribution * 100}
                        className="h-2 bg-[var(--bg-input)] flex-1"
                      />
                      <span className="text-[10px] text-[var(--text-secondary)] w-8 text-right font-mono">
                        {entry.temporalContribution.toFixed(2)}
                      </span>
                    </div>

                    {/* Graph Neighborhood */}
                    <span className="text-xs text-[var(--text-secondary)] text-center">
                      {entry.graphNeighborhood}
                    </span>

                    {/* Classification */}
                    <Badge
                      className={`text-[10px] ${
                        entry.classification === 'Malicious'
                          ? 'bg-red-400/10 text-red-400 border-red-400/20'
                          : 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                      }`}
                    >
                      {entry.classification}
                    </Badge>

                    {/* Reasoning */}
                    <span className="text-[11px] text-[var(--text-secondary)] leading-tight">
                      {entry.reasoning}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tactic Distribution Mini Chart */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-primary)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">
            MITRE ATT&CK Tactic Distribution
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-muted)]">
            Frequency of detected tactics across all analyzed events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tacticDistribution}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                />
                <XAxis
                  dataKey="tactic"
                  tick={{ fill: theme === 'dark' ? '#9ca3af' : '#475569', fontSize: 10 }}
                  axisLine={{ stroke: axisLineColor }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={{ stroke: axisLineColor }}
                  allowDecimals={false}
                />
                <Tooltip {...chartTooltipStyle} />
                <Bar
                  dataKey="count"
                  name="Events"
                  radius={[4, 4, 0, 0]}
                >
                  {tacticDistribution.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={tacticBarColors[idx % tacticBarColors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function AnalyticsPage({ timeRange, onTimeRangeChange }: { timeRange: string; onTimeRangeChange: (r: any) => void }) {
  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Analytics
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Comprehensive detection analytics across DARPA TC, UNSW-NB15, and LANL NetFlow log sources.
          </p>
        </div>
        <TimeRangePicker value={timeRange as any} onChange={onTimeRangeChange} />
      </div>

      <Separator className="bg-[var(--border-primary)]" />

      {/* Tabs */}
      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="bg-[var(--bg-card)] border border-[var(--border-primary)] h-auto p-1 flex-wrap">
          <TabsTrigger
            value="sources"
            className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-[var(--text-muted)] text-xs px-3 py-2"
          >
            <Database className="w-3.5 h-3.5 mr-1.5" />
            Source Analysis
          </TabsTrigger>
          <TabsTrigger
            value="fusion"
            className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-[var(--text-muted)] text-xs px-3 py-2"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            Fused Temporal Graph
          </TabsTrigger>
          <TabsTrigger
            value="drift"
            className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-[var(--text-muted)] text-xs px-3 py-2"
          >
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            Concept Drift
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-6">
          <SourceAnalysisTab />
        </TabsContent>

        <TabsContent value="fusion" className="mt-6">
          <FusedTemporalGraphTab />
        </TabsContent>

        <TabsContent value="drift" className="mt-6">
          <ConceptDriftTab />
        </TabsContent>
      </Tabs>

      {/* ─── Threat Intelligence Section ─── */}
      <div className="pt-6">
        <Separator className="bg-[var(--border-primary)] mb-6" />
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Threat Intelligence</h2>
            <p className="text-xs text-[var(--text-muted)]">Attack reconstruction and temporal explainability for rapid incident response</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Sub-section: Attack Backtracking */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Attack Backtracking</h3>
              <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
            </div>
            <AttackBacktrackingTab />
          </div>

          {/* Sub-section: Explainability */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Explainability</h3>
              <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
            </div>
            <ExplainabilityTab />
          </div>
        </div>
      </div>
    </div>
  );
}