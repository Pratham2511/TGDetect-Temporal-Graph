'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Boxes,
  Database,
  GitBranch,
  LayoutDashboard,
  ListTree,
  Moon,
  Network,
  Sun,
  Upload,
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
import { useGraphStats } from '@/lib/tgdetect/services/hooks';
import { formatInt } from '@/lib/tgdetect/formatters';

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
  const statsRes = useGraphStats();

  const navigate = useCallback((page: string, ctx?: Record<string, unknown>) => {
    setActivePage(page);
    setPageCtx(ctx as PageCtx ?? {});
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
          {/* Logo */}
          <div className="p-4 border-b border-[hsl(var(--sidebar-border))]">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="TGDetect" className="size-7" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[hsl(var(--sidebar-logo-text))] tracking-tight">TGDetect</span>
                <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--sidebar-logo-sub))] font-mono">
                  Temporal Graph · Threat Detection
                </span>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`w-full text-left px-3 py-2 mx-1 rounded flex items-center gap-2.5 transition-colors group ${
                    isActive
                      ? 'bg-[hsl(var(--sidebar-item-active))]'
                      : 'hover:bg-[hsl(var(--sidebar-item-hover))]'
                  }`}
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  <Icon
                    className={`size-4 ${
                      isActive ? 'text-[hsl(var(--sidebar-text-active))]' : 'text-[hsl(var(--sidebar-text))]'
                    }`}
                  />
                  <div className="flex flex-col">
                    <span
                      className={`text-xs font-medium ${
                        isActive ? 'text-[hsl(var(--sidebar-text-active))]' : 'text-[hsl(var(--sidebar-text))]'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="text-[9px] text-[hsl(var(--sidebar-logo-sub))]">
                      {item.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer — backend status */}
          <div className="p-3 border-t border-[hsl(var(--sidebar-border))] space-y-2">
            <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--sidebar-logo-sub))] font-mono">
              Backend contract
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-[hsl(var(--sidebar-text))]">graph_builder</span>
              <span className="px-1.5 py-0.5 rounded bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.25)]">
                schema-ready
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-[hsl(var(--sidebar-text))]">API</span>
              <span className="px-1.5 py-0.5 rounded bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.25)]">
                mock
              </span>
            </div>
            {statsRes.data && (
              <div className="text-[9px] text-[hsl(var(--sidebar-logo-sub))] mt-2 pt-2 border-t border-[hsl(var(--sidebar-border)/0.5)] font-mono">
                events: {formatInt(statsRes.data.graph.total_events)} · chains: {formatInt(statsRes.data.attacks.total_chains)}
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="header-shell sticky top-0 z-10 px-5 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <activeItem.icon className="size-4 text-[hsl(var(--primary))]" />
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-sm font-semibold text-[hsl(var(--foreground))]">{activeItem.label}</h1>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">·</span>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{activeItem.description}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]">
                <span className="size-1.5 rounded-full bg-[hsl(var(--warning))]" />
                mock data
              </span>
              <button
                type="button"
                onClick={theme.toggleTheme}
                className="size-8 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex items-center justify-center hover:bg-[hsl(var(--card-hover))]"
                title={theme.theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              >
                {theme.theme === 'dark' ? (
                  <Sun className="size-4 text-[hsl(var(--warning))]" />
                ) : (
                  <Moon className="size-4 text-[hsl(var(--primary))]" />
                )}
              </button>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 p-4 overflow-x-hidden">
            {activePage === 'overview' && <OverviewPage onNavigate={navigate} />}
            {activePage === 'events' && (
              <EventsPage
                initialFilter={
                  pageCtx.labelFilter !== undefined
                    ? { labels: [pageCtx.labelFilter] }
                    : pageCtx.nodeId
                      ? {} // no node-filter on event list, just initial state — nodeId drives related events panel only
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
          </div>
        </main>
      </div>
    </div>
  );
}
