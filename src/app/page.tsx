'use client'

import { useState, useCallback } from 'react';
import {
  Shield, LayoutDashboard, BarChart3, Upload, UserCircle,
  ChevronRight, Activity, Network, Zap, Target, AlertTriangle,
  CheckCircle2, Clock, ShieldAlert, Brain, Database, Cpu,
  ArrowUpRight, ArrowDownRight, TrendingUp, Search,
  Globe, Lock, Eye, FileText, FolderOpen, Plus,
  Settings, Trash2, Download, FileUp, ChevronDown,
  Monitor, Terminal, Wifi, Braces, Table, FileJson,
  type LucideIcon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  generateTimeSeriesData, generateDetectionResults, generateModelMetrics,
  generateGraphStats, generateNetworkEvents, generateNodeTypeDistribution,
  generateThreatTimeline, generateEdgeTypeDistribution, generateProfiles,
  generateUploadedDatasets, supportedLogFormats,
  type DetectionResult, type UserProfile, type UploadedDataset
} from '@/lib/synthetic-data';

// ─── NAVIGATION ─────────────────────────────────────────────────
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'datasets', label: 'Datasets', icon: Database },
  { id: 'profiles', label: 'Profiles', icon: UserCircle },
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
const initialProfiles = generateProfiles();
const initialDatasets = generateUploadedDatasets();

const severityColors: Record<string, string> = {
  Low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  High: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Critical: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const statusIcons: Record<string, LucideIcon> = {
  Detected: Search,
  Investigating: Clock,
  Contained: ShieldAlert,
};

const CHART_TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#9ca3af' },
};

const formatIcon: Record<string, LucideIcon> = {
  table: Table,
  braces: Braces,
  'file-json': FileJson,
  terminal: Terminal,
  network: Wifi,
  shield: Shield,
  search: Search,
  globe: Globe,
  monitor: Monitor,
  'file-text': FileText,
  wifi: Wifi,
  'alert-triangle': AlertTriangle,
};

