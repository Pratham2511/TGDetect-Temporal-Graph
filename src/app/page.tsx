'use client'

import { useState, useCallback, useEffect } from 'react';
import {
  Shield, LayoutDashboard, BarChart3, Upload, UserCircle,
  ChevronRight, Activity, Network, Zap, Target, AlertTriangle,
  CheckCircle2, Clock, ShieldAlert, Brain, Database,
  ArrowUpRight, ArrowDownRight, TrendingUp, Search,
  Globe, FileText, Plus,
  Trash2, FileUp,
  Monitor, Terminal, Wifi, Braces, Table, FileJson,
  Sun, Moon, GitBranch, Cpu,
  type LucideIcon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  generateTimeSeriesData, generateDetectionResults,
  generateGraphStats, generateNetworkEvents,
  generateProfiles, generateUploadedDatasets, supportedLogFormats,
  type DetectionResult, type UserProfile, type UploadedDataset
} from '@/lib/synthetic-data';
import { formatTime, formatDate } from '@/lib/date-utils';
import { AnalyticsPage } from '@/components/tgdetect/AnalyticsPage';
import { TimeRangePicker } from '@/components/tgdetect/TimeRangePicker';
import { ColumnMappingModal } from '@/components/tgdetect/ColumnMappingModal';
import { useTheme } from '@/lib/theme-context';
import { OnboardingTour } from '@/components/tgdetect/OnboardingTour';
import { useLiveStream, type LiveMetrics } from '@/hooks/useLiveStream';

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
const graphStats = generateGraphStats();
const networkEvents = generateNetworkEvents(200);
const initialProfiles = generateProfiles();
const initialDatasets = generateUploadedDatasets();

const severityColors: Record<string, string> = {
  Low: 'badge-success',
  Medium: 'badge-warning',
  High: 'badge-warning',
  Critical: 'badge-danger',
};

const statusIcons: Record<string, LucideIcon> = {
  Detected: Search,
  Investigating: Clock,
  Contained: ShieldAlert,
};

const formatIcon: Record<string, LucideIcon> = {
  table: Table, braces: Braces, 'file-json': FileJson, terminal: Terminal,
  network: Wifi, shield: Shield, search: Search, globe: Globe,
  monitor: Monitor, 'file-text': FileText, wifi: Wifi, 'alert-triangle': AlertTriangle,
};

// ─── CHART CONSTANTS ────────────────────────────────────────────
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

