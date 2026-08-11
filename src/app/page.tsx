'use client'

import { useState } from 'react';
import {
  Shield, LayoutDashboard, GitBranch, BarChart3, BookOpen,
  ChevronRight, Activity, Network, Zap, Target, AlertTriangle,
  CheckCircle2, Clock, ShieldAlert, Brain, Database, Cpu,
  ArrowUpRight, ArrowDownRight, TrendingUp, Search,
  Server, Globe, Lock, Eye
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  generateTimeSeriesData, generateDetectionResults, generateModelMetrics,
  generateGraphStats, generateNetworkEvents, generateNodeTypeDistribution,
  generateThreatTimeline, generateEdgeTypeDistribution, type DetectionResult
} from '@/lib/synthetic-data';

// ─── NAVIGATION ─────────────────────────────────────────────────
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'architecture', label: 'Architecture', icon: GitBranch },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'methodology', label: 'Methodology', icon: BookOpen },
] as const;

type Page = typeof navItems[number]['id'];

// ─── SYNTHETIC DATA ─────────────────────────────────────────────
const timeSeriesData = generateTimeSeriesData();
const detectionResults = generateDetectionResults();
const modelMetrics = generateModelMetrics();
const graphStats = generateGraphStats();
const networkEvents = generateNetworkEvents(200);
const nodeTypeData = generateNodeTypeDistribution();
const threatTimeline = generateThreatTimeline();
const edgeTypeData = generateEdgeTypeDistribution();

const severityColors: Record<string, string> = {
  Low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  High: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Critical: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  Detected: Search,
  Investigating: Clock,
  Contained: ShieldAlert,
};

