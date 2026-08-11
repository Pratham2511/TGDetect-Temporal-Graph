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
import {
  Database,
  Network,
  Activity,
  Shield,
  Brain,
  GitBranch,
  Search,
  Eye,
  Zap,
  Lock,
  Globe,
  ChevronRight,
  AlertTriangle,
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

// ── Constants ──────────────────────────────────────────────────────────

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: '#9ca3af' },
};

const chartFormatter = (v: number) =>
  typeof v === 'number' ? (v % 1 === 0 ? v : v.toFixed(3)) : v;

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

const SOURCE_ACCENT: Record<string, string> = {
  'DARPA TC': 'blue',
  'UNSW-NB15': 'purple',
  'LANL NetFlow': 'cyan',
};

// ── Helper Components ──────────────────────────────────────────────────

function ObjectiveHeader({
  number,
  title,
  description,
  icon: Icon,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/30">
          <span className="text-emerald-400 font-bold text-sm">{number}</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-100">{title}</h2>
        <Icon className="w-5 h-5 text-emerald-400" />
      </div>
      <p className="text-gray-400 text-sm ml-11">{description}</p>
    </div>
  );
}

function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case 'DARPA TC':
      return <Shield className="w-4 h-4 text-blue-400" />;
    case 'UNSW-NB15':
      return <Network className="w-4 h-4 text-purple-400" />;
    case 'LANL NetFlow':
      return <Activity className="w-4 h-4 text-cyan-400" />;
    default:
      return <Database className="w-4 h-4 text-gray-400" />;
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
            className="bg-[#111827]/80 border-gray-800/60"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SourceIcon source={metric.source} />
                  <CardTitle className="text-sm font-medium text-gray-200">
                    {metric.source}
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] border-gray-700 text-gray-400"
                >
                  {metric.topTactic}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0d1120]/50 rounded-lg p-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                    Total Events
                  </p>
                  <p className="text-lg font-semibold text-gray-200 mt-1">
                    {formatNumber(metric.totalEvents)}
                  </p>
                </div>
                <div className="bg-[#0d1120]/50 rounded-lg p-3">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                    Malicious
                  </p>
                  <p className="text-lg font-semibold text-red-400 mt-1">
                    {formatNumber(metric.malicious)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Detection Rate</span>
                  <span className="text-emerald-400 font-medium">
                    {metric.detectionRate}%
                  </span>
                </div>
                <Progress
                  value={metric.detectionRate}
                  className="h-1.5 bg-gray-800"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Avg Confidence</span>
                  <span className="text-blue-400 font-medium">
                    {metric.avgConfidence}%
                  </span>
                </div>
                <Progress
                  value={metric.avgConfidence}
                  className="h-1.5 bg-gray-800"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Multi-line Detection Chart */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-200">
            Detection Counts Over 24h — Per Source
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
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
                  stroke="#1f2937"
                />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  formatter={chartFormatter}
                />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
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
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-200">
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
                  stroke="#1f2937"
                />
                <XAxis
                  dataKey="source"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={formatNumber}
                />
                <Tooltip
                  {...CHART_TOOLTIP_STYLE}
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

// ── Tab 2: Fused Temporal Graph (Objective 1) ──────────────────────────

function FusedTemporalGraphTab() {
  const sourceTimeSeries = useMemo(
    () => generateSourceTimeSeries(),
    []
  );
  const nodeTypes = useMemo(() => generateNodeTypeDistribution(), []);
  const edgeTypes = useMemo(() => generateEdgeTypeDistribution(), []);
  const sourceMetrics = useMemo(() => generateSourceMetrics(), []);

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
      <ObjectiveHeader
        number={1}
        title="Heterogeneous Continuous-Time TGNN Fusion"
        description="Fuses DARPA, UNSW, LANL log sources into a unified temporal graph for modeling multi-step cyberattack patterns"
        icon={Layers}
      />

      {/* Fused Graph Score Line Chart */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-gray-200">
              Fused Temporal Graph — Detection Score Over Time
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-gray-500">
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
                  stroke="#1f2937"
                />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  formatter={chartFormatter}
                />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
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
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-200">
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
                    {...CHART_TOOLTIP_STYLE}
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
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-200">
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
                    stroke="#1f2937"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: '#374151' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    axisLine={{ stroke: '#374151' }}
                    width={75}
                  />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
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
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-200">
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
                    {...CHART_TOOLTIP_STYLE}
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

// ── Tab 3: Concept Drift (Objective 2) ─────────────────────────────────

function ConceptDriftTab() {
  const driftData = useMemo(() => generateConceptDriftData(), []);

  return (
    <div className="space-y-6">
      <ObjectiveHeader
        number={2}
        title="Online Concept Drift Adaptation"
        description="Continuously adapts to evolving attack patterns without degrading accuracy on previously learned patterns"
        icon={Brain}
      />

      {/* Drift Comparison Chart */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-gray-200">
              Detection Accuracy Over Training Epochs
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-gray-500">
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
                  stroke="#1f2937"
                />
                <XAxis
                  dataKey="epoch"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  label={{
                    value: 'Epoch',
                    position: 'insideBottom',
                    offset: -5,
                    fill: '#6b7280',
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  domain={[50, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  {...CHART_TOOLTIP_STYLE}
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

      {/* Explanation */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-200">
            How Adaptation Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            As network traffic patterns evolve over time, static models
            experience <span className="text-red-400 font-medium">concept drift</span> —
            their accuracy degrades because the distribution of normal and
            malicious behavior shifts. TGDetect addresses this through three
            complementary mechanisms that enable continuous learning without
            catastrophic forgetting of previously learned attack signatures.
          </p>
        </CardContent>
      </Card>

      {/* Mechanism Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-400/10 border border-blue-400/30">
                <ArrowRightLeft className="w-4 h-4 text-blue-400" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-200">
                Gradient Reversal Layer
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 leading-relaxed">
              Adversarial training component that reverses gradient flow from
              the domain classifier, forcing the shared encoder to learn
              <span className="text-blue-400"> source-invariant representations</span>.
              This ensures the model generalizes across DARPA, UNSW, and LANL
              distributions without overfitting to any single source.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-400/10 border border-purple-400/30">
                <RefreshCw className="w-4 h-4 text-purple-400" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-200">
                Rehearsal Buffer (10% Snapshots)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 leading-relaxed">
              Stores 10% of historical graph snapshots in a circular buffer.
              During each adaptation step, stored examples are replayed alongside
              new data, preventing{' '}
              <span className="text-purple-400">catastrophic forgetting</span>{' '}
              while preserving detection accuracy on legacy attack patterns.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/30">
                <Cpu className="w-4 h-4 text-cyan-400" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-200">
                Supervised Contrastive Loss
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 leading-relaxed">
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

// ── Tab 4: Attack Backtracking (Objective 3) ───────────────────────────

function AttackBacktrackingTab() {
  const attackChain = useMemo(() => generateAttackChain(), []);

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
      <ObjectiveHeader
        number={3}
        title="Attack Chain Backtracking Engine"
        description="Reconstructs the complete multi-step attack chain from detected alert to initial compromise"
        icon={Search}
      />

      {/* Attack Chain Timeline */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-gray-200">
              Reconstructed Attack Chain
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-gray-500">
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
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-gray-900 z-10 shrink-0 shadow-lg ${getStepDotColor(step.tactic)}`}
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
                    className={`flex-1 rounded-lg border p-4 mb-2 ${TACTIC_BG_COLORS[step.tactic] || 'bg-gray-800/30 border-gray-700/30'}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-200">
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
                        <span className="text-gray-500">
                          Timestamp
                        </span>
                        <p className="text-gray-300 font-mono mt-0.5">
                          {step.timestamp}
                        </p>
                      </div>

                      {/* Node */}
                      <div>
                        <span className="text-gray-500">
                          Node
                        </span>
                        <p className="text-gray-300 font-mono mt-0.5">
                          {step.node}
                        </p>
                      </div>

                      {/* Attention Weight */}
                      <div>
                        <span className="text-gray-500">
                          Attention Weight
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress
                            value={step.attentionWeight * 100}
                            className="h-2 bg-gray-800 flex-1"
                          />
                          <span className="text-gray-300 font-medium w-10 text-right">
                            {step.attentionWeight.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Confidence */}
                      <div>
                        <span className="text-gray-500">
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
                    <div className="mt-3 pt-2 border-t border-gray-700/30">
                      <div className="flex items-start gap-1.5">
                        <Info className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-gray-400 font-mono">
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

// ── Tab 5: Explainability (Objective 4) ─────────────────────────────────

function ExplainabilityTab() {
  const explainData = useMemo(() => generateExplainabilityData(), []);

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

  return (
    <div className="space-y-6">
      <ObjectiveHeader
        number={4}
        title="Temporal Explainability via MITRE ATT&CK"
        description="Maps attention weights and temporal contributions to the MITRE ATT&CK framework so analysts understand what, when, how, and why"
        icon={Eye}
      />

      {/* Main Table */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-gray-200">
              Attention-Weighted Event Explanations
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-gray-500">
            Each detection mapped to its MITRE ATT&CK tactic with temporal
            contribution scores and reasoning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Table Header */}
              <div className="grid grid-cols-[80px,70px,65px,110px,110px,110px,60px,80px,1fr] gap-2 pb-2 border-b border-gray-700/50">
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
                    className="text-[10px] text-gray-500 uppercase tracking-wider font-medium"
                  >
                    {h}
                  </span>
                ))}
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-gray-800/40">
                {explainData.map((entry: ExplainabilityEntry) => (
                  <div
                    key={entry.eventId}
                    className="grid grid-cols-[80px,70px,65px,110px,110px,110px,60px,80px,1fr] gap-2 py-3 items-center hover:bg-[#0d1120]/50 transition-colors"
                  >
                    {/* Event ID */}
                    <span className="text-xs text-gray-300 font-mono">
                      {entry.eventId}
                    </span>

                    {/* Timestamp */}
                    <span className="text-xs text-gray-400 font-mono">
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
                        className="h-2 bg-gray-800 flex-1"
                      />
                      <span className="text-[10px] text-gray-400 w-8 text-right font-mono">
                        {entry.attentionWeight.toFixed(2)}
                      </span>
                    </div>

                    {/* Temporal Contribution Bar */}
                    <div className="flex items-center gap-1.5">
                      <Progress
                        value={entry.temporalContribution * 100}
                        className="h-2 bg-gray-800 flex-1"
                      />
                      <span className="text-[10px] text-gray-400 w-8 text-right font-mono">
                        {entry.temporalContribution.toFixed(2)}
                      </span>
                    </div>

                    {/* Graph Neighborhood */}
                    <span className="text-xs text-gray-400 text-center">
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
                    <span className="text-[11px] text-gray-400 leading-tight">
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
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-200">
            MITRE ATT&CK Tactic Distribution
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
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
                  stroke="#1f2937"
                />
                <XAxis
                  dataKey="tactic"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  axisLine={{ stroke: '#374151' }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  allowDecimals={false}
                />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
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

export function AnalyticsPage() {
  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-emerald-400" />
          Analytics
          <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/15 ml-1">
            4 Research Objectives
          </Badge>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Comprehensive analysis across DARPA TC, UNSW-NB15, and LANL NetFlow
          log sources with TGNN fusion, concept drift adaptation, attack
          backtracking, and temporal explainability.
        </p>
      </div>

      <Separator className="bg-gray-800/60" />

      {/* Tabs */}
      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="bg-[#111827]/80 border border-gray-800/60 h-auto p-1 flex-wrap">
          <TabsTrigger
            value="sources"
            className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-gray-400 text-xs px-3 py-2"
          >
            <Database className="w-3.5 h-3.5 mr-1.5" />
            Source Analysis
          </TabsTrigger>
          <TabsTrigger
            value="fusion"
            className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-gray-400 text-xs px-3 py-2"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            Fused Temporal Graph
          </TabsTrigger>
          <TabsTrigger
            value="drift"
            className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-gray-400 text-xs px-3 py-2"
          >
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            Concept Drift
          </TabsTrigger>
          <TabsTrigger
            value="backtrack"
            className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-gray-400 text-xs px-3 py-2"
          >
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Attack Backtracking
          </TabsTrigger>
          <TabsTrigger
            value="explain"
            className="data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-400 text-gray-400 text-xs px-3 py-2"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Explainability
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

        <TabsContent value="backtrack" className="mt-6">
          <AttackBacktrackingTab />
        </TabsContent>

        <TabsContent value="explain" className="mt-6">
          <ExplainabilityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
