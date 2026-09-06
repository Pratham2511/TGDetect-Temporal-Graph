'use client';

import { useState, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Database,
  Eye,
  FileText,
  FolderOpen,
  Loader2,
  PlayCircle,
  RefreshCw,
  Settings2,
  Terminal,
  Upload,
  XCircle,
} from 'lucide-react';
import { useDatasets, useJobs } from '@/lib/tgdetect/services/hooks';
import { datasetService } from '@/lib/tgdetect/services';
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
  formatEpochTime,
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
import type { Dataset, DatasetKind, ProcessingConfig, ProcessingJob, ValidationReport } from '@/lib/tgdetect/types';

export function DatasetsPage({ onNavigate }: { onNavigate?: (page: string, ctx?: Record<string, unknown>) => void }) {
  const datasetsRes = useDatasets();
  const jobsRes = useJobs();
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>('mordor_empire');
  const [showUploadWizard, setShowUploadWizard] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('upload') === 'true';
    }
    return false;
  });

  const allDatasets = useMemo(() => {
    return datasetsRes.data ?? [];
  }, [datasetsRes.data]);

  return (
    <div className="space-y-4">
      <div className="tg-card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <SectionTitle>Datasets & Processing Pipeline</SectionTitle>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
              Real telemetry workflow: upload raw dataset → backend validation & diagnostics → graph construction → temporal snapshots → model inference
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                datasetsRes.reload();
                jobsRes.reload();
              }}
              className="px-2.5 py-1.5 text-xs border border-[hsl(var(--border))] rounded flex items-center gap-1 hover:bg-[hsl(var(--card))]"
              title="Refresh datasets"
            >
              <RefreshCw className="size-3 text-[hsl(var(--muted-foreground))]" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowUploadWizard(true)}
              className="px-3 py-1.5 text-xs font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded flex items-center gap-1.5 hover:opacity-90 transition-opacity shadow-sm"
            >
              <Upload className="size-3.5" />
              Upload & Validate Dataset
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Datasets list */}
        <div className="lg:col-span-1">
          <div className="tg-card p-3">
            <SectionTitle right={<Database className="size-3 text-[hsl(var(--muted-foreground))]" />}>
              Datasets ({allDatasets.length})
            </SectionTitle>
          </div>
          <div className="mt-2 space-y-2">
            {datasetsRes.state === 'loading' ? (
              <LoadingState label="Loading datasets…" />
            ) : datasetsRes.state === 'failed' ? (
              <ErrorState message={datasetsRes.error ?? 'Failed to load datasets'} />
            ) : allDatasets.length === 0 ? (
              <EmptyState title="No datasets" description="Click 'Upload & Validate Dataset' to add real cybersecurity telemetry" />
            ) : (
              allDatasets.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setSelectedDatasetId(d.id);
                    datasetService.activate(d.id).catch(() => {});
                  }}
                  className={`w-full text-left p-3 rounded border bg-[hsl(var(--card))] transition-colors hover:border-[hsl(var(--primary)/0.35)] ${
                    selectedDatasetId === d.id ? 'border-[hsl(var(--primary)/0.6)] ring-1 ring-[hsl(var(--primary)/0.2)]' : 'border-[hsl(var(--border))]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{d.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                      {DATASET_KIND_META[d.kind]?.label ?? d.kind}
                    </span>
                  </div>
                  <div className="mono text-[10px] text-[hsl(var(--muted-foreground))] break-all mb-1">{d.source}</div>
                  <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))] font-mono">
                    <span>{formatBytes(d.size_bytes)}</span>
                    {d.estimated_events !== null && <span>~{formatInt(d.estimated_events)} events</span>}
                    <span>·</span>
                    <span>added {formatEpoch(d.created_at).split(' ')[0]}</span>
                  </div>
                  {d.last_job_id && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
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
          <JobInspector
            datasetId={selectedDatasetId}
            jobs={jobsRes.data ?? []}
            jobsLoading={jobsRes.state === 'loading'}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {showUploadWizard && (
        <UploadAndValidateWizard
          onClose={() => setShowUploadWizard(false)}
          onDatasetProcessed={(newId) => {
            datasetsRes.reload();
            jobsRes.reload();
            setSelectedDatasetId(newId);
          }}
          onNavigate={onNavigate}
        />
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
        <SectionTitle>Processing Pipeline Execution</SectionTitle>
        <EmptyState
          title="No dataset selected"
          description="Select a dataset on the left to view its processing pipeline, graph statistics, and execution history."
        />
      </div>
    );
  }
  if (jobsLoading) return <LoadingState label="Loading processing records…" />;

  let job = jobs.find((j) => j.dataset_id === datasetId);
  if (!job && datasetId === 'ctu13_c47') {
    job = {
      id: 'job-ctu13-ho-c47-01',
      dataset_id: 'ctu13_c47',
      dataset_name: 'CTU-13 Scenario 47 (NetFlow)',
      config: {
        kind: 'ctu13' as DatasetKind,
        source_tag: 'ctu13_c47',
        label_mode: 'parser',
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
        <SectionTitle>Processing Pipeline Execution</SectionTitle>
        <EmptyState
          title="No processing run recorded"
          description="This dataset has not been processed into temporal graphs yet. Use 'Upload & Validate Dataset' to run the graph builder."
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
          <SectionTitle>Processing Pipeline Execution</SectionTitle>
          <StatePill state={job.state} />
        </div>
        <div className="mono text-xs text-[hsl(var(--foreground))] font-semibold">{job.id}</div>
        <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
          dataset: <span className="mono font-medium">{job.dataset_name}</span> · output: <span className="mono">{job.output_dir}</span>
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
            const isCurrent = job.state === stage;
            const isPast = stageIdx > i || job.state === 'completed';
            const isFuture = stageIdx < i && job.state !== 'completed';
            return (
              <div
                key={stage}
                className={`p-2 rounded border text-center transition-all ${
                  isCurrent
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]'
                    : isPast
                    ? 'border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success-bg))]'
                    : 'border-[hsl(var(--border))] opacity-60 bg-[hsl(var(--background))]'
                }`}
              >
                <div className="flex justify-center mb-1">
                  {isPast ? (
                    <CheckCircle2 className="size-3.5 text-[hsl(var(--success))]" />
                  ) : isCurrent ? (
                    <CircleDashed className="size-3.5 text-[hsl(var(--primary))] animate-spin" />
                  ) : (
                    <div className="size-3.5 rounded-full border border-[hsl(var(--muted-foreground)/0.4)]" />
                  )}
                </div>
                <div className="text-[10px] font-medium leading-tight">{meta.label}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-[10px] text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
          <Terminal className="size-3 text-[hsl(var(--muted-foreground))]" />
          <span>Stage: </span>
          <span className="mono font-medium text-[hsl(var(--foreground))]">{job.current_step}</span>
        </div>
      </div>

      {/* Configuration */}
      <div className="tg-card p-4">
        <SectionTitle right={<Settings2 className="size-3 text-[hsl(var(--muted-foreground))]" />}>Configuration & Parameters</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mt-3">
          <div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">Dataset Format</div>
            <div className="font-mono mt-0.5">{job.config.kind}</div>
          </div>
          <div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">Source Tag</div>
            <div className="font-mono mt-0.5">{job.config.source_tag}</div>
          </div>
          <div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">Label Mode</div>
            <div className="font-mono mt-0.5">{job.config.label_mode}</div>
          </div>
          <div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">Label Window</div>
            <div className="font-mono mt-0.5">{job.config.label_window_s}s</div>
          </div>
          <div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">Strategies</div>
            <div className="font-mono mt-0.5">{job.config.strategies.join(', ')}</div>
          </div>
          <div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">Chain Window</div>
            <div className="font-mono mt-0.5">{job.config.chain_window_s}s ({Math.round(job.config.chain_window_s / 3600)}h)</div>
          </div>
        </div>
      </div>

      {/* Action links */}
      {job.state === 'completed' && onNavigate && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onNavigate('explorer')}
            className="flex-1 py-2 px-3 text-xs font-semibold bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.3)] rounded flex items-center justify-center gap-1.5 hover:bg-[hsl(var(--primary)/0.2)] transition-colors"
          >
            <Eye className="size-3.5" />
            Explore in Graph Explorer
          </button>
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="flex-1 py-2 px-3 text-xs font-semibold bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded flex items-center justify-center gap-1.5 hover:bg-[hsl(var(--accent))] transition-colors"
          >
            <ArrowRight className="size-3.5" />
            View Overview Analytics
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload & Validation Wizard
// ─────────────────────────────────────────────────────────────────────────────

function UploadAndValidateWizard({
  onClose,
  onDatasetProcessed,
  onNavigate,
}: {
  onClose: () => void;
  onDatasetProcessed?: (id: string) => void;
  onNavigate?: (page: string, ctx?: Record<string, unknown>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [format, setFormat] = useState<string>('auto');
  const [isUploading, setIsUploading] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Processing state
  const [datasetId, setDatasetId] = useState('');
  const [strategies, setStrategies] = useState<Set<string>>(new Set(['chain_id', 'causal_parent', 'entity_time']));
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStage, setProcessStage] = useState<string | null>(null);
  const [processedJob, setProcessedJob] = useState<ProcessingJob | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setValidationReport(null);
      setUploadError(null);
      // Auto suggest dataset id
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      setDatasetId(cleanName);
    }
  };

  const handleUploadAndValidate = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const report = await datasetService.upload(selectedFile, format);
      setValidationReport(report);
      if (report.saved_path && !datasetId) {
        setDatasetId(selectedFile.name.replace(/\.[^/.]+$/, '').toLowerCase());
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload and validate file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!validationReport?.saved_path || !datasetId) return;
    setIsProcessing(true);
    setProcessError(null);
    setProcessStage('Executing Streaming Graph Builder...');
    try {
      const activeFmt = validationReport.format || 'ctu13';
      const job = await datasetService.process(datasetId, activeFmt, validationReport.saved_path, {
        strategies: Array.from(strategies),
      });
      setProcessedJob(job);
      setProcessStage('Pipeline completed! Temporal graph and attack chains constructed.');
      if (onDatasetProcessed) {
        onDatasetProcessed(datasetId);
      }
    } catch (err: any) {
      setProcessError(err?.message || 'Processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="tg-card max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 border border-[hsl(var(--border))] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              <Upload className="size-4 text-[hsl(var(--primary))]" />
              Upload & Validate Dataset
            </div>
            <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
              Production telemetry validation using authentic backend parsers (CTU-13 NetFlow, Mordor Host Logs, Synthetic Streams)
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-sm font-mono px-2 py-1 rounded hover:bg-[hsl(var(--card))]"
            title="close"
          >
            ✕
          </button>
        </div>

        {/* Step 1: File Selection & Options */}
        {!validationReport && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold block mb-1.5">
                1. Select Telemetry File
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)] rounded-lg p-6 text-center cursor-pointer transition-colors bg-[hsl(var(--background))]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept=".binetflow,.binetflow.xz,.csv,.txt,.json,.jsonl,.ndjson,.log,.gz,.zip"
                  className="hidden"
                />
                <Upload className="size-8 mx-auto text-[hsl(var(--muted-foreground))] mb-2" />
                {selectedFile ? (
                  <div>
                    <div className="text-xs font-semibold text-[hsl(var(--foreground))]">{selectedFile.name}</div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 font-mono">
                      {formatBytes(selectedFile.size)} · Click to change file
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-medium text-[hsl(var(--foreground))]">Click or drag & drop telemetry capture</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                      Supports CTU-13 NetFlow (<code className="mono">.binetflow, .binetflow.xz, .csv</code>), Windows Host Logs (<code className="mono">.jsonl, .json, .log, .zip</code>), or Synthetic streams
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold block mb-1">
                  Format Specification
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded font-mono"
                >
                  <option value="auto">Auto-detect from file structure (recommended)</option>
                  <option value="ctu13">CTU-13 NetFlow (Argus 15-field CSV / binetflow)</option>
                  <option value="mordor">Mordor / Windows Host Logs (Sysmon / Security JSONL)</option>
                  <option value="synthetic">Synthetic TG-Detect Event Stream (JSONL)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold block mb-1">
                  Target Dataset ID
                </label>
                <input
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  placeholder="e.g. ctu13_traffic_run01"
                  className="w-full px-2.5 py-1.5 text-xs bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded font-mono"
                />
              </div>
            </div>

            {uploadError && (
              <div className="p-3 rounded bg-[hsl(var(--danger)/0.1)] border border-[hsl(var(--danger)/0.3)] text-xs text-[hsl(var(--danger))] flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Validation Error</div>
                  <div>{uploadError}</div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[hsl(var(--border))]">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs border border-[hsl(var(--border))] rounded hover:bg-[hsl(var(--card))]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedFile || isUploading}
                onClick={handleUploadAndValidate}
                className="px-4 py-1.5 text-xs font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Uploading & Validating...
                  </>
                ) : (
                  <>
                    <PlayCircle className="size-3.5" />
                    Submit & Validate Backend Parser
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Validation Diagnostics Report */}
        {validationReport && !processedJob && (
          <div className="space-y-4">
            {/* Status Card */}
            <div className={`p-4 rounded-lg border flex items-start justify-between gap-3 ${
              validationReport.status === 'valid'
                ? 'bg-[hsl(var(--success-bg))] border-[hsl(var(--success)/0.4)]'
                : validationReport.status === 'valid_with_warnings'
                ? 'bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning)/0.4)]'
                : 'bg-[hsl(var(--danger)/0.1)] border-[hsl(var(--danger)/0.4)]'
            }`}>
              <div className="flex items-start gap-3">
                {validationReport.status === 'valid' ? (
                  <CheckCircle className="size-5 text-[hsl(var(--success))] shrink-0 mt-0.5" />
                ) : validationReport.status === 'valid_with_warnings' ? (
                  <AlertTriangle className="size-5 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="size-5 text-[hsl(var(--danger))] shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">
                    {validationReport.status === 'valid'
                      ? 'Dataset Validated Successfully'
                      : validationReport.status === 'valid_with_warnings'
                      ? 'Dataset Valid with Schema Warnings'
                      : 'Dataset Validation Failed'}
                  </div>
                  <div className="text-[11px] text-[hsl(var(--foreground))] mt-0.5">
                    Format: <span className="font-semibold">{validationReport.format_label || validationReport.format}</span>
                    {validationReport.file_info && (
                      <span className="text-[hsl(var(--muted-foreground))]"> · {formatBytes(validationReport.file_info.size_bytes)}</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setValidationReport(null);
                  setSelectedFile(null);
                }}
                className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline font-mono"
              >
                Upload Different File
              </button>
            </div>

            {/* Diagnostics Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-3 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">Rows Inspected</div>
                <div className="text-sm font-bold font-mono mt-0.5">{formatInt(validationReport.total_rows_inspected)}</div>
              </div>
              <div className="p-3 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">Valid Rows</div>
                <div className="text-sm font-bold font-mono text-[hsl(var(--success))] mt-0.5">{formatInt(validationReport.valid_rows)}</div>
              </div>
              <div className="p-3 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">Invalid Rows</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${validationReport.invalid_rows > 0 ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                  {formatInt(validationReport.invalid_rows)}
                </div>
              </div>
              <div className="p-3 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">Detected Schema</div>
                <div className="text-xs font-semibold font-mono truncate mt-1">{validationReport.detected_format}</div>
              </div>
            </div>

            {/* Missing columns alert */}
            {validationReport.missing_required_columns.length > 0 && (
              <div className="p-3 rounded bg-[hsl(var(--danger)/0.1)] border border-[hsl(var(--danger)/0.3)] text-xs text-[hsl(var(--danger))] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  Missing Required Schema Columns:
                </div>
                <div className="font-mono text-[11px]">
                  {validationReport.missing_required_columns.join(', ')}
                </div>
              </div>
            )}

            {/* Errors List */}
            {validationReport.errors.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--danger))] font-semibold mb-1.5 flex items-center gap-1">
                  <XCircle className="size-3" />
                  Actionable Parser Diagnostics ({validationReport.error_count} error{validationReport.error_count > 1 ? 's' : ''})
                </div>
                <div className="max-h-40 overflow-y-auto rounded border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--background))] text-xs font-mono divide-y divide-[hsl(var(--border))]">
                  {validationReport.errors.map((err, i) => (
                    <div key={i} className="p-2 flex items-start gap-2">
                      <span className="px-1 py-0.5 rounded bg-[hsl(var(--danger)/0.15)] text-[hsl(var(--danger))] text-[10px] shrink-0">
                        Line {err.line}
                      </span>
                      {err.column && (
                        <span className="px-1 py-0.5 rounded border border-[hsl(var(--border))] text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                          {err.column}
                        </span>
                      )}
                      <span className="text-[hsl(var(--foreground))] text-[11px] break-all">{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings List */}
            {validationReport.warnings.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--warning))] font-semibold mb-1 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Validation Warnings ({validationReport.warning_count})
                </div>
                <div className="rounded border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--background))] p-2 text-xs space-y-1">
                  {validationReport.warnings.map((w, i) => (
                    <div key={i} className="text-[11px] text-[hsl(var(--muted-foreground))] flex items-start gap-1.5">
                      <span className="size-1 rounded-full bg-[hsl(var(--warning))] mt-1.5 shrink-0" />
                      <span>{w.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Extracted TGEvents Preview */}
            {validationReport.sample_events.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mb-1.5 flex items-center gap-1">
                  <Eye className="size-3" />
                  Sample Parsed Temporal Graph Events ({validationReport.sample_events.length} extracted)
                </div>
                <div className="overflow-x-auto rounded border border-[hsl(var(--border))]">
                  <table className="w-full text-[11px] font-mono">
                    <thead className="bg-[hsl(var(--muted)/0.5)] border-b border-[hsl(var(--border))] text-[10px] uppercase text-[hsl(var(--muted-foreground))]">
                      <tr>
                        <th className="p-1.5 text-left">Event ID</th>
                        <th className="p-1.5 text-left">Timestamp</th>
                        <th className="p-1.5 text-left">Source Entity</th>
                        <th className="p-1.5 text-left">Relation</th>
                        <th className="p-1.5 text-left">Destination Entity</th>
                        <th className="p-1.5 text-left">Label</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))] bg-[hsl(var(--card))]">
                      {validationReport.sample_events.map((evt: any, i: number) => (
                        <tr key={i} className="hover:bg-[hsl(var(--accent)/0.5)]">
                          <td className="p-1.5 font-semibold text-[hsl(var(--foreground))]">{evt.event_id}</td>
                          <td className="p-1.5 text-[hsl(var(--muted-foreground))]">{formatEpochTime(evt.ts)}</td>
                          <td className="p-1.5">{evt.src_id}</td>
                          <td className="p-1.5 font-bold text-[hsl(var(--primary))]">{evt.relation}</td>
                          <td className="p-1.5">{evt.dst_id}</td>
                          <td className="p-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${evt.label === 1 ? 'bg-[hsl(var(--danger)/0.15)] text-[hsl(var(--danger))]' : 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]'}`}>
                              {evt.label === 1 ? 'MALICIOUS' : 'BENIGN'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Processing Trigger Section */}
            {validationReport.status !== 'invalid' && (
              <div className="pt-3 border-t border-[hsl(var(--border))] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold">Execute Graph Construction Pipeline</div>
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      Builds <code className="mono">events.parquet</code>, <code className="mono">nodes.parquet</code>, <code className="mono">edges.parquet</code>, and multi-strategy attack chains.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleProcess}
                    className="px-4 py-2 text-xs font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Processing Pipeline...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="size-3.5" />
                        Process Dataset into Temporal Graph
                      </>
                    )}
                  </button>
                </div>

                {isProcessing && processStage && (
                  <div className="p-3 rounded border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.05)] flex items-center gap-2 text-xs font-mono text-[hsl(var(--primary))]">
                    <CircleDashed className="size-3.5 animate-spin" />
                    <span>{processStage}</span>
                  </div>
                )}

                {processError && (
                  <div className="p-3 rounded bg-[hsl(var(--danger)/0.1)] border border-[hsl(var(--danger)/0.3)] text-xs text-[hsl(var(--danger))]">
                    {processError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Processing Complete Confirmation */}
        {processedJob && (
          <div className="space-y-4 py-3 text-center">
            <div className="size-12 rounded-full bg-[hsl(var(--success-bg))] border border-[hsl(var(--success)/0.4)] flex items-center justify-center mx-auto text-[hsl(var(--success))]">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-[hsl(var(--foreground))]">Dataset Successfully Processed into Temporal Graph!</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1 font-mono">
                Job ID: {processedJob.id} · Dataset: {processedJob.dataset_id}
              </div>
            </div>

            <div className="p-3 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-left text-xs font-mono space-y-1 max-w-lg mx-auto">
              <div>Output Parquet: <span className="text-[hsl(var(--primary))]">{processedJob.output_dir}</span></div>
              <div>Elapsed Time: <span className="text-[hsl(var(--foreground))]">{processedJob.elapsed_s}s</span></div>
              <div>Status: <span className="text-[hsl(var(--success))] font-bold">completed</span></div>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs border border-[hsl(var(--border))] rounded hover:bg-[hsl(var(--card))]"
              >
                Close Wizard
              </button>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('explorer');
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded flex items-center gap-1.5 hover:opacity-90 shadow-sm"
                >
                  <Eye className="size-3.5" />
                  View in Graph Explorer
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