// ─── MAIN PAGE ──────────────────────────────────────────────────
export default function Home() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [profiles, setProfiles] = useState<UserProfile[]>(initialProfiles);
  const [datasets, setDatasets] = useState<UploadedDataset[]>(initialDatasets);
  const [activeProfile, setActiveProfile] = useState<string>(initialProfiles[0].id);
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [newProfileDataset, setNewProfileDataset] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleCreateProfile = useCallback(() => {
    if (!newProfileName.trim()) return;
    const profile: UserProfile = {
      id: `prof-${String(profiles.length + 1).padStart(3, '0')}`,
      name: newProfileName,
      description: newProfileDesc || 'No description provided.',
      dataset: newProfileDataset || 'Custom',
      status: 'inactive',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      config: { temporalWindow: 300, memoryDim: 64, numHeads: 4, nLayers: 2, embedDim: 64, threshold: 0.75 },
    };
    setProfiles(prev => [...prev, profile]);
    setNewProfileName('');
    setNewProfileDesc('');
    setNewProfileDataset('');
    setShowCreateProfile(false);
  }, [newProfileName, newProfileDesc, newProfileDataset, profiles.length]);

  const handleDeleteProfile = useCallback((id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (activeProfile === id && profiles.length > 1) {
      setActiveProfile(profiles.find(p => p.id !== id)?.id || '');
    }
  }, [activeProfile, profiles]);

  const handleSimulateUpload = useCallback(() => {
    const newDs: UploadedDataset = {
      id: `ds-${String(datasets.length + 1).padStart(3, '0')}`,
      name: `synthetic_demo_${Date.now()}.csv`,
      format: 'CSV',
      size: '12.4 MB',
      events: 52340,
      uploadedAt: new Date().toISOString(),
      status: 'processed',
      source: 'Synthetic Demo',
    };
    setDatasets(prev => [newDs, ...prev]);
    setShowUploadModal(false);
  }, [datasets.length]);

  return (
    <div className="flex h-screen bg-[#0a0e1a] text-gray-200 overflow-hidden">
      {/* ─── Sidebar ─── */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-800/80 bg-[#0d1120] flex flex-col">
        <div className="p-5 border-b border-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">TGDetect</h1>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">V16 Apex TGNN</p>
            </div>
          </div>
        </div>

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

        {/* Active Profile Indicator */}
        <div className="px-4 pb-3">
          <div className="rounded-lg border border-gray-800/60 bg-[#111827]/50 p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1.5">Active Profile</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-gray-300 truncate">
                {profiles.find(p => p.id === activeProfile)?.name || 'None'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800/80">
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500">Demo Mode — Synthetic Data</span>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 border-b border-gray-800/60 bg-[#0a0e1a]/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {navItems.find(n => n.id === activePage)?.label}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {activePage === 'dashboard' && 'System overview and key performance indicators'}
              {activePage === 'analytics' && 'Detection analytics with synthetic network data'}
              {activePage === 'datasets' && 'Upload and manage log datasets for analysis'}
              {activePage === 'profiles' && 'Create and manage analysis profiles'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs px-2.5">
              <Activity className="w-3 h-3 mr-1" />
              V16 Apex
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
          {activePage === 'analytics' && <AnalyticsPage />}
          {activePage === 'datasets' && (
            <DatasetsPage
              datasets={datasets}
              onUploadClick={() => setShowUploadModal(true)}
            />
          )}
          {activePage === 'profiles' && (
            <ProfilesPage
              profiles={profiles}
              activeProfile={activeProfile}
              onSelectProfile={setActiveProfile}
              onCreateClick={() => setShowCreateProfile(true)}
              onDeleteProfile={handleDeleteProfile}
            />
          )}
        </div>
      </main>

      {/* ─── Upload Modal ─── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowUploadModal(false)}>
          <div className="bg-[#111827] border border-gray-800/80 rounded-2xl w-full max-w-2xl shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800/60">
              <div>
                <h3 className="text-sm font-semibold text-white">Upload Log Dataset</h3>
                <p className="text-xs text-gray-500 mt-0.5">Select a file or drag & drop your log data</p>
              </div>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => setShowUploadModal(false)}>✕</Button>
            </div>
            <div className="p-5 space-y-5">
              {/* Drop Zone */}
              <div
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                  dragOver ? 'border-blue-400 bg-blue-500/5' : 'border-gray-700 hover:border-gray-600'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleSimulateUpload(); }}
                onClick={handleSimulateUpload}
              >
                <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-blue-400' : 'text-gray-600'}`} />
                <p className="text-sm text-gray-300 font-medium">
                  {dragOver ? 'Drop your file here' : 'Drag & drop your log file, or click to browse'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Supports CSV, JSON, JSONL, Syslog, NetFlow, and more</p>
              </div>

              {/* Supported Formats */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Supported Log Formats</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {supportedLogFormats.slice(0, 9).map((fmt, i) => {
                    const FmtIcon = formatIcon[fmt.icon] || FileText;
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-800/40 bg-[#0d1120]/50 px-3 py-2">
                        <FmtIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] font-medium text-gray-300">{fmt.name}</p>
                          <p className="text-[9px] text-gray-600">{fmt.ext}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => setShowUploadModal(false)}>Cancel</Button>
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleSimulateUpload}>
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Dataset
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Profile Modal ─── */}
      {showCreateProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateProfile(false)}>
          <div className="bg-[#111827] border border-gray-800/80 rounded-2xl w-full max-w-lg shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800/60">
              <div>
                <h3 className="text-sm font-semibold text-white">Create New Profile</h3>
                <p className="text-xs text-gray-500 mt-0.5">Set up a new analysis profile for your dataset</p>
              </div>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => setShowCreateProfile(false)}>✕</Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Profile Name</Label>
                <Input
                  placeholder="e.g., DARPA Engagement Analysis"
                  value={newProfileName}
                  onChange={e => setNewProfileName(e.target.value)}
                  className="bg-[#0d1120] border-gray-800/60 text-sm text-gray-200 placeholder:text-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Description</Label>
                <Input
                  placeholder="Brief description of this profile..."
                  value={newProfileDesc}
                  onChange={e => setNewProfileDesc(e.target.value)}
                  className="bg-[#0d1120] border-gray-800/60 text-sm text-gray-200 placeholder:text-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Dataset Type</Label>
                <Input
                  placeholder="e.g., DARPA TC, UNSW-NB15, LANL, Custom..."
                  value={newProfileDataset}
                  onChange={e => setNewProfileDataset(e.target.value)}
                  className="bg-[#0d1120] border-gray-800/60 text-sm text-gray-200 placeholder:text-gray-600"
                />
              </div>
              <div className="rounded-lg border border-gray-800/40 bg-[#0d1120]/50 p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">Default V16 Apex Configuration</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Temporal Window', value: '300s' },
                    { label: 'Memory Dim', value: '64' },
                    { label: 'Attention Heads', value: '4' },
                    { label: 'GNN Layers', value: '2' },
                    { label: 'Embed Dim', value: '64' },
                    { label: 'Threshold', value: '0.75' },
                  ].map((c, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="text-gray-500">{c.label}</span>
                      <span className="text-blue-400 font-mono">{c.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => setShowCreateProfile(false)}>Cancel</Button>
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleCreateProfile}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Profile
              </Button>
            </div>
          </div>
        </div>
      )}
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
        <StatCard title="Total Detections" value={totalThreats.toString()} subtitle="Last 24 hours" icon={ShieldAlert} trend="up" trendValue="+12%" color="blue" />
        <StatCard title="Critical Alerts" value={criticalCount.toString()} subtitle="Requires attention" icon={AlertTriangle} trend="up" trendValue="+3" color="red" />
        <StatCard title="Threats Contained" value={contained.toString()} subtitle={`${Math.round(contained / totalThreats * 100)}% containment rate`} icon={CheckCircle2} trend="up" trendValue="+8%" color="emerald" />
        <StatCard title="Avg. Confidence" value={`${avgConfidence}%`} subtitle="V16 Apex model confidence" icon={Brain} trend="stable" trendValue="0.989 F1" color="purple" />
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
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="normal" stackId="1" stroke="#3b82f6" fill="url(#gradNormal)" strokeWidth={2} name="Normal" />
                  <Area type="monotone" dataKey="suspicious" stackId="1" stroke="#f59e0b" fill="url(#gradSuspicious)" strokeWidth={2} name="Suspicious" />
                  <Area type="monotone" dataKey="malicious" stackId="1" stroke="#ef4444" fill="url(#gradMalicious)" strokeWidth={2} name="Malicious" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Graph Statistics */}
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Graph Statistics</CardTitle>
            <CardDescription className="text-xs text-gray-500">V16 Apex temporal graph snapshot</CardDescription>
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
              <CardDescription className="text-xs text-gray-500">Latest V16 Apex threat detection results</CardDescription>
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
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">MITRE Tactic</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Severity</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Source</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Confidence</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Graph Score</th>
                  <th className="text-left text-gray-500 font-medium py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {detectionResults.slice(0, 8).map((d) => {
                  const StatusIcon = statusIcons[d.status] || CheckCircle2;
                  return (
                    <tr key={d.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                      <td className="py-2 pr-4 font-mono text-blue-400">{d.id}</td>
                      <td className="py-2 pr-4 text-gray-400">{new Date(d.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 pr-4">
                        <span className="text-gray-300">{d.tactic}</span>
                        <span className="text-gray-600 ml-1.5">({d.attackType})</span>
                      </td>
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
                          <StatusIcon className={`w-3 h-3 ${d.status === 'Detected' ? 'text-amber-400' : d.status === 'Investigating' ? 'text-blue-400' : 'text-emerald-400'}`} />
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

// ─── SHARED COMPONENTS ────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, color }: {
  title: string; value: string; subtitle: string; icon: LucideIcon;
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
    <Card className="bg-[#111827]/80 border-gray-800/60 hover:border-gray-700/60 transition-colors">
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
  label: string; value: string; icon: LucideIcon; color: string;
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
// PAGE 2: ANALYTICS
// ═══════════════════════════════════════════════════════════════════
function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Graph Score + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Threat Graph Score Over Time</CardTitle>
            <CardDescription className="text-xs text-gray-500">Composite threat score derived from temporal graph analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} domain={[40, 100]} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="graphScore" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 3 }} activeDot={{ r: 5, fill: '#8b5cf6' }} name="Graph Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">Model Comparison (F1-Score & ROC-AUC)</CardTitle>
            <CardDescription className="text-xs text-gray-500">V16 Apex vs baseline models on 1M OOD events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelMetrics} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }} domain={[0, 1]} />
                  <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [typeof v === 'number' ? v.toFixed(3) : v, '']} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="f1Score" name="F1-Score" fill="#8b5cf6" radius={[0, 3, 3, 0]} barSize={12} />
                  <Bar dataKey="rocAuc" name="ROC-AUC" fill="#06b6d4" radius={[0, 3, 3, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scatter + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    {...CHART_TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                  />
                  <Scatter name="Detections" data={detectionResults.map(d => ({ confidence: d.confidence, graphScore: d.graphScore, severity: d.severity }))} fill="#8b5cf6">
                    {detectionResults.map((d, i) => (
                      <Cell key={i} fill={d.severity === 'Critical' ? '#ef4444' : d.severity === 'High' ? '#f59e0b' : d.severity === 'Medium' ? '#3b82f6' : '#10b981'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111827]/80 border-gray-800/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-300">APT Attack Timeline (MITRE ATT&CK)</CardTitle>
            <CardDescription className="text-xs text-gray-500">Reconstructed attack phases from V16 Apex causal analysis</CardDescription>
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
                      <div className="h-full rounded-full" style={{
                        width: `${(phase.duration / 5) * 100}%`,
                        backgroundColor: phase.severity === 'Critical' ? '#ef4444' : phase.severity === 'High' ? '#f59e0b' : phase.severity === 'Medium' ? '#3b82f6' : '#10b981',
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Performance Grouped Bar */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-300">V16 Apex Performance Breakdown</CardTitle>
          <CardDescription className="text-xs text-gray-500">Precision, Recall, F1-Score, and ROC-AUC across all models</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} domain={[0, 1.05]} />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [typeof v === 'number' ? v.toFixed(3) : v, '']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="precision" name="Precision" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="recall" name="Recall" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="f1Score" name="F1-Score" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                <Bar dataKey="rocAuc" name="ROC-AUC" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Event Breakdown + Hourly Detection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

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
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
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
// PAGE 3: DATASETS
// ═══════════════════════════════════════════════════════════════════
function DatasetsPage({ datasets, onUploadClick }: {
  datasets: UploadedDataset[];
  onUploadClick: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Upload Banner */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Upload Log Dataset</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Upload network logs in CSV, JSON, Syslog, NetFlow, Wazuh, Zeek, or other supported formats for TGNN analysis.
              </p>
            </div>
          </div>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={onUploadClick}>
            <FileUp className="w-4 h-4 mr-2" /> Upload Dataset
          </Button>
        </CardContent>
      </Card>

      {/* Quick Upload Formats */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-300">Supported Log Formats</CardTitle>
          <CardDescription className="text-xs text-gray-500">TGDetect V16 Apex supports the following data ingestion formats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {supportedLogFormats.map((fmt, i) => {
              const FmtIcon = formatIcon[fmt.icon] || FileText;
              return (
                <div key={i} className="rounded-lg border border-gray-800/40 bg-[#0d1120]/50 p-3 hover:border-gray-700/60 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <FmtIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-gray-300">{fmt.name}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{fmt.desc}</p>
                  <p className="text-[9px] text-blue-400/60 mt-1 font-mono">{fmt.ext}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Datasets Table */}
      <Card className="bg-[#111827]/80 border-gray-800/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-gray-300">Loaded Datasets</CardTitle>
              <CardDescription className="text-xs text-gray-500">Currently loaded log datasets for analysis</CardDescription>
            </div>
            <Badge variant="outline" className="border-gray-700 text-gray-400 text-xs">{datasets.length} datasets</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800/60">
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Dataset</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Format</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Size</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Events</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Source</th>
                  <th className="text-left text-gray-500 font-medium py-2 pr-4">Uploaded</th>
                  <th className="text-left text-gray-500 font-medium py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds) => (
                  <tr key={ds.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-gray-300 font-medium">{ds.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant="outline" className="border-gray-700 text-gray-400 text-[10px] px-1.5">{ds.format}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">{ds.size}</td>
                    <td className="py-2.5 pr-4 text-gray-400">{ds.events.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-gray-400">{ds.source}</td>
                    <td className="py-2.5 pr-4 text-gray-400">{new Date(ds.uploadedAt).toLocaleDateString()}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${ds.status === 'processed' ? 'bg-emerald-400' : ds.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'}`} />
                        <span className="text-gray-400 capitalize">{ds.status}</span>
                      </div>
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

// ═══════════════════════════════════════════════════════════════════
// PAGE 4: PROFILES
// ═══════════════════════════════════════════════════════════════════
function ProfilesPage({ profiles, activeProfile, onSelectProfile, onCreateClick, onDeleteProfile }: {
  profiles: UserProfile[];
  activeProfile: string;
  onSelectProfile: (id: string) => void;
  onCreateClick: () => void;
  onDeleteProfile: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header with Create */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Analysis Profiles</h3>
          <p className="text-xs text-gray-500 mt-0.5">Create profiles to manage different datasets and configurations</p>
        </div>
        <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={onCreateClick}>
          <Plus className="w-4 h-4 mr-1.5" /> Create Profile
        </Button>
      </div>

      {/* Profile Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfile;
          return (
            <Card key={profile.id} className={`bg-[#111827]/80 border transition-colors ${
              isActive ? 'border-blue-500/40 shadow-lg shadow-blue-500/5' : 'border-gray-800/60 hover:border-gray-700/60'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <UserCircle className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-600'}`} />
                    <CardTitle className="text-sm font-semibold text-gray-200">{profile.name}</CardTitle>
                  </div>
                  {isActive && (
                    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[9px]">Active</Badge>
                  )}
                </div>
                <CardDescription className="text-[11px] text-gray-500">{profile.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[#0d1120]/50 border border-gray-800/30 px-2.5 py-1.5">
                    <p className="text-[9px] text-gray-600 uppercase">Dataset</p>
                    <p className="text-[11px] text-gray-300 font-medium">{profile.dataset}</p>
                  </div>
                  <div className="rounded-lg bg-[#0d1120]/50 border border-gray-800/30 px-2.5 py-1.5">
                    <p className="text-[9px] text-gray-600 uppercase">Modified</p>
                    <p className="text-[11px] text-gray-300 font-medium">{new Date(profile.lastModified).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Config Preview */}
                <div>
                  <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1.5">V16 Apex Config</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Window', value: `${profile.config.temporalWindow}s` },
                      { label: 'Heads', value: profile.config.numHeads.toString() },
                      { label: 'Layers', value: profile.config.nLayers.toString() },
                      { label: 'Memory', value: profile.config.memoryDim.toString() },
                      { label: 'Embed', value: profile.config.embedDim.toString() },
                      { label: 'Threshold', value: profile.config.threshold.toString() },
                    ].map((c, i) => (
                      <div key={i} className="rounded bg-[#0a0e1a] px-1.5 py-1 text-center">
                        <p className="text-[8px] text-gray-600">{c.label}</p>
                        <p className="text-[10px] text-blue-400 font-mono">{c.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 text-[10px] h-7 ${
                      isActive ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' : 'border-gray-700 text-gray-400'
                    }`}
                    onClick={() => onSelectProfile(profile.id)}
                  >
                    {isActive ? 'Currently Active' : 'Set Active'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-red-400 h-7 w-7 p-0"
                    onClick={() => onDeleteProfile(profile.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Empty State - Create Card */}
        {profiles.length === 0 && (
          <Card className="bg-[#111827]/40 border-gray-800/40 border-dashed lg:col-span-3">
            <CardContent className="p-8 flex flex-col items-center justify-center text-center">
              <UserCircle className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">No profiles yet</p>
              <p className="text-xs text-gray-600 mt-1">Create a profile to start analyzing different datasets</p>
              <Button className="mt-4 bg-blue-500 hover:bg-blue-600 text-white text-xs" onClick={onCreateClick}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Your First Profile
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
