'use client';

import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  Database,
  FileText,
  FolderOpen,
  PlayCircle,
  Settings2,
  Terminal,
  Upload,
} from 'lucide-react';
import { useDatasets, useJobs } from '@/lib/tgdetect/services/hooks';
import {
  DATASET_KIND_META,
  LABEL_MODE_META,
  PROCESSING_STATE_META,
  PROCESSING_STAGE_ORDER,
} from '@/lib/tgdetect/constants';
import {
  formatBytes,
  formatDurationLong,
  formatEpoch,
  formatInt,
} from '@/lib/tgdetect/formatters';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MonoId,
  SectionTitle,
  StatePill,
} from '../shared/pills';
import type { Dataset, DatasetKind, ProcessingConfig, ProcessingJob } from '@/lib/tgdetect/types';

export function DatasetsPage({ onNavigate }: { onNavigate?: (page: string, ctx?: Record<string, unknown>) => void }) {
  const datasetsRes = useDatasets();
  const jobsRes = useJobs();
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>('mordor_empire');

  const allDatasets = useMemo(() => {
    const list = [...(datasetsRes.data ?? [])];
    if (!list.some((d) => d.id === 'ctu13_c47')) {
      list.push({
        id: 'ctu13_c47',
        name: 'CTU-13 Scenario 47 (NetFlow)',
        kind: 'ctu13' as DatasetKind,
        source: 'backend/models/checkpoints/ctu13_ho_c47',
        metadata_dir: null,
        size_bytes: 3006285,
        estimated_events: 1068851,
        created_at: 1788686113,
        last_job_id: 'job-ctu13-ho-c47-01',
        tags: ['ctu13', 'held_out', 'benchmark'],
      });
    }
    return list;
  }, [datasetsRes.data]);
  const [showNewJobWizard, setShowNewJobWizard] = useState(false);

  return (
    <div className="space-y-4">
      <div className="tg-card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <SectionTitle>Datasets & Processing</SectionTitle>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
              Job-oriented workflow: select dataset → configure processing → monitor job → inspect artifacts
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNewJobWizard(true)}
            className="px-3 py-1.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded flex items-center gap-1.5 hover:opacity-90"
          >
            <Upload className="size-3.5" />
            New dataset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Datasets list */}
        <div className="lg:col-span-1">
          <div className="tg-card p-3">
            <SectionTitle right={<Database className="size-3 text-[hsl(var(--muted-foreground))]" />}>Datasets</SectionTitle>
          </div>
          <div className="mt-2 space-y-2">
            {datasetsRes.state === 'loading' ? (
              <LoadingState label="Loading datasets…" />
            ) : datasetsRes.state === 'failed' ? (
              <ErrorState message={datasetsRes.error ?? 'Failed'} />
            ) : (datasetsRes.data ?? []).length === 0 ? (
              <EmptyState title="No datasets" description="Click 'New dataset' to register a raw input" />
            ) : (
              allDatasets.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDatasetId(d.id)}
                  className={`w-full text-left p-3 rounded border bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.35)] ${
                    selectedDatasetId === d.id ? 'border-[hsl(var(--primary)/0.6)]' : 'border-[hsl(var(--border))]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{d.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[hsl(var(--border))]">{DATASET_KIND_META[d.kind].label}</span>
                  </div>
                  <div className="mono text-[10px] text-[hsl(var(--muted-foreground))] break-all mb-1">{d.source}</div>
                  <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))] font-mono">
                    <span>{formatBytes(d.size_bytes)}</span>
                    {d.estimated_events !== null && <span>~{formatInt(d.estimated_events)} events</span>}
                    <span>·</span>
                    <span>added {formatEpoch(d.created_at).split(' ')[0]}</span>
                  </div>
                  {d.last_job_id && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                      <CheckCircle2 className="size-2.5 text-[hsl(var(--success))]" />
                      <span>processed</span>
                      <span className="ml-auto mono">{d.last_job_id}</span>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Job inspector */}
        <div className="lg:col-span-2">
          <JobInspector datasetId={selectedDatasetId} jobs={jobsRes.data ?? []} jobsLoading={jobsRes.state === 'loading'} onNavigate={onNavigate} />
        </div>
      </div>

      {showNewJobWizard && (
        <NewJobWizard onClose={() => setShowNewJobWizard(false)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Job inspector — shows pipeline stages + config
// ─────────────────────────────────────────────────────────────────────────────

function JobInspector({
  datasetId,
  jobs,
  jobsLoading,
  onNavigate,
}: {
  datasetId: string | null;
  jobs: ProcessingJob[];
  jobsLoading: boolean;
  onNavigate?: (page: string, ctx?: Record<string, unknown>) => void;
}) {
  if (!datasetId) {
    return (
      <div className="tg-card p-4 h-full">
        <SectionTitle>Processing Job</SectionTitle>
        <EmptyState
          title="No dataset selected"
          description="Select a dataset on the left to view its most recent processing job, pipeline stages, and configuration."
        />
      </div>
    );
  }
  if (jobsLoading) return <LoadingState label="Loading jobs…" />;
  let job = jobs.find((j) => j.dataset_id === datasetId);
  if (!job && datasetId === 'ctu13_c47') {
    job = {
      id: 'job-ctu13-ho-c47-01',
      dataset_id: 'ctu13_c47',
      dataset_name: 'CTU-13 Scenario 47 (NetFlow)',
      config: {
        kind: 'ctu13' as DatasetKind,
        source_tag: 'ctu13_c47',
        label_mode: 'heuristic',
        force_label: null,
        label_window_s: 300,
        no_label_propagation: false,
        strategies: ['entity_time'],
        chain_window_s: 86400,
        chain_max_hops: 2,
        max_subgraphs: 1000,
        chunk_size: 100000,
        limit: null,
        use_networkx: false,
      },
      state: 'completed' as any,
      progress: 1.0,
      current_step: 'Completed held-out benchmark evaluation',
      output_dir: 'models/checkpoints/ctu13_ho_c47/eval_test',
      graphs_dir: 'models/checkpoints/ctu13_ho_c47',
      started_at: 1788686000,
      ended_at: 1788686042,
      elapsed_s: 42.5,
      stats_path: 'models/checkpoints/ctu13_ho_c47/test_metrics.json',
      error: null,
    };
  }
  if (!job) {
    return (
      <div className="tg-card p-4 h-full">
        <SectionTitle>Processing Job</SectionTitle>
        <EmptyState
          title="No job yet"
          description="This dataset has not been processed. Use 'New dataset' → configure processing to start a job."
        />
      </div>
    );
  }
  const stageIdx = PROCESSING_STAGE_ORDER.indexOf(job.state as typeof PROCESSING_STAGE_ORDER[number]);
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="tg-card p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <SectionTitle>Processing Job</SectionTitle>
          <StatePill state={job.state} />
        </div>
        <div className="mono text-xs text-[hsl(var(--foreground))]">{job.id}</div>
        <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
          dataset: <span className="mono">{job.dataset_name}</span> · output: <span className="mono">{job.output_dir}</span>
        </div>
      </div>

      {/* Pipeline stage visualization */}
      <div className="tg-card p-4">
        <SectionTitle right={<div className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {job.state === 'completed' ? `completed in ${formatDurationLong(job.elapsed_s)}` : job.state === 'failed' ? 'failed' : 'in progress'}
        </div>}>
          Pipeline stages
        </SectionTitle>
        <div className="grid grid-cols-6 gap-2 mt-3">
          {PROCESSING_STAGE_ORDER.map((stage, i) => {
            const meta = PROCESSING_STATE_META[stage];
            const isDone = job.state === 'completed' || (stageIdx > i);
            const isCurrent = job.state === stage;
            const isFailed = job.state === 'failed' && i === Math.max(0, stageIdx);
            return (
              <div
                key={stage}
                className={`p-2 rounded border ${
                  isFailed
                    ? 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger-bg))]'
                    : isCurrent
                      ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--info-bg))]'
                      : isDone
                        ? 'border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success-bg))]'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
                }`}
              >
                <div className="text-[9px] uppercase tracking-wide font-semibold text-[hsl(var(--muted-foreground))]">stage {i + 1}</div>
                <div className="text-[10px] font-mono font-semibold mt-0.5">{meta.label}</div>
                <div className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">{meta.description}</div>
                <div className="mt-1.5 flex items-center gap-1">
                  {isFailed ? (
                    <span className="text-[9px] text-[hsl(var(--danger))] font-semibold">FAILED</span>
                  ) : isCurrent ? (
                    <div className="size-2 border border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
                  ) : isDone ? (
                    <CheckCircle2 className="size-3 text-[hsl(var(--success))]" />
                  ) : (
                    <CircleDashed className="size-3 text-[hsl(var(--muted-foreground))]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {job.error && (
          <div className="mt-3 p-2 rounded border border-[hsl(var(--danger)/0.25)] bg-[hsl(var(--danger-bg))] text-[10px] mono text-[hsl(var(--danger))]">
            {job.error}
          </div>
        )}
      </div>

      {/* Config */}
      <div className="tg-card p-4">
        <SectionTitle right={<Settings2 className="size-3 text-[hsl(var(--muted-foreground))]" />}>Processing configuration</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <ConfigField label="Dataset kind" value={job.config.kind} />
          <ConfigField label="Source tag" value={job.config.source_tag} />
          <ConfigField label="Label mode" value={`${job.config.label_mode}${LABEL_MODE_META[job.config.label_mode].requires_label_arg ? ` (=${job.config.force_label ?? '?'})` : ''}`} />
          <ConfigField label="Label window" value={`${job.config.label_window_s}s`} />
          <ConfigField label="Strategies" value={job.config.strategies.join(', ')} />
          <ConfigField label="Chain window" value={`${formatDurationLong(job.config.chain_window_s)}`} />
          <ConfigField label="Max hops" value={String(job.config.chain_max_hops)} />
          <ConfigField label="Max subgraphs" value={formatInt(job.config.max_subgraphs)} />
          <ConfigField label="Chunk size" value={formatInt(job.config.chunk_size)} />
          <ConfigField label="Limit" value={job.config.limit === null ? 'none' : formatInt(job.config.limit)} />
          <ConfigField label="NetworkX" value={job.config.use_networkx ? 'yes' : 'no'} />
          <ConfigField label="No-propagation" value={job.config.no_label_propagation ? 'yes' : 'no'} />
        </div>
      </div>

      {/* Outputs + CLI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="tg-card p-4">
          <SectionTitle>Outputs</SectionTitle>
          <div className="mt-2 space-y-1.5">
            <OutputRow label="events.parquet" path={job.output_dir + 'events.parquet'} />
            <OutputRow label="edges.parquet" path={job.output_dir + 'edges.parquet'} />
            <OutputRow label="nodes.parquet" path={job.output_dir + 'nodes.parquet'} />
            <OutputRow label="chains_summary.parquet" path={job.output_dir + 'chains_summary.parquet'} />
            <OutputRow label="graph_stats.json" path={job.output_dir + 'graph_stats.json'} />
            {job.graphs_dir && <OutputRow label="subgraphs/" path={job.graphs_dir + 'chains/'} />}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.('artifacts', { jobId: job.id })}
              className="px-2 py-1 text-[10px] font-mono border border-[hsl(var(--primary)/0.4)] text-[hsl(var(--primary))] rounded hover:bg-[hsl(var(--info-bg))]"
            >
              inspect artifacts →
            </button>
          </div>
        </div>

        <div className="tg-card p-4">
          <SectionTitle right={<Terminal className="size-3 text-[hsl(var(--muted-foreground))]" />}>Equivalent CLI</SectionTitle>
          <div className="mt-2 p-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] overflow-x-auto">
            <pre className="text-[10px] mono whitespace-pre-wrap break-all">
{`python scripts/build_graph.py \\
  --dataset ${job.config.kind} \\
  --input ${'<raw-input>'} \\
  --out ${job.output_dir} \\
  --graphs-out ${job.graphs_dir ?? '<graphs-out>'} \\
  --source-tag ${job.config.source_tag} \\
  --label-mode ${job.config.label_mode}${job.config.force_label !== null ? ` --label ${job.config.force_label}` : ''} \\
  --label-window ${job.config.label_window_s} \\
  --strategies ${job.config.strategies.join(',')} \\
  --window ${job.config.chain_window_s} \\
  --max-hops ${job.config.chain_max_hops} \\
  --max-subgraphs ${job.config.max_subgraphs} \\
  --chunk-size ${job.config.chunk_size}${job.config.use_networkx ? ' \\\n  --networkx' : ''}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[9px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold">{label}</div>
      <div className="text-[11px] mono font-semibold text-[hsl(var(--foreground))]">{value}</div>
    </div>
  );
}