// ─── MAIN PAGE ──────────────────────────────────────────────────
export default function Home() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [profiles, setProfiles] = useState<UserProfile[]>(initialProfiles);
  const [datasets, setDatasets] = useState<UploadedDataset[]>(initialDatasets);
  const [activeProfile, setActiveProfile] = useState<string>(initialProfiles[0].id);
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [showTour, setShowTour] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [newProfileDataset, setNewProfileDataset] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '12h' | '24h' | '7d' | '30d'>('24h');
  const { theme, toggleTheme } = useTheme();
  const { metrics, feedItems } = useLiveStream();

  useEffect(() => {
    if (!localStorage.getItem('tgdetect-tour-completed')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage once on mount to avoid hydration mismatch
      setShowTour(true);
    }
  }, []);

  const handleTourComplete = useCallback(() => {
    setShowTour(false);
    localStorage.setItem('tgdetect-tour-completed', 'true');
  }, []);

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
    setNewProfileName(''); setNewProfileDesc(''); setNewProfileDataset('');
    setShowCreateProfile(false);
  }, [newProfileName, newProfileDesc, newProfileDataset, profiles.length]);

  const handleDeleteProfile = useCallback((id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (activeProfile === id && profiles.length > 1) {
      setActiveProfile(profiles.find(p => p.id !== id)?.id || '');
    }
  }, [activeProfile, profiles]);

  const handleFileSelected = useCallback(() => {
    const fileName = `network_logs_${Date.now()}.csv`;
    setUploadedFileName(fileName);
    setShowUploadModal(false);
    setShowColumnMapping(true);
  }, []);

  const handleMappingComplete = useCallback(() => {
    const newDs: UploadedDataset = {
      id: `ds-${String(datasets.length + 1).padStart(3, '0')}`,
      name: uploadedFileName,
      format: 'CSV', size: '12.4 MB', events: 523340,
      uploadedAt: new Date().toISOString(),
      status: 'processed', source: 'Uploaded',
    };
    setDatasets(prev => [newDs, ...prev]);
    setShowColumnMapping(false);
  }, [uploadedFileName, datasets.length]);

  return (
    <div className="flex h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] overflow-hidden">
      {/* ─── Sidebar ─── */}
      <aside className="sidebar-shell w-64 flex-shrink-0 flex flex-col">
        <div className="p-5 border-b border-[hsl(var(--sidebar-border))]">
          <div id="tour-sidebar" data-tour="welcome" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-[hsl(var(--sidebar-text-active))]">TGDetect</h1>
              <p className="text-[10px] font-medium text-[hsl(var(--sidebar-logo-sub))] uppercase tracking-widest">V16 Apex TGNN</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button key={item.id} id={`nav-${item.id}`} data-tour={`nav-${item.id}`} onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-l-[3px] text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--sidebar-item-active))] text-[hsl(var(--sidebar-text-active))]'
                    : 'border-transparent text-[hsl(var(--sidebar-text))] hover:bg-[hsl(var(--sidebar-item-hover))] hover:text-[hsl(var(--sidebar-text-active))]'
                }`
              }
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[hsl(var(--sidebar-text-active))]' : ''}`} />
                {item.label}
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-[hsl(var(--sidebar-text-active))] opacity-60" />}
              </button>
            );
          })}
        </nav>

        <div className="px-4 pb-3">
          <div className="tg-card p-3">
            <p className="text-[10px] text-[hsl(var(--sidebar-text))] uppercase tracking-wider font-medium mb-1.5">Active Profile</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-[hsl(var(--sidebar-text-active))] truncate">
                {profiles.find(p => p.id === activeProfile)?.name || 'None'}
              </span>
            </div>
          </div>
        </div>

        <div data-tour="live-metrics" className="p-4 border-t border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-2 px-2">
            <div className="relative flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <div className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </div>
            <span className="text-xs text-[hsl(var(--sidebar-text))] opacity-70">Live Demo — Synthetic Stream</span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('tgdetect-tour-completed');
              setShowTour(true);
            }}
            className="text-[10px] text-[hsl(var(--sidebar-text))] hover:text-[hsl(var(--sidebar-text-active))] transition-colors w-full text-center mt-1"
          >
            Restart Tour
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto">
        <header className="header-shell sticky top-0 z-10 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
              {navItems.find(n => n.id === activePage)?.label}
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {activePage === 'dashboard' && 'System overview and key performance indicators'}
              {activePage === 'analytics' && 'Detection analytics — per-source, fused, and objective analysis'}
              {activePage === 'datasets' && 'Upload and manage log datasets for analysis'}
              {activePage === 'profiles' && 'Create and manage analysis profiles'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-lg border transition-all hover:bg-[hsl(var(--card-hover))]" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
              {theme === 'dark' ? <Sun className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} /> : <Moon className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} />}
            </button>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs px-2.5">
              <Activity className="w-3 h-3 mr-1" /> V16 Apex
            </Badge>
            <Badge variant="outline" className="border-[hsl(var(--border-light))] text-[hsl(var(--muted-foreground))] text-xs px-2.5">
              <Database className="w-3 h-3 mr-1" /> Synthetic Data
            </Badge>
          </div>
        </header>

        <div className="p-6">
          {activePage === 'dashboard' && <DashboardPage liveMetrics={metrics} liveFeed={feedItems} timeRange={timeRange} onTimeRangeChange={setTimeRange} />}
          {activePage === 'analytics' && <AnalyticsPage timeRange={timeRange} onTimeRangeChange={setTimeRange} />}
          {activePage === 'datasets' && <DatasetsPage datasets={datasets} onUploadClick={() => setShowUploadModal(true)} />}
          {activePage === 'profiles' && <ProfilesPage profiles={profiles} activeProfile={activeProfile} onSelectProfile={setActiveProfile} onCreateClick={() => setShowCreateProfile(true)} onDeleteProfile={handleDeleteProfile} />}
        </div>
      </main>

      {/* ─── Upload Modal ─── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowUploadModal(false)}>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl w-full max-w-2xl shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Upload Log Dataset</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Select a file or drag & drop your log data</p>
              </div>
              <Button variant="ghost" size="sm" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => setShowUploadModal(false)}>✕</Button>
            </div>
            <div className="p-5 space-y-5">
              <div className={`tg-card p-8 text-center transition-all cursor-pointer ${dragOver ? '!border-blue-400 !bg-blue-500/5' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelected(); }}
                onClick={handleFileSelected}
              >
                <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-blue-400' : 'text-[hsl(var(--muted-foreground))]'}`} />
                <p className="text-sm text-[hsl(var(--muted-foreground))] font-medium">{dragOver ? 'Drop your file here' : 'Drag & drop your log file, or click to browse'}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] opacity-70 mt-1">Supports CSV, JSON, Syslog, NetFlow, Wazuh, and more</p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium mb-3">Supported Log Formats</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {supportedLogFormats.slice(0, 9).map((fmt, i) => {
                    const FmtIcon = formatIcon[fmt.icon] || FileText;
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border-light))] bg-[hsl(var(--secondary))] px-3 py-2">
                        <FmtIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{fmt.name}</p>
                          <p className="text-[9px] text-[hsl(var(--muted-foreground))] opacity-70">{fmt.ext}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <Button variant="ghost" size="sm" className="text-[hsl(var(--muted-foreground))]" onClick={() => setShowUploadModal(false)}>Cancel</Button>
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleFileSelected}>
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Dataset
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Column Mapping Modal ─── */}
      {showColumnMapping && (
        <ColumnMappingModal
          fileName={uploadedFileName}
          onClose={() => setShowColumnMapping(false)}
          onComplete={handleMappingComplete}
        />
      )}

      {/* ─── Create Profile Modal ─── */}
      {showCreateProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateProfile(false)}>
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl w-full max-w-lg shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Create New Profile</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Set up a new analysis profile for your dataset</p>
              </div>
              <Button variant="ghost" size="sm" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={() => setShowCreateProfile(false)}>✕</Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-[hsl(var(--muted-foreground))]">Profile Name</Label>
                <Input placeholder="e.g., DARPA Engagement Analysis" value={newProfileName} onChange={e => setNewProfileName(e.target.value)}
                  className="bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[hsl(var(--muted-foreground))]">Description</Label>
                <Input placeholder="Brief description..." value={newProfileDesc} onChange={e => setNewProfileDesc(e.target.value)}
                  className="bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[hsl(var(--muted-foreground))]">Dataset Type</Label>
                <Input placeholder="e.g., DARPA TC, UNSW-NB15, LANL..." value={newProfileDataset} onChange={e => setNewProfileDataset(e.target.value)}
                  className="bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]" />
              </div>
              <div className="tg-card p-3">
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium mb-2">Default V16 Apex Configuration</p>
                <div className="grid grid-cols-2 gap-2">
                  {[{ label: 'Temporal Window', value: '300s' }, { label: 'Memory Dim', value: '64' }, { label: 'Attention Heads', value: '4' }, { label: 'GNN Layers', value: '2' }, { label: 'Embed Dim', value: '64' }, { label: 'Threshold', value: '0.75' }].map((c, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="text-[hsl(var(--muted-foreground))]">{c.label}</span>
                      <span className="text-blue-400 font-mono">{c.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <Button variant="ghost" size="sm" className="text-[hsl(var(--muted-foreground))]" onClick={() => setShowCreateProfile(false)}>Cancel</Button>
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleCreateProfile}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTour && <OnboardingTour onComplete={handleTourComplete} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function DashboardPage({ liveMetrics, liveFeed, timeRange, onTimeRangeChange }: {
  liveMetrics: LiveMetrics;
  liveFeed: Array<{ id: string; type: 'detection' | 'ingestion' | 'alert' | 'system'; message: string; timestamp: string; source?: string }>;
  timeRange: string;
  onTimeRangeChange: (r: '1h' | '6h' | '12h' | '24h' | '7d' | '30d') => void;
}) {
  const totalThreats = detectionResults.length;
  const criticalCount = detectionResults.filter(d => d.severity === 'Critical').length;
  const contained = detectionResults.filter(d => d.status === 'Contained').length;
  const avgConfidence = Math.round(detectionResults.reduce((a, d) => a + d.confidence, 0) / detectionResults.length * 10) / 10;

  return (
    <div className="space-y-6">
      {/* ── System Pulse Bar ── */}
      <div id="live-metrics" data-tour="live-metrics" className="tg-card p-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </div>
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">System Active</span>
            <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20 text-[10px]">Ingesting</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Events/s</span>
              <span className="text-xs font-semibold text-[hsl(var(--foreground))] tabular-nums">{liveMetrics.eventsPerSecond.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Total Events</span>
              <span className="text-xs font-semibold text-[hsl(var(--foreground))] tabular-nums">{(liveMetrics.totalEvents / 1_000_000).toFixed(2)}M</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Active Nodes</span>
              <span className="text-xs font-semibold text-[hsl(var(--foreground))] tabular-nums">{liveMetrics.activeNodes.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Edges</span>
              <span className="text-xs font-semibold text-[hsl(var(--foreground))] tabular-nums">{liveMetrics.graphEdges.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Memory</span>
              <div className="w-16 h-1.5 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-1000" style={{ width: `${liveMetrics.memoryUsage}%` }} />
              </div>
              <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">{liveMetrics.memoryUsage.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div id="dashboard-kpis" data-tour="dashboard-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Detections" value={totalThreats.toString()} subtitle="Last 24 hours" icon={ShieldAlert} trend="up" trendValue="+12%" color="blue" />
        <StatCard title="Critical Alerts" value={criticalCount.toString()} subtitle="Requires attention" icon={AlertTriangle} trend="up" trendValue="+3" color="red" />
        <StatCard title="Threats Contained" value={contained.toString()} subtitle={`${Math.round(contained / totalThreats * 100)}% containment rate`} icon={CheckCircle2} trend="up" trendValue="+8%" color="emerald" />
        <StatCard title="Avg. Confidence" value={`${avgConfidence}%`} subtitle="V16 Apex model confidence" icon={Brain} trend="stable" trendValue="0.989 F1" color="purple" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Traffic Overview */}
        <Card className="lg:col-span-2 bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">Network Traffic Overview</CardTitle>
                <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">
                  Event distribution by type — {timeRange === 'custom' ? 'Custom' : `Last ${timeRange}`}
                </CardDescription>
              </div>
              <TimeRangePicker value={timeRange as '1h' | '6h' | '12h' | '24h' | '7d' | '30d'} onChange={onTimeRangeChange} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="gradNormal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.cyan} stopOpacity={0.3} /><stop offset="100%" stopColor={CHART_COLORS.cyan} stopOpacity={0} /></linearGradient>
                    <linearGradient id="gradSuspicious" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.3} /><stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0} /></linearGradient>
                    <linearGradient id="gradMalicious" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.red} stopOpacity={0.3} /><stop offset="100%" stopColor={CHART_COLORS.red} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid {...CHART_GRID_STYLE} />
                  <XAxis {...CHART_AXIS_STYLE} dataKey="time" />
                  <YAxis {...CHART_AXIS_STYLE} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="normal" stackId="1" stroke={CHART_COLORS.cyan} fill="url(#gradNormal)" strokeWidth={2} name="Normal" />
                  <Area type="monotone" dataKey="suspicious" stackId="1" stroke={CHART_COLORS.amber} fill="url(#gradSuspicious)" strokeWidth={2} name="Suspicious" />
                  <Area type="monotone" dataKey="malicious" stackId="1" stroke={CHART_COLORS.red} fill="url(#gradMalicious)" strokeWidth={2} name="Malicious" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Graph Statistics */}
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">Graph Statistics</CardTitle>
            <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">V16 Apex temporal graph snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <GraphStatItem label="Total Nodes" value={graphStats.totalNodes.toString()} icon={Globe} color="blue" />
            <GraphStatItem label="Total Edges" value={graphStats.totalEdges.toLocaleString()} icon={Network} color="cyan" />
            <GraphStatItem label="Temporal Windows" value={graphStats.temporalWindows.toString()} icon={Clock} color="amber" />
            <GraphStatItem label="Clustering Coeff." value={graphStats.avgClusteringCoeff.toFixed(3)} icon={Target} color="purple" />
            <GraphStatItem label="Graph Density" value={graphStats.graphDensity.toFixed(4)} icon={Zap} color="emerald" />
            <Separator className="bg-[hsl(var(--border))]" />
            <div className="pt-1">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[hsl(var(--muted-foreground))]">Processing Load</span>
                <span className="text-emerald-400 font-medium">34%</span>
              </div>
              <Progress value={34} className="h-2 bg-[hsl(var(--secondary))] [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-cyan-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Detections Table */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">Recent Detections</CardTitle>
              <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">Latest V16 Apex threat detection results</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TimeRangePicker value={timeRange as '1h' | '6h' | '12h' | '24h' | '7d' | '30d'} onChange={onTimeRangeChange} />
              <Badge variant="outline" className="border-[hsl(var(--border-light))] text-[hsl(var(--muted-foreground))] text-xs">{detectionResults.length} total</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">ID</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Timestamp</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">MITRE Tactic</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Severity</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Source</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Confidence</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Graph Score</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {detectionResults.slice(0, 8).map((d) => {
                  const StatusIcon = statusIcons[d.status] || CheckCircle2;
                  return (
                    <tr key={d.id} className="border-b border-[hsl(var(--border-light))] hover:bg-[hsl(var(--card-hover))] transition-colors">
                      <td className="py-2 pr-4 font-mono text-blue-400">{d.id}</td>
                      <td className="py-2 pr-4 text-[hsl(var(--muted-foreground))] font-mono">{formatTime(d.timestamp)}</td>
                      <td className="py-2 pr-4">
                        <span className="text-[hsl(var(--muted-foreground))]">{d.tactic}</span>
                        <span className="text-[hsl(var(--muted-foreground))] opacity-70 ml-1.5">({d.attackType})</span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`text-[10px] px-1.5 py-0 border rounded ${severityColors[d.severity]}`}>{d.severity}</span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-[hsl(var(--muted-foreground))]">{d.sourceNode}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Progress value={d.confidence} className="w-12 h-1.5 bg-[hsl(var(--secondary))] [&>div]:bg-blue-500" />
                          <span className="text-[hsl(var(--muted-foreground))]">{d.confidence}%</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Progress value={d.graphScore} className="w-12 h-1.5 bg-[hsl(var(--secondary))] [&>div]:bg-purple-500" />
                          <span className="text-[hsl(var(--muted-foreground))]">{d.graphScore}%</span>
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <StatusIcon className={`w-3 h-3 ${d.status === 'Detected' ? 'text-amber-400' : d.status === 'Investigating' ? 'text-blue-400' : 'text-emerald-400'}`} />
                          <span className="text-[hsl(var(--muted-foreground))]">{d.status}</span>
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

      {/* Live Activity Feed */}
      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
              </div>
              <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Live Activity Feed</CardTitle>
            </div>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{liveMetrics.lastEventTime}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {liveFeed.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg bg-[hsl(var(--secondary))]">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  item.type === 'detection' ? 'bg-blue-400' :
                  item.type === 'alert' ? 'bg-red-400' :
                  item.type === 'ingestion' ? 'bg-emerald-400' : 'bg-[hsl(var(--muted-foreground))]'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed truncate">{item.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-[hsl(var(--muted-foreground))] opacity-70 font-mono">{item.timestamp}</span>
                    {item.source && (
                      <Badge className="text-[8px] px-1 py-0 bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border-light))]">{item.source}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
    <Card className="tg-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{title}</p>
            <p className="text-2xl font-bold text-[hsl(var(--foreground))] mt-1">{value}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] opacity-70 mt-1">{subtitle}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center shadow-lg ${c.shadow}`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3 text-xs">
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> :
           trend === 'down' ? <ArrowDownRight className="w-3 h-3 text-red-400" /> :
           <TrendingUp className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />}
          <span className={trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-[hsl(var(--muted-foreground))]'}>{trendValue}</span>
          <span className="text-[hsl(var(--muted-foreground))] opacity-70 ml-1">vs last period</span>
        </div>
      </CardContent>
    </Card>
  );
}

function GraphStatItem({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: LucideIcon; color: string;
}) {
  const colorMap: Record<string, string> = { blue: 'text-blue-400', cyan: 'text-cyan-400', amber: 'text-amber-400', purple: 'text-purple-400', emerald: 'text-emerald-400' };
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${colorMap[color] || 'text-[hsl(var(--muted-foreground))]'}`} />
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      </div>
      <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DATASETS PAGE
// ═══════════════════════════════════════════════════════════════════
function DatasetsPage({ datasets, onUploadClick }: { datasets: UploadedDataset[]; onUploadClick: () => void }) {
  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center"><Upload className="w-6 h-6 text-blue-400" /></div>
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Upload Log Dataset</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Upload network logs in CSV, JSON, Syslog, NetFlow, Wazuh, Zeek, or other supported formats for TGNN analysis.</p>
            </div>
          </div>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={onUploadClick}><FileUp className="w-4 h-4 mr-2" /> Upload Dataset</Button>
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">Supported Log Formats</CardTitle>
          <CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">TGDetect V16 Apex supports the following data ingestion formats</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {supportedLogFormats.map((fmt, i) => {
              const FmtIcon = formatIcon[fmt.icon] || FileText;
              return (
                <div key={i} className="rounded-lg border border-[hsl(var(--border-light))] bg-[hsl(var(--secondary))] p-3 hover:border-[hsl(var(--border))] transition-colors">
                  <div className="flex items-center gap-2 mb-1.5"><FmtIcon className="w-3.5 h-3.5 text-blue-400" /><span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{fmt.name}</span></div>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">{fmt.desc}</p>
                  <p className="text-[9px] text-blue-400/60 mt-1 font-mono">{fmt.ext}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">Loaded Datasets</CardTitle><CardDescription className="text-xs text-[hsl(var(--muted-foreground))]">Currently loaded log datasets for analysis</CardDescription></div>
            <Badge variant="outline" className="border-[hsl(var(--border-light))] text-[hsl(var(--muted-foreground))] text-xs">{datasets.length} datasets</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Dataset</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Format</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Size</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Events</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Source</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2 pr-4">Uploaded</th>
                  <th className="text-left text-[hsl(var(--muted-foreground))] font-medium py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds) => (
                  <tr key={ds.id} className="border-b border-[hsl(var(--border-light))] hover:bg-[hsl(var(--card-hover))] transition-colors">
                    <td className="py-2.5 pr-4"><div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" /><span className="text-[hsl(var(--muted-foreground))] font-medium">{ds.name}</span></div></td>
                    <td className="py-2.5 pr-4"><Badge variant="outline" className="border-[hsl(var(--border-light))] text-[hsl(var(--muted-foreground))] text-[10px] px-1.5">{ds.format}</Badge></td>
                    <td className="py-2.5 pr-4 text-[hsl(var(--muted-foreground))]">{ds.size}</td>
                    <td className="py-2.5 pr-4 text-[hsl(var(--muted-foreground))]">{ds.events.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-[hsl(var(--muted-foreground))]">{ds.source}</td>
                    <td className="py-2.5 pr-4 text-[hsl(var(--muted-foreground))]">{formatDate(ds.uploadedAt)}</td>
                    <td className="py-2.5"><div className="flex items-center gap-1.5"><div className={`w-1.5 h-1.5 rounded-full ${ds.status === 'processed' ? 'bg-emerald-400' : ds.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'}`} /><span className="text-[hsl(var(--muted-foreground))] capitalize">{ds.status}</span></div></td>
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
// PROFILES PAGE
// ═══════════════════════════════════════════════════════════════════
function ProfilesPage({ profiles, activeProfile, onSelectProfile, onCreateClick, onDeleteProfile }: {
  profiles: UserProfile[]; activeProfile: string; onSelectProfile: (id: string) => void; onCreateClick: () => void; onDeleteProfile: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Analysis Profiles</h3><p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Create profiles to manage different datasets and configurations</p></div>
        <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={onCreateClick}><Plus className="w-4 h-4 mr-1.5" /> Create Profile</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfile;
          return (
            <Card key={profile.id} className={`bg-[hsl(var(--card))] border transition-colors ${isActive ? 'border-blue-500/40 shadow-lg shadow-blue-500/5' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--border-light))]'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2"><UserCircle className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-[hsl(var(--muted-foreground))]'}`} /><CardTitle className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">{profile.name}</CardTitle></div>
                  {isActive && <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[9px]">Active</Badge>}
                </div>
                <CardDescription className="text-[11px] text-[hsl(var(--muted-foreground))]">{profile.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border-light))] px-2.5 py-1.5"><p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Dataset</p><p className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium">{profile.dataset}</p></div>
                  <div className="rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border-light))] px-2.5 py-1.5"><p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase">Modified</p><p className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium">{formatDate(profile.lastModified)}</p></div>
                </div>
                <div>
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1.5">V16 Apex Config</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[{ label: 'Window', value: `${profile.config.temporalWindow}s` }, { label: 'Heads', value: profile.config.numHeads.toString() }, { label: 'Layers', value: profile.config.nLayers.toString() }, { label: 'Memory', value: profile.config.memoryDim.toString() }, { label: 'Embed', value: profile.config.embedDim.toString() }, { label: 'Threshold', value: profile.config.threshold.toString() }].map((c, i) => (
                      <div key={i} className="rounded bg-[hsl(var(--background))] px-1.5 py-1 text-center"><p className="text-[8px] text-[hsl(var(--muted-foreground))]">{c.label}</p><p className="text-[10px] text-blue-400 font-mono">{c.value}</p></div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" className={`flex-1 text-[10px] h-7 ${isActive ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' : 'border-[hsl(var(--border-light))] text-[hsl(var(--muted-foreground))]'}`} onClick={() => onSelectProfile(profile.id)}>{isActive ? 'Currently Active' : 'Set Active'}</Button>
                  <Button variant="ghost" size="sm" className="text-[hsl(var(--muted-foreground))] hover:text-red-400 h-7 w-7 p-0" onClick={() => onDeleteProfile(profile.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