// ─── MAIN PAGE ──────────────────────────────────────────────────
export default function Home() {
  const [activePage, setActivePage] = useState<Page>('dashboard');

  return (
    <div className="flex h-screen bg-[#0a0e1a] text-gray-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-800/80 bg-[#0d1120] flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">TGDetect</h1>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Threat Detection</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-500/10 text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : ''}`} />
                {item.label}
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-blue-400/60" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-800/80">
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500">Demo Mode — Synthetic Data</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 border-b border-gray-800/60 bg-[#0a0e1a]/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {navItems.find(n => n.id === activePage)?.label}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {activePage === 'dashboard' && 'System overview and key performance indicators'}
              {activePage === 'architecture' && 'TGNN model architecture and data flow'}
              {activePage === 'analytics' && 'Detection analytics with synthetic network data'}
              {activePage === 'methodology' && 'Research objectives and methodology'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs px-2.5">
              <Activity className="w-3 h-3 mr-1" />
              Live Demo
            </Badge>
            <Badge variant="outline" className="border-gray-700 text-gray-400 text-xs px-2.5">
              <Database className="w-3 h-3 mr-1" />
              Synthetic Data
            </Badge>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {activePage === 'dashboard' && <DashboardPage />}
          {activePage === 'architecture' && <ArchitecturePage />}
          {activePage === 'analytics' && <AnalyticsPage />}
          {activePage === 'methodology' && <MethodologyPage />}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 1: DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function DashboardPage() {
  const totalThreats = detectionResults.length;
  const criticalCount = detectionResults.filter(d => d.severity === 'Critical').length;
  const contained = detectionResults.filter(d => d.status === 'Contained').length;
  const avgConfidence = Math.round(detectionResults.reduce((a, d) => a + d.confidence, 0) / detectionResults.length * 10) / 10;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Detections"
          value={totalThreats.toString()}
          subtitle="Last 24 hours"
          icon={ShieldAlert}
          trend="up"
          trendValue="+12%"
          color="blue"
        />
        <StatCard
          title="Critical Alerts"
          value={criticalCount.toString()}
          subtitle="Requires attention"
          icon={AlertTriangle}
          trend="up"
          trendValue="+3"
          color="red"
        />
        <StatCard
          title="Threats Contained"
          value={contained.toString()}
          subtitle={`${Math.round(contained / totalThreats * 100)}% containment rate`}
          icon={CheckCircle2}
          trend="up"
          trendValue="+8%"
          color="emerald"
        />
        <StatCard
          title="Avg. Confidence"
          value={`${avgConfidence}%`}
          subtitle="Model confidence"
          icon={Brain}
          trend="stable"
          trendValue="96.8%"
          color="purple"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Traffic Overview Chart */}
        <Card className="lg:col-span-2 bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Network Traffic Overview</CardTitle>
            <CardDescription className="text-xs text-gray-500">24-hour event distribution by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="gradNormal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSuspicious" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMalicious" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="normal" stackId="1" stroke="#3b82f6" fill="url(#gradNormal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="suspicious" stackId="1" stroke="#f59e0b" fill="url(#gradSuspicious)" strokeWidth={2} />
                  <Area type="monotone" dataKey="malicious" stackId="1" stroke="#ef4444" fill="url(#gradMalicious)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Graph Statistics */}
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Graph Statistics</CardTitle>
            <CardDescription className="text-xs text-gray-500">Current temporal graph snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <GraphStatItem label="Total Nodes" value={graphStats.totalNodes.toString()} icon={Globe} color="blue" />
            <GraphStatItem label="Total Edges" value={graphStats.totalEdges.toLocaleString()} icon={Network} color="cyan" />
            <GraphStatItem label="Temporal Windows" value={graphStats.temporalWindows.toString()} icon={Clock} color="amber" />
            <GraphStatItem label="Clustering Coeff." value={graphStats.avgClusteringCoeff.toFixed(3)} icon={Target} color="purple" />
            <GraphStatItem label="Graph Density" value={graphStats.graphDensity.toFixed(4)} icon={Zap} color="emerald" />
            <Separator className="bg-gray-800/60" />
            <div className="pt-1">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400">Processing Load</span>
                <span className="text-emerald-400 font-medium">34%</span>
              </div>
              <Progress value={34} className="h-2 bg-gray-800 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-cyan-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Detections Table */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-gray-300">Recent Detections</CardTitle>
              <CardDescription className="text-xs text-gray-500">Latest threat detection results</CardDescription>
            </div>
            <Badge variant="outline" className="border-gray-700 text-gray-400 text-xs">{detectionResults.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800/60">
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">ID</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Timestamp</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Attack Type</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Severity</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Source</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Confidence</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Graph Score</th>
                  <th className="text-left text-gray-500 font-medium py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {detectionResults.slice(0, 8).map((d) => {
                  const StatusIcon = statusIcons[d.status];
                  return (
                    <tr key={d.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                      <td className="py-2 pr-4 font-mono text-blue-400">{d.id}</td>
                      <td className="py-2 pr-4 text-gray-400">{new Date(d.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 pr-4 text-gray-300">{d.attackType}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${severityColors[d.severity]}`}>
                          {d.severity}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-mono text-gray-400">{d.sourceNode}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Progress value={d.confidence} className="w-12 h-1.5 bg-gray-800 [&>div]:bg-blue-500" />
                          <span className="text-gray-400">{d.confidence}%</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Progress value={d.graphScore} className="w-12 h-1.5 bg-gray-800 [&>div]:bg-purple-500" />
                          <span className="text-gray-400">{d.graphScore}%</span>
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <StatusIcon className={`w-3 h-3 ${
                            d.status === 'Detected' ? 'text-amber-400' :
                            d.status === 'Investigating' ? 'text-blue-400' : 'text-emerald-400'
                          }`} />
                          <span className="text-gray-400">{d.status}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, color }: {
  title: string; value: string; subtitle: string; icon: typeof Shield;
  trend: 'up' | 'down' | 'stable'; trendValue: string; color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; shadow: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', shadow: 'shadow-blue-500/10' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', shadow: 'shadow-red-500/10' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', shadow: 'shadow-emerald-500/10' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', shadow: 'shadow-purple-500/10' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <Card className={`bg-[#111827]/80 border-gray-800/60 hover:border-gray-700/60 transition-colors`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center shadow-lg ${c.shadow}`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3 text-xs">
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> :
           trend === 'down' ? <ArrowDownRight className="w-3 h-3 text-red-400" /> :
           <TrendingUp className="w-3 h-3 text-gray-400" />}
          <span className={trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}>
            {trendValue}
          </span>
          <span className="text-gray-600 ml-1">vs last period</span>
        </div>
      </CardContent>
    </Card>
  );
}

function GraphStatItem({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: typeof Globe; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400', cyan: 'text-cyan-400', amber: 'text-amber-400',
    purple: 'text-purple-400', emerald: 'text-emerald-400',
  };
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${colorMap[color] || 'text-gray-400'}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <span className="text-xs font-semibold text-white">{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 2: ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════
function ArchitecturePage() {
  const archLayers = [
    {
      title: 'Data Ingestion Layer',
      subtitle: 'Log collection & preprocessing pipeline',
      color: 'from-blue-500 to-cyan-400',
      borderColor: 'border-blue-500/20',
      items: [
        { icon: Server, label: 'Wazuh EDR', desc: 'Endpoint detection & response telemetry' },
        { icon: Database, label: 'Syslog Server', desc: 'Centralized log aggregation' },
        { icon: Network, label: 'Network Flows', desc: 'NetFlow & packet capture data' },
        { icon: Globe, label: 'Threat Intel', desc: 'IoC feeds & threat intelligence' },
      ],
    },
    {
      title: 'Graph Construction Layer',
      subtitle: 'Temporal graph modeling engine',
      color: 'from-purple-500 to-violet-400',
      borderColor: 'border-purple-500/20',
      items: [
        { icon: Target, label: 'Node Extraction', desc: 'IP addresses, processes, users as nodes' },
        { icon: Network, label: 'Edge Creation', desc: 'Connections & communications as edges' },
        { icon: Clock, label: 'Temporal Windowing', desc: 'Sliding time windows for graph snapshots' },
        { icon: Cpu, label: 'Feature Engineering', desc: 'Node & edge attribute computation' },
      ],
    },
    {
      title: 'TGNN Model Layer',
      subtitle: 'Temporal Graph Neural Network core',
      color: 'from-amber-500 to-orange-400',
      borderColor: 'border-amber-500/20',
      items: [
        { icon: Brain, label: 'Graph Attention', desc: 'Multi-head attention on graph structure' },
        { icon: Zap, label: 'Temporal Encoding', desc: 'LSTM-based temporal pattern learning' },
        { icon: Activity, label: 'Message Passing', desc: '3-layer GNN message propagation' },
        { icon: Eye, label: 'Readout Layer', desc: 'Graph-level classification output' },
      ],
    },
    {
      title: 'Detection & Response Layer',
      subtitle: 'Threat classification & alerting',
      color: 'from-emerald-500 to-teal-400',
      borderColor: 'border-emerald-500/20',
      items: [
        { icon: Shield, label: 'Classifier', desc: 'Binary threat / normal classification' },
        { icon: AlertTriangle, label: 'Alert Engine', desc: 'Severity scoring & prioritization' },
        { icon: Search, label: 'Forensic Trace', desc: 'Attack path reconstruction' },
        { icon: Lock, label: 'Response', desc: 'Automated containment actions' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Architecture Flow Diagram */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-300">TGNN System Architecture</CardTitle>
          <CardDescription className="text-xs text-gray-500">End-to-end data flow from ingestion to detection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {archLayers.map((layer, i) => (
            <div key={i}>
              <div className={`rounded-xl border ${layer.borderColor} p-4 bg-[#0d1120]/50`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${layer.color} flex items-center justify-center shadow-lg`}>
                    <span className="text-white text-xs font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{layer.title}</h3>
                    <p className="text-[11px] text-gray-500">{layer.subtitle}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {layer.items.map((item, j) => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={j} className="rounded-lg bg-[#111827]/80 border border-gray-800/40 p-3 hover:border-gray-700/60 transition-colors">
                        <ItemIcon className={`w-4 h-4 mb-2 bg-gradient-to-r ${layer.color} bg-clip-text`} style={{ color: layer.color.includes('blue') ? '#3b82f6' : layer.color.includes('purple') ? '#8b5cf6' : layer.color.includes('amber') ? '#f59e0b' : '#10b981' }} />
                        <p className="text-xs font-medium text-gray-300">{item.label}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              {i < archLayers.length - 1 && (
                <div className="flex justify-center py-1.5">
                  <div className="flex items-center gap-1 text-gray-600">
                    <div className="w-px h-3 bg-gray-700" />
                    <ChevronRight className="w-3 h-3 rotate-90" />
                    <div className="w-px h-3 bg-gray-700" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Model Details & Graph Properties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* TGNN Model Config */}
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">TGNN Model Configuration</CardTitle>
            <CardDescription className="text-xs text-gray-500">Core hyperparameters and architecture specs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {[
                { label: 'Input', value: 'Temporal Graph Sequence (T x N x F)' },
                { label: 'Hidden Dimension', value: '128' },
                { label: 'Attention Heads', value: '8 (multi-head)' },
                { label: 'GNN Layers', value: '3 (with residual connections)' },
                { label: 'Temporal Encoder', value: 'LSTM (hidden=64)' },
                { label: 'Activation', value: 'GELU + LayerNorm' },
                { label: 'Dropout', value: '0.3' },
                { label: 'Output', value: 'Binary Classification (Threat/Normal)' },
                { label: 'Loss Function', value: 'Binary Cross-Entropy + Focal' },
                { label: 'Optimizer', value: 'AdamW (lr=1e-4, weight_decay=1e-5)' },
              ].map((param, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800/30 last:border-0">
                  <span className="text-xs text-gray-400">{param.label}</span>
                  <span className="text-xs font-mono text-blue-400">{param.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Graph Properties */}
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Graph Properties</CardTitle>
            <CardDescription className="text-xs text-gray-500">Node & edge type distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Node Type Pie */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">Node Type Distribution</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={nodeTypeData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" stroke="none">
                      {nodeTypeData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {nodeTypeData.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-gray-400">{item.name} ({item.value}%)</span>
                  </div>
                ))}
              </div>
            </div>
            <Separator className="bg-gray-800/60" />
            {/* Edge Type Bar */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">Edge Type Distribution</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={edgeTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                    <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 10 }} width={85} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 3: ANALYTICS
// ═══════════════════════════════════════════════════════════════════
function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Graph Score Over Time + Radar Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Graph Score Line */}
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Threat Graph Score Over Time</CardTitle>
            <CardDescription className="text-xs text-gray-500">Composite threat score derived from graph analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} domain={[40, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="graphScore" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 3 }} activeDot={{ r: 5, fill: '#8b5cf6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Model Comparison Radar */}
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Model Comparison</CardTitle>
            <CardDescription className="text-xs text-gray-500">TGNN vs baseline models across key metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={[
                  { metric: 'Accuracy', TGNN: 96.8, GCN: 89.3, GAT: 91.5, RF: 82.4 },
                  { metric: 'Precision', TGNN: 95.2, GCN: 87.6, GAT: 90.1, RF: 80.8 },
                  { metric: 'Recall', TGNN: 97.1, GCN: 91.0, GAT: 93.2, RF: 84.2 },
                  { metric: 'F1-Score', TGNN: 96.1, GCN: 89.3, GAT: 91.6, RF: 82.5 },
                ]}>
                  <PolarGrid stroke="#1f2937" />
                  <PolarAngleAxis dataKey="metric" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[70, 100]} stroke="#1f2937" tick={{ fontSize: 9 }} />
                  <Radar name="TGNN (Ours)" dataKey="TGNN" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} />
                  <Radar name="GCN" dataKey="GCN" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} strokeWidth={1.5} />
                  <Radar name="GAT" dataKey="GAT" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.05} strokeWidth={1.5} />
                  <Radar name="Random Forest" dataKey="RF" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.05} strokeWidth={1.5} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detection Scatter + Threat Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Confidence vs Graph Score Scatter */}
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Confidence vs Graph Score</CardTitle>
            <CardDescription className="text-xs text-gray-500">Detection confidence correlated with graph analysis score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="confidence" name="Confidence" stroke="#6b7280" tick={{ fontSize: 11 }} domain={[65, 100]} />
                  <YAxis dataKey="graphScore" name="Graph Score" stroke="#6b7280" tick={{ fontSize: 11 }} domain={[55, 100]} />
                  <ZAxis dataKey="confidence" range={[40, 200]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                  />
                  <Scatter name="Detections" data={detectionResults.map(d => ({ confidence: d.confidence, graphScore: d.graphScore }))} fill="#8b5cf6">
                    {detectionResults.map((d, i) => (
                      <Cell key={i} fill={d.severity === 'Critical' ? '#ef4444' : d.severity === 'High' ? '#f59e0b' : d.severity === 'Medium' ? '#3b82f6' : '#10b981'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Threat Timeline */}
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">APT Attack Timeline</CardTitle>
            <CardDescription className="text-xs text-gray-500">Reconstructed attack phases from graph analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 overflow-y-auto pr-2 space-y-2">
              {threatTimeline.map((phase, i) => (
                <div key={i} className="relative pl-6">
                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{
                    borderColor: phase.severity === 'Critical' ? '#ef4444' : phase.severity === 'High' ? '#f59e0b' : phase.severity === 'Medium' ? '#3b82f6' : '#10b981',
                  }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{
                      backgroundColor: phase.severity === 'Critical' ? '#ef4444' : phase.severity === 'High' ? '#f59e0b' : phase.severity === 'Medium' ? '#3b82f6' : '#10b981',
                    }} />
                  </div>
                  {i < threatTimeline.length - 1 && (
                    <div className="absolute left-[7px] top-5 w-px h-full bg-gray-800" />
                  )}
                  <div className="rounded-lg border border-gray-800/40 bg-[#0d1120]/50 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-gray-300">{phase.phase}</h4>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${severityColors[phase.severity]}`}>
                        {phase.severity}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Window {phase.start}–{phase.start + phase.duration}h &middot; Duration: {phase.duration}h
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(phase.duration / 5) * 100}%`,
                          backgroundColor: phase.severity === 'Critical' ? '#ef4444' : phase.severity === 'High' ? '#f59e0b' : phase.severity === 'Medium' ? '#3b82f6' : '#10b981',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Performance Comparison Bar Chart */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-300">Model Performance Comparison</CardTitle>
          <CardDescription className="text-xs text-gray-500">Accuracy, Precision, Recall, and F1-Score across all models</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} domain={[60, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy" radius={[2, 2, 0, 0]} />
                <Bar dataKey="precision" fill="#8b5cf6" name="Precision" radius={[2, 2, 0, 0]} />
                <Bar dataKey="recall" fill="#06b6d4" name="Recall" radius={[2, 2, 0, 0]} />
                <Bar dataKey="f1Score" fill="#f59e0b" name="F1-Score" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Network Event Activity Bar + Hourly Detection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Event Type Breakdown */}
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Event Type Breakdown</CardTitle>
            <CardDescription className="text-xs text-gray-500">Distribution of network events by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Normal', value: networkEvents.filter(e => e.eventType === 'normal').length },
                      { name: 'Suspicious', value: networkEvents.filter(e => e.eventType === 'suspicious').length },
                      { name: 'Malicious', value: networkEvents.filter(e => e.eventType === 'malicious').length },
                    ]}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" stroke="none"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Hourly Detection Rate */}
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Hourly Detection Rate</CardTitle>
            <CardDescription className="text-xs text-gray-500">Malicious events detected per hour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="malicious" name="Malicious Events" radius={[3, 3, 0, 0]}>
                    {timeSeriesData.map((entry, i) => (
                      <Cell key={i} fill={entry.malicious > 10 ? '#ef4444' : entry.malicious > 5 ? '#f59e0b' : '#f59e0b80'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 4: METHODOLOGY
// ═══════════════════════════════════════════════════════════════════
function MethodologyPage() {
  const objectives = [
    {
      title: 'Design TGNN Architecture',
      description: 'Develop a novel Temporal Graph Neural Network architecture that effectively captures both spatial graph relationships and temporal patterns in network telemetry data for accurate threat detection.',
      icon: Brain,
      status: 'Completed',
    },
    {
      title: 'Implement Graph Construction Pipeline',
      description: 'Build an automated pipeline that transforms raw network logs and EDR telemetry into temporal graph representations with meaningful node and edge features.',
      icon: Network,
      status: 'Completed',
    },
    {
      title: 'Detect Advanced Persistent Threats',
      description: 'Leverage the temporal graph structure to identify subtle, multi-stage attack patterns that traditional signature-based and statistical methods fail to detect.',
      icon: Shield,
      status: 'In Progress',
    },
    {
      title: 'Benchmark Against Baselines',
      description: 'Systematically compare TGNN performance against GCN, GAT, Random Forest, SVM, and MLP baselines using standardized metrics on the same datasets.',
      icon: BarChart3,
      status: 'In Progress',
    },
  ];

  const methodologySteps = [
    {
      phase: 'Phase 1: Data Collection & Preprocessing',
      steps: [
        'Collect network logs from Wazuh EDR, syslog servers, and NetFlow collectors',
        'Clean and normalize log formats across heterogeneous data sources',
        'Extract entity features: IP addresses, ports, protocols, timestamps, byte counts',
        'Apply temporal windowing to segment continuous data into discrete time steps',
      ],
      color: 'blue',
    },
    {
      phase: 'Phase 2: Graph Construction',
      steps: [
        'Map network entities (IPs, processes, users) to graph nodes',
        'Create directed edges representing network communications and relationships',
        'Encode temporal information as edge attributes (time delta, sequence order)',
        'Generate graph snapshots for each temporal window (sliding window approach)',
      ],
      color: 'purple',
    },
    {
      phase: 'Phase 3: Model Training & Optimization',
      steps: [
        'Implement TGNN with multi-head graph attention and LSTM temporal encoder',
        'Train on labeled synthetic APT scenarios with data augmentation techniques',
        'Optimize hyperparameters: learning rate, hidden dimensions, attention heads, dropout',
        'Apply focal loss to handle class imbalance between normal and threat samples',
      ],
      color: 'amber',
    },
    {
      phase: 'Phase 4: Evaluation & Analysis',
      steps: [
        'Evaluate on held-out test set with synthetic APT scenarios',
        'Compare against baseline models: GCN, GAT, Random Forest, SVM, MLP',
        'Analyze false positives/negatives and misclassification patterns',
        'Conduct ablation studies on temporal and graph components',
      ],
      color: 'emerald',
    },
  ];

  const techStack = [
    { category: 'Data Source', items: ['Wazuh EDR', 'Syslog', 'NetFlow', 'IoC Feeds'] },
    { category: 'Processing', items: ['Python', 'Pandas', 'NetworkX', 'PyTorch Geometric'] },
    { category: 'Model', items: ['PyTorch', 'PyG', 'Custom TGNN', 'LSTM'] },
    { category: 'Visualization', items: ['React', 'Recharts', 'Tailwind CSS', 'shadcn/ui'] },
    { category: 'Deployment', items: ['Docker', 'Next.js', 'REST API', 'WebSocket'] },
  ];

  const colorMap: Record<string, string> = {
    blue: '#3b82f6', purple: '#8b5cf6', amber: '#f59e0b', emerald: '#10b981',
  };

  return (
    <div className="space-y-6">
      {/* Problem Statement */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-300">Problem Statement</CardTitle>
          <CardDescription className="text-xs text-gray-500">The core challenge TGDetect addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-[#0d1120]/50 border border-gray-800/40 p-4 space-y-3">
            <p className="text-xs text-gray-300 leading-relaxed">
              Advanced Persistent Threats (APTs) represent one of the most sophisticated forms of cyberattacks, characterized by their prolonged, stealthy, and multi-stage nature. Traditional detection methods — signature-based systems, statistical anomaly detectors, and conventional machine learning classifiers — struggle to capture the complex, multi-step behavioral patterns inherent in APT campaigns. These methods typically analyze individual events in isolation, missing the critical contextual relationships between entities across time that are essential for identifying coordinated attack sequences.
            </p>
            <p className="text-xs text-gray-300 leading-relaxed">
              TGDetect addresses this fundamental limitation by modeling network telemetry as <span className="text-blue-400 font-medium">temporal graphs</span>, where nodes represent network entities (IPs, processes, users) and edges encode their interactions over time. Our <span className="text-purple-400 font-medium">Temporal Graph Neural Network (TGNN)</span> jointly learns structural graph patterns and temporal dynamics, enabling detection of threat behaviors that emerge only when analyzing relationships across multiple time steps.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Objectives */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-300">Research Objectives</CardTitle>
          <CardDescription className="text-xs text-gray-500">Key goals and deliverables for this project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {objectives.map((obj, i) => {
              const Icon = obj.icon;
              return (
                <div key={i} className="rounded-lg border border-gray-800/40 bg-[#0d1120]/50 p-4 hover:border-gray-700/60 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-gray-200">{obj.title}</h3>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                          obj.status === 'Completed' ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400'
                        }`}>
                          {obj.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{obj.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Methodology Phases */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-300">Research Methodology</CardTitle>
          <CardDescription className="text-xs text-gray-500">Four-phase approach from data collection to evaluation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {methodologySteps.map((phase, i) => (
            <div key={i} className="rounded-lg border border-gray-800/40 bg-[#0d1120]/50 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: colorMap[phase.color] }}
                >
                  {i + 1}
                </div>
                <h3 className="text-xs font-semibold text-gray-200">{phase.phase}</h3>
              </div>
              <div className="space-y-2 pl-10">
                {phase.steps.map((step, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: colorMap[phase.color] }} />
                    <p className="text-[11px] text-gray-400 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tech Stack */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-300">Technology Stack</CardTitle>
          <CardDescription className="text-xs text-gray-500">Tools and frameworks used in TGDetect</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {techStack.map((cat, i) => (
              <div key={i} className="rounded-lg border border-gray-800/40 bg-[#0d1120]/50 p-3">
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-2">{cat.category}</p>
                <div className="space-y-1">
                  {cat.items.map((item, j) => (
                    <div key={j} className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-blue-400" />
                      <span className="text-[11px] text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