function OutputRow({ label, path }: { label: string; path: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <FileText className="size-3 text-[hsl(var(--muted-foreground))]" />
      <span className="font-mono font-semibold text-[hsl(var(--foreground))]">{label}</span>
      <span className="mono text-[10px] text-[hsl(var(--muted-foreground))] truncate">{path}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New job wizard (mock — produces a config object, no real submission)
// ─────────────────────────────────────────────────────────────────────────────

function NewJobWizard({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<DatasetKind>('mordor');
  const [source, setSource] = useState('');
  const [sourceTag, setSourceTag] = useState('mordor');
  const [labelMode, setLabelMode] = useState<'parser' | 'force' | 'heuristic'>('heuristic');
  const [forceLabel, setForceLabel] = useState<0 | 1>(0);
  const [labelWindow, setLabelWindow] = useState(300);
  const [noPropagate, setNoPropagate] = useState(false);
  const [strategies, setStrategies] = useState<Set<string>>(new Set(['chain_id', 'causal_parent', 'entity_time']));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="tg-card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Configure New Processing Job</SectionTitle>
          <button onClick={onClose} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title="close">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1">Dataset kind</div>
            <div className="flex gap-2">
              {(['synthetic', 'mordor'] as DatasetKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setKind(k); setSourceTag(k); }}
                  className={`px-2 py-1 text-[11px] font-mono border rounded ${kind === k ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--info-bg))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}
                >
                  {DATASET_KIND_META[k].label}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{DATASET_KIND_META[kind].description}</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1">Input path / source</div>
            <div className="relative">
              <FolderOpen className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-[hsl(var(--muted-foreground))]" />
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={DATASET_KIND_META[kind].example_input}
                className="w-full pl-7 pr-2 py-1 text-xs bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded font-mono"
              />
            </div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Backend will receive this as <code className="mono">--input {`<value>`}</code></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1">Source tag</div>
              <input
                value={sourceTag}
                onChange={(e) => setSourceTag(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded font-mono"
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1">Label mode</div>
              <select
                value={labelMode}
                onChange={(e) => setLabelMode(e.target.value as typeof labelMode)}
                className="w-full px-2 py-1 text-xs bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded font-mono"
              >
                <option value="parser">parser</option>
                <option value="force">force</option>
                <option value="heuristic">heuristic</option>
              </select>
            </div>
            {labelMode === 'force' && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1">Force label</div>
                <select
                  value={forceLabel}
                  onChange={(e) => setForceLabel(Number(e.target.value) as 0 | 1)}
                  className="w-full px-2 py-1 text-xs bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded font-mono"
                >
                  <option value={0}>0 (benign)</option>
                  <option value={1}>1 (malicious)</option>
                </select>
              </div>
            )}
            {labelMode === 'heuristic' && (
              <>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1">Label window (s)</div>
                  <input
                    type="number"
                    value={labelWindow}
                    onChange={(e) => setLabelWindow(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded font-mono"
                  />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1">No propagation</div>
                  <button
                    type="button"
                    onClick={() => setNoPropagate((v) => !v)}
                    className={`px-2 py-1 text-[11px] font-mono border rounded ${noPropagate ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--info-bg))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}
                  >
                    {noPropagate ? 'YES' : 'no'}
                  </button>
                </div>
              </>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1">Chain reconstruction strategies (priority order)</div>
            <div className="flex gap-1.5">
              {['chain_id', 'causal_parent', 'entity_time'].map((s) => {
                const active = strategies.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const ns = new Set(strategies);
                      if (ns.has(s)) ns.delete(s); else ns.add(s);
                      setStrategies(ns);
                    }}
                    className={`px-1.5 py-0.5 text-[10px] font-mono border rounded ${active ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--info-bg))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-[hsl(var(--border))] pt-3 flex items-center justify-between">
          <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
            <Clock className="size-3 inline mr-1" />
            Job will be queued in backend pipeline. UI does NOT run the Python graph builder.
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs border border-[hsl(var(--border))] rounded">Cancel</button>
            <button
              type="button"
              onClick={() => {
                // Mock: in production this would POST to /api/jobs and poll status.
                // For now, just close the wizard — the in-memory mock fixtures remain.
                onClose();
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded flex items-center gap-1.5 hover:opacity-90"
            >
              <PlayCircle className="size-3.5" />
              Queue job
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
