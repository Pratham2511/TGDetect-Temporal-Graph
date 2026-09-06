'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  Database,
  GitBranch,
  LayoutDashboard,
  ListTree,
  Moon,
  Network,
  RefreshCw,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { OverviewPage } from '@/components/tgdetect/overview/OverviewPage';
import { EventsPage } from '@/components/tgdetect/events/EventsPage';
import { GraphPage } from '@/components/tgdetect/graph/GraphPage';
import { ChainsPage } from '@/components/tgdetect/chains/ChainsPage';
import { DatasetsPage } from '@/components/tgdetect/datasets/DatasetsPage';
import { ArtifactsPage } from '@/components/tgdetect/artifacts/ArtifactsPage';
import { ModelPage } from '@/components/tgdetect/model/ModelPage';
import { AnalyticsPage } from '@/components/tgdetect/analytics/AnalyticsPage';
import { useTheme } from '@/lib/theme-context';
import { useModel } from '@/lib/model-context';
import { useGraphStats } from '@/lib/tgdetect/services/hooks';
import { formatInt } from '@/lib/tgdetect/formatters';
import { API_BASE_URL } from '@/lib/tgdetect/api/client';
import { ChevronDown, Cpu, ShieldCheck } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  color: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Backend pipeline summary', color: 'cyan' },
  { id: 'events', label: 'Events', icon: ListTree, description: 'TGEvent investigation', color: 'cyan' },
  { id: 'graph', label: 'Graph', icon: Network, description: 'Temporal heterogeneous graph', color: 'cyan' },
  { id: 'chains', label: 'Attack Chains', icon: GitBranch, description: 'Chain reconstruction', color: 'teal' },
  { id: 'datasets', label: 'Datasets', icon: Database, description: 'Processing & jobs', color: 'amber' },
  { id: 'artifacts', label: 'Artifacts', icon: Boxes, description: 'Parquet / JSON outputs', color: 'violet' },
  { id: 'model', label: 'TGNN / Model', icon: Activity, description: 'GraphSAGE + GRU', color: 'purple' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Event / graph / attack / dataset', color: 'teal' },
];

interface PageCtx {
  // For events page
  eventId?: string;
  labelFilter?: 0 | 1;
  nodeId?: string;
  // For chains page
  chainId?: string;
  // For artifacts page
  jobId?: string;
}

export default function Home() {
  const [activePage, setActivePage] = useState<string>('overview');
  const [pageCtx, setPageCtx] = useState<PageCtx>({});
  const theme = useTheme();
  const {
    models,
    activeModelId,
    activeModel,
    setActiveModelId,
    apiHealth,
    healthError,
    refreshHealth,
  } = useModel();
  const statsRes = useGraphStats();

  const navigate = useCallback((page: string, ctx?: Record<string, unknown>) => {
    setActivePage(page);
    setPageCtx((ctx as PageCtx) ?? {});
    // Scroll to top on navigation
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const activeItem = useMemo(() => NAV_ITEMS.find((i) => i.id === activePage) ?? NAV_ITEMS[0], [activePage]);

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          id="tour-sidebar"
          className="sidebar-shell w-60 flex-shrink-0 flex flex-col"
        >
          {/* Logo / Title */}
          <div className="p-3.5 border-b border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-bg))]">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded bg-[hsl(var(--primary)/0.2)] border border-[hsl(var(--primary)/0.4)] flex items-center justify-center flex-shrink-0">
                <Network className="size-4 text-[hsl(var(--sidebar-text-active))]" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[hsl(var(--sidebar-logo-text))] tracking-tight">TGDetect</span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">v1.0</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--sidebar-logo-sub))] font-mono truncate">
                  Temporal Graph Security
                </span>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-2.5 px-2 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-md flex items-center gap-2.5 transition-all text-xs ${
                    isActive
                      ? 'bg-[hsl(var(--sidebar-item-active))] text-white font-medium shadow-sm border-l-2 border-[hsl(var(--sidebar-text-active))] pl-2'
                      : 'text-[hsl(var(--sidebar-text))] hover:bg-[hsl(var(--sidebar-item-hover))] hover:text-white'
                  }`}
                >
                  <Icon
                    className={`size-4 flex-shrink-0 ${
                      isActive ? 'text-[hsl(var(--sidebar-text-active))]' : 'text-[hsl(var(--sidebar-text))] opacity-80'
                    }`}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate leading-none">{item.label}</span>
                    <span className="text-[9px] text-[hsl(var(--sidebar-logo-sub))] truncate mt-0.5">
                      {item.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer — backend contract & pipeline telemetry */}
          <div className="p-3 border-t border-[hsl(var(--sidebar-border))] space-y-2 bg-[hsl(var(--sidebar-bg))]">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-[hsl(var(--sidebar-logo-sub))] font-mono">
              <span>Backend Contract</span>
              <span className="text-[8px] text-emerald-400 font-bold">VERIFIED</span>
            </div>
            <div className="space-y-1 text-[10px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--sidebar-text))]">graph_builder</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]">
                  parquet 6-stage
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--sidebar-text))]">TGNN</span>
                <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[9px]">
                  SAGE+GRU ({activeModel?.target?.toUpperCase() ?? 'NODE'})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--sidebar-text))]">Params</span>
                <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[9px]">
                  {formatInt(activeModel?.trainable_parameters ?? 36098)}
                </span>
              </div>
            </div>
            {statsRes.data && (
              <div className="text-[9px] text-[hsl(var(--sidebar-logo-sub))] pt-1.5 border-t border-[hsl(var(--sidebar-border)/0.5)] font-mono flex items-center justify-between">
                <span>{formatInt(statsRes.data.graph.total_events)} events</span>
                <span>{formatInt(statsRes.data.attacks.total_chains)} chains</span>
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="header-shell sticky top-0 z-10 px-5 py-2.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <activeItem.icon className="size-4 text-[hsl(var(--primary))] flex-shrink-0" />
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--foreground))]">{activeItem.label}</h1>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">/</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">{activeItem.description}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Health status badge */}
              {apiHealth === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title="Connected to TGDetect FastAPI backend">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>CONNECTED</span>
                </span>
              ) : apiHealth === 'offline' ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400" title="Cannot reach backend">
                  <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>OFFLINE</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>CONNECTING</span>
                </span>
              )}

              {/* Model Selector Dropdown */}
              <div className="relative inline-flex items-center">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-[hsl(var(--primary))]">
                  <Cpu className="size-3" />
                </div>
                <select
                  id="model-selector"
                  aria-label="Active Model Checkpoint"
                  value={activeModelId}
                  onChange={(e) => setActiveModelId(e.target.value)}
                  className="text-[11px] font-mono font-medium pl-6 pr-7 py-1 rounded border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] transition-colors cursor-pointer appearance-none shadow-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[hsl(var(--card))] text-[hsl(var(--foreground))]">
                      {m.name} ({m.target.toUpperCase()})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-[hsl(var(--muted-foreground))]">
                  <ChevronDown className="size-3" />
                </div>
              </div>

              {/* Target badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
                activeModel?.target === 'edge'
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400 font-semibold'
                  : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400 font-semibold'
              }`}>
                <span>TARGET:</span>
                <span className="uppercase">{activeModel?.target ?? 'NODE'}</span>
              </span>

              {/* Active Dataset Badge */}
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]">
                <span className="text-[hsl(var(--muted-foreground))]">Dataset:</span>
                <span className="font-semibold text-[hsl(var(--primary))]">{activeModel?.dataset_name || activeModel?.dataset_id || 'mordor_empire'}</span>
              </span>

              <button
                type="button"
                onClick={theme.toggleTheme}
                className="size-7 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex items-center justify-center hover:bg-[hsl(var(--card-hover))] transition-colors"
                title={theme.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle theme"
              >
                {theme.theme === 'dark' ? (
                  <Sun className="size-3.5 text-[hsl(var(--warning))]" />
                ) : (
                  <Moon className="size-3.5 text-[hsl(var(--primary))]" />
                )}
              </button>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 p-4 overflow-x-hidden">
            {apiHealth === 'offline' ? (
              <div className="max-w-md mx-auto my-12 p-6 rounded border border-rose-500/30 bg-[hsl(var(--card))] shadow-sm text-center">
                <div className="size-10 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="size-5" />
                </div>
                <h2 className="text-sm font-semibold tracking-wider uppercase text-rose-600 dark:text-rose-400 mb-1">
                  TGDetect API OFFLINE
                </h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4 font-mono">
                  Could not connect to {API_BASE_URL}
                </p>
                {healthError && (
                  <p className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--background))] p-2.5 rounded mb-4 break-all text-left">
                    {healthError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    refreshHealth();
                    statsRes.reload();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[hsl(var(--primary))] text-white text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Retry Connection</span>
                </button>
              </div>
            ) : (
              <>
                {activePage === 'overview' && <OverviewPage onNavigate={navigate} />}
                {activePage === 'events' && (
                  <EventsPage
                    initialFilter={
                      pageCtx.labelFilter !== undefined
                        ? { labels: [pageCtx.labelFilter] }
                        : pageCtx.nodeId
                          ? {}
                          : undefined
                    }
                    initialEventId={pageCtx.eventId ?? null}
                    onNavigate={navigate}
                  />
                )}
                {activePage === 'graph' && <GraphPage onNavigate={navigate} />}
                {activePage === 'chains' && <ChainsPage initialChainId={pageCtx.chainId ?? null} onNavigate={navigate} />}
                {activePage === 'datasets' && <DatasetsPage onNavigate={navigate} />}
                {activePage === 'artifacts' && <ArtifactsPage initialJobId={pageCtx.jobId ?? null} />}
                {activePage === 'model' && <ModelPage />}
                {activePage === 'analytics' && <AnalyticsPage />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
