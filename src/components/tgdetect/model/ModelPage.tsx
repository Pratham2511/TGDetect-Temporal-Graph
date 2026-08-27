'use client';

import { useState } from 'react';
import {
  Activity,
  Brain,
  GitGraph,
  Layers,
  LineChart as LineChartIcon,
  PlayCircle,
  Repeat,
  Target,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useEvaluationRuns,
  usePredictions,
  useSnapshotMeta,
  useSnapshots,
  useTGNNConfig,
  useTGNNSummary,
  useTrainingRun,
} from '@/lib/tgdetect/services/hooks';
import {
  formatDurationLong,
  formatFloat,
  formatInt,
  formatPercent,
} from '@/lib/tgdetect/formatters';
import { CHART_AXIS_STYLE, CHART_COLORS, CHART_GRID_STYLE, CHART_TOOLTIP_STYLE } from '@/lib/tgdetect/chart-constants';
import {
  EmptyState,
  ErrorState,
  LabelPill,
  LoadingState,
  MonoId,
  NodeTypePill,
  SectionTitle,
  StatePill,
} from '../shared/pills';
import { confusionMatrixView } from '@/lib/tgdetect/formatters';
import type { EvalSplit } from '@/lib/tgdetect/types';

type ModelTab = 'architecture' | 'snapshots' | 'training' | 'evaluation';

export function ModelPage() {
  const [tab, setTab] = useState<ModelTab>('architecture');
  return (
    <div className="space-y-3">
      <div className="tg-card p-3 flex flex-wrap gap-1">
        {([
          { id: 'architecture', label: 'Architecture', icon: Brain },
          { id: 'snapshots', label: 'Snapshots', icon: Layers },
          { id: 'training', label: 'Training', icon: LineChartIcon },
          { id: 'evaluation', label: 'Evaluation', icon: Target },
        ] as { id: ModelTab; label: string; icon: typeof Brain }[]).map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5 border-b-2 -mb-[1px] ${
                isActive
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'architecture' && <ArchitecturePanel />}
      {tab === 'snapshots' && <SnapshotsPanel />}
      {tab === 'training' && <TrainingPanel />}
      {tab === 'evaluation' && <EvaluationPanel />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Architecture
// ─────────────────────────────────────────────────────────────────────────────

function ArchitecturePanel() {
  const configRes = useTGNNConfig();
  const summaryRes = useTGNNSummary();
  if (configRes.state === 'loading' || summaryRes.state === 'loading') return <LoadingState label="Loading model config…" />;
  if (!configRes.data || !summaryRes.data) return <EmptyState title="No model config" />;
  const cfg = configRes.data;
  const summary = summaryRes.data;
  return (
    <div className="space-y-3">
      <div className="tg-card p-4">
        <SectionTitle right={<span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[hsl(var(--purple)/0.4)] bg-[hsl(var(--purple-bg))] text-[hsl(var(--purple))]">{summary.architecture}</span>}>
          TGNN Architecture
        </SectionTitle>
        <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
          {summary.gnn_operator} per snapshot · {summary.temporal_aggregator} over time · loss: <span className="mono">{summary.loss}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Attention flag={summary.has_attention} label="Self-attention" />
          <Attention flag={summary.has_transformer} label="Transformer block" />
          <Attention flag={summary.has_llm} label="LLM component" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Architecture diagram */}
        <div className="tg-card p-4">
          <SectionTitle right={<GitGraph className="size-3 text-[hsl(var(--muted-foreground))]" />}>Forward pass</SectionTitle>
          <div className="mt-3 space-y-1.5">
            <FlowNode index={1} label="Snapshot input" sub={`x: [N, ${cfg.in_channels}] · edge_index · edge_attr: [E, ${cfg.edge_dim}]`} color="info" />
            <FlowArrow />
            <FlowNode index={2} label="GraphSAGE (per snapshot)" sub={`${cfg.num_gnn_layers} × SAGEConv(hidden=${cfg.hidden_channels}) + edge encoder + BatchNorm + Dropout(${cfg.dropout})`} color="purple" />
            <FlowArrow />
            <FlowNode index={3} label="GRU (over time)" sub={`${cfg.num_rnn_layers} layer(s) · input=${cfg.hidden_channels} → hidden=${cfg.out_channels}`} color="teal" />
            <FlowArrow />
            <div className="grid grid-cols-2 gap-2">
              <FlowNode index={4} label="Node classifier" sub={`Linear(${cfg.out_channels} → 1)`} color="danger" />
              <FlowNode index={5} label="Snapshot classifier" sub={`Linear(${cfg.out_channels} → 1)`} color="amber" />
            </div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2">
              Output: <span className="mono">node_logits [N,1]</span> + <span className="mono">snapshot_logit [1]</span> · padded to last snapshot's node set
            </div>
          </div>
        </div>

        {/* Hyperparameters */}
        <div className="tg-card p-4">
          <SectionTitle right={<Activity className="size-3 text-[hsl(var(--muted-foreground))]" />}>Hyperparameters</SectionTitle>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Hyperparam label="in_channels" value={cfg.in_channels} hint="one-hot type + [degree, out_deg, in_deg, mal_ratio]" />
            <Hyperparam label="edge_dim" value={cfg.edge_dim} hint="relation one-hot + in-window relative ts" />
            <Hyperparam label="hidden_channels" value={cfg.hidden_channels} />
            <Hyperparam label="out_channels" value={cfg.out_channels} hint="GRU hidden size" />
            <Hyperparam label="num_gnn_layers" value={cfg.num_gnn_layers} hint="SAGEConv layers" />
            <Hyperparam label="num_rnn_layers" value={cfg.num_rnn_layers} hint="GRU layers" />
            <Hyperparam label="dropout" value={cfg.dropout} />
            <Hyperparam label="node_types" value={cfg.node_types ?? '—'} hint="8 backend types" />
            <Hyperparam label="num_relations" value={cfg.num_relations ?? '—'} hint="14 backend relations" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Attention({ flag, label }: { flag: boolean; label: string }) {
  return (
    <div className={`p-2 rounded border text-center ${flag ? 'border-[hsl(var(--purple)/0.4)] bg-[hsl(var(--purple-bg))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]'}`}>
      <div className="text-[10px] font-semibold" style={{ color: flag ? 'hsl(var(--purple))' : 'hsl(var(--muted-foreground))' }}>
        {flag ? 'PRESENT' : 'absent'}
      </div>
      <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{label}</div>
    </div>
  );
}

function FlowNode({ index, label, sub, color }: { index: number; label: string; sub: string; color: 'info' | 'purple' | 'teal' | 'danger' | 'amber' }) {
  const colorClass = {
    info: 'border-[hsl(var(--info)/0.4)] bg-[hsl(var(--info-bg))] text-[hsl(var(--info))]',
    purple: 'border-[hsl(var(--purple)/0.4)] bg-[hsl(var(--purple-bg))] text-[hsl(var(--purple))]',
    teal: 'border-[hsl(var(--teal)/0.4)] bg-[hsl(173_55%/95%)] dark:bg-[hsl(173_58%/8%)] text-[hsl(var(--teal))]',
    danger: 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger))]',
    amber: 'border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]',
  }[color];
  return (
    <div className={`p-2 rounded border ${colorClass}`}>
      <div className="flex items-center gap-2">
        <span className="size-5 rounded-full bg-[hsl(var(--card))] text-[hsl(var(--foreground))] flex items-center justify-center text-[10px] mono font-bold">{index}</span>
        <span className="text-[11px] font-mono font-semibold">{label}</span>
      </div>
      <div className="text-[10px] mono mt-1 ml-7 opacity-80">{sub}</div>
    </div>
  );
}

function FlowArrow() {
  return <div className="ml-3 w-px h-3 bg-[hsl(var(--border))] " />;
}

function Hyperparam({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <div className="text-[9px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-semibold mono">{label}</div>
      <div className="text-sm mono font-semibold tabular-nums text-[hsl(var(--foreground))]">{value}</div>
      {hint && <div className="text-[9px] text-[hsl(var(--muted-foreground))]">{hint}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshots
// ─────────────────────────────────────────────────────────────────────────────

function SnapshotsPanel() {
  const metaRes = useSnapshotMeta();
  const snapsRes = useSnapshots(120);
  if (metaRes.state === 'loading' || snapsRes.state === 'loading') return <LoadingState label="Loading snapshots…" />;
  if (!metaRes.data) return <EmptyState title="No snapshot metadata" />;
  const meta = metaRes.data;
  const snaps = snapsRes.data ?? [];
  return (
    <div className="space-y-3">
      <div className="tg-card p-4">
        <SectionTitle>Snapshot configuration</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
          <Hyperparam label="window_size_s" value={meta.window_size_s} />
          <Hyperparam label="stride_s" value={meta.stride_s} />
          <Hyperparam label="num_snapshots" value={formatInt(meta.num_snapshots)} />
          <Hyperparam label="node_feature_mode" value={meta.node_feature_mode} />
          <Hyperparam label="edge_feature_mode" value={meta.edge_feature_mode} />
          <Hyperparam label="node_feature_dim" value={meta.node_feature_dim} hint="8 one-hot type + 4 numerical" />
          <Hyperparam label="edge_feature_dim" value={meta.edge_feature_dim} hint="14 relation one-hot + 1 rel ts" />
          <Hyperparam label="num_node_types" value={meta.num_node_types} />
          <Hyperparam label="num_relations" value={meta.num_relations} />
        </div>
      </div>
      <div className="tg-card p-4">
        <SectionTitle right={<div className="text-[10px] text-[hsl(var(--muted-foreground))]">showing first {snaps.length} / {formatInt(meta.num_snapshots)} snapshots</div>}>
          Snapshot window activity
        </SectionTitle>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={snaps.map((s) => ({ idx: s.index, nodes: s.num_nodes, edges: s.num_edges, mal_edges: s.num_malicious_edges }))} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid {...CHART_GRID_STYLE} />
            <XAxis dataKey="idx" {...CHART_AXIS_STYLE} />
            <YAxis {...CHART_AXIS_STYLE} width={36} />
            <Tooltip {...CHART_TOOLTIP_STYLE} />
            <Bar dataKey="edges" fill={CHART_COLORS.cyan} radius={[2, 2, 0, 0]} />
            <Bar dataKey="mal_edges" fill={CHART_COLORS.red} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-3 text-[10px] mt-1">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: CHART_COLORS.cyan }} />edges per snapshot</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: CHART_COLORS.red }} />malicious edges</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Training
// ─────────────────────────────────────────────────────────────────────────────

function TrainingPanel() {
  const runRes = useTrainingRun();
  if (runRes.state === 'loading') return <LoadingState label="Loading training run…" />;
  if (!runRes.data) return <EmptyState title="No training run" />;
  const run = runRes.data;
  const history = run.history;
  const last = history[history.length - 1];
  const best = history[run.best_epoch - 1];
  return (
    <div className="space-y-3">
      <div className="tg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <SectionTitle>Training Run</SectionTitle>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[hsl(var(--purple)/0.4)] bg-[hsl(var(--purple-bg))] text-[hsl(var(--purple))]">{run.id}</span>
            <StatePill state={run.state === 'completed' ? 'completed' : run.state === 'failed' ? 'failed' : 'building_graph'} />
          </div>
        </div>
        <div className="text-[10px] text-[hsl(var(--muted-foreground))] mono">
          dataset: {run.dataset_id} · checkpoint: <span className="text-[hsl(var(--foreground))]">{run.checkpoint_path}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
          <Hyperparam label="epochs" value={`${run.current_epoch}/${run.total_epochs}`} />
          <Hyperparam label="best_epoch" value={run.best_epoch} hint={`by ${run.best_metric}`} />
          <Hyperparam label="best_score" value={formatFloat(run.best_score, 4)} />
          <Hyperparam label="best_f1" value={formatFloat(run.best_val_f1, 4)} />
          <Hyperparam label="threshold" value={formatFloat(run.threshold, 4)} hint="tuned on val set" />
          <Hyperparam label="elapsed" value={formatDurationLong(run.elapsed_s)} />
        </div>
      </div>

      <div className="tg-card p-4">
        <SectionTitle right={<div className="flex gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: CHART_COLORS.cyan }} />train_loss</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: CHART_COLORS.violet }} />val_loss</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: CHART_COLORS.red }} />threshold</span>
        </div>}>
          Loss & threshold per epoch
        </SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid {...CHART_GRID_STYLE} />
            <XAxis dataKey="epoch" {...CHART_AXIS_STYLE} />
            <YAxis {...CHART_AXIS_STYLE} width={36} />
            <Tooltip {...CHART_TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="train_loss" stroke={CHART_COLORS.cyan} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="loss" stroke={CHART_COLORS.violet} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="threshold" stroke={CHART_COLORS.red} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="tg-card p-4">
          <SectionTitle>AUC per epoch</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid {...CHART_GRID_STYLE} />
              <XAxis dataKey="epoch" {...CHART_AXIS_STYLE} />
              <YAxis {...CHART_AXIS_STYLE} width={36} domain={[0, 1]} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="auc_roc" stroke={CHART_COLORS.cyan} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="auc_pr" stroke={CHART_COLORS.green} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="tg-card p-4">
          <SectionTitle>Precision / Recall / F1 per epoch</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid {...CHART_GRID_STYLE} />
              <XAxis dataKey="epoch" {...CHART_AXIS_STYLE} />
              <YAxis {...CHART_AXIS_STYLE} width={36} domain={[0, 1]} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="precision" stroke={CHART_COLORS.amber} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="recall" stroke={CHART_COLORS.teal} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="f1" stroke={CHART_COLORS.violet} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="tg-card p-4">
        <SectionTitle>Per-epoch history (best epoch highlighted)</SectionTitle>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                <th className="py-1.5 pr-3">epoch</th>
                <th className="py-1.5 pr-3">train_loss</th>
                <th className="py-1.5 pr-3">val_loss</th>
                <th className="py-1.5 pr-3">auc_roc</th>
                <th className="py-1.5 pr-3">auc_pr</th>
                <th className="py-1.5 pr-3">precision</th>
                <th className="py-1.5 pr-3">recall</th>
                <th className="py-1.5 pr-3">f1</th>
                <th className="py-1.5 pr-3">threshold</th>
              </tr>
            </thead>
            <tbody>
              {history.map((e) => {
                const isBest = e.epoch === run.best_epoch;
                return (
                  <tr key={e.epoch} className={`border-b border-[hsl(var(--border)/0.5)] ${isBest ? 'bg-[hsl(var(--info-bg))]' : ''}`}>
                    <td className="py-1.5 pr-3 mono font-semibold">
                      {e.epoch}{isBest && <span className="ml-1 text-[10px] text-[hsl(var(--primary))]">★ best</span>}
                    </td>
                    <td className="py-1.5 pr-3 mono">{formatFloat(e.train_loss, 4)}</td>
                    <td className="py-1.5 pr-3 mono">{formatFloat(e.loss, 4)}</td>
                    <td className="py-1.5 pr-3 mono">{e.auc_roc === null ? '—' : formatFloat(e.auc_roc, 4)}</td>
                    <td className="py-1.5 pr-3 mono">{e.auc_pr === null ? '—' : formatFloat(e.auc_pr, 4)}</td>
                    <td className="py-1.5 pr-3 mono">{formatFloat(e.precision, 4)}</td>
                    <td className="py-1.5 pr-3 mono">{formatFloat(e.recall, 4)}</td>
                    <td className="py-1.5 pr-3 mono font-semibold">{formatFloat(e.f1, 4)}</td>
                    <td className="py-1.5 pr-3 mono">{formatFloat(e.threshold, 4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────────────────────────────────────

function EvaluationPanel() {
  const runsRes = useEvaluationRuns();
  const [split, setSplit] = useState<EvalSplit>('test');
  const predsRes = usePredictions(split);
  if (runsRes.state === 'loading') return <LoadingState label="Loading evaluation…" />;
  const run = (runsRes.data ?? []).find((r) => r.split === split) ?? null;

  if (!run) {
    return (
      <div className="tg-card p-4">
        <SectionTitle>Evaluation</SectionTitle>
        <EmptyState title="No evaluation" description={`No evaluation run for split=${split}`} />
      </div>
    );
  }
  const m = run.metrics;
  const cm = confusionMatrixView(m.confusion_matrix);
  return (
    <div className="space-y-3">
      <div className="tg-card p-3 flex items-center gap-3 flex-wrap">
        <SectionTitle className="flex-1">Evaluation</SectionTitle>
        <div className="flex gap-1">
          {(['train', 'val', 'test'] as EvalSplit[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSplit(s)}
              className={`px-2 py-1 text-[10px] font-mono border rounded ${split === s ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--info-bg))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}
            >{s}</button>
          ))}
        </div>
      </div>

      <div className="tg-card p-4">
        <SectionTitle right={<div className="text-[10px] text-[hsl(var(--muted-foreground))]">{formatInt(m.num_samples)} samples · {formatInt(m.num_positive)} positive · {formatInt(m.num_negative)} negative</div>}>
          Metrics · split={split}
        </SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
          <Hyperparam label="threshold" value={formatFloat(m.threshold, 4)} />
          <Hyperparam label="accuracy" value={formatFloat(m.accuracy, 4)} />
          <Hyperparam label="precision" value={formatFloat(m.precision, 4)} />
          <Hyperparam label="recall" value={formatFloat(m.recall, 4)} />
          <Hyperparam label="f1" value={formatFloat(m.f1, 4)} />
          <Hyperparam label="auc_roc" value={m.auc_roc === null ? 'null' : formatFloat(m.auc_roc, 4)} hint="null = one-class split" />
          <Hyperparam label="auc_pr" value={m.auc_pr === null ? 'null' : formatFloat(m.auc_pr, 4)} hint="null = one-class split" />
        </div>
        <div className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
          predictions: <span className="mono">{run.predictions_path ?? '—'}</span> · checkpoint: <span className="mono">{run.checkpoint_path}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="tg-card p-4">
          <SectionTitle>Confusion Matrix</SectionTitle>
          <div className="grid grid-cols-2 gap-2 mt-3 max-w-md mx-auto">
            <CmCell label="TN" value={cm.tn} color="success" />
            <CmCell label="FP" value={cm.fp} color="danger" />
            <CmCell label="FN" value={cm.fn} color="warning" />
            <CmCell label="TP" value={cm.tp} color="info" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div>TPR (recall): <span className="text-[hsl(var(--info))]">{formatFloat(cm.tpr, 4)}</span></div>
            <div>FPR: <span className="text-[hsl(var(--danger))]">{formatFloat(cm.fpr, 4)}</span></div>
            <div>TNR (specificity): <span className="text-[hsl(var(--success))]">{formatFloat(cm.tnr, 4)}</span></div>
            <div>FNR: <span className="text-[hsl(var(--warning))]">{formatFloat(cm.fnr, 4)}</span></div>
            <div>PPV (precision): <span className="text-[hsl(var(--info))]">{formatFloat(cm.ppv, 4)}</span></div>
            <div>NPV: <span className="text-[hsl(var(--success))]">{formatFloat(cm.npv, 4)}</span></div>
          </div>
        </div>

        <div className="tg-card p-4">
          <SectionTitle right={<Target className="size-3 text-[hsl(var(--muted-foreground))]" />}>Sample predictions</SectionTitle>
          {predsRes.state === 'loading' ? (
            <LoadingState label="Loading predictions…" />
          ) : (predsRes.data ?? []).length === 0 ? (
            <EmptyState title="No predictions" />
          ) : (
            <div className="overflow-x-auto mt-2 max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[hsl(var(--card))]">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                    <th className="py-1.5 pr-3">seq</th>
                    <th className="py-1.5 pr-3">node_id</th>
                    <th className="py-1.5 pr-3">prob</th>
                    <th className="py-1.5 pr-3">pred</th>
                    <th className="py-1.5 pr-3">truth</th>
                    <th className="py-1.5 pr-3">snap</th>
                  </tr>
                </thead>
                <tbody>
                  {(predsRes.data ?? []).slice(0, 50).map((p, i) => (
                    <tr key={i} className="border-b border-[hsl(var(--border)/0.5)]">
                      <td className="py-1.5 pr-3 mono text-[10px]">{p.sequence}</td>
                      <td className="py-1.5 pr-3"><MonoId truncateAt={20}>{p.node_id}</MonoId></td>
                      <td className="py-1.5 pr-3 mono text-[10px]">{formatFloat(p.probability, 4)}</td>
                      <td className="py-1.5 pr-3"><LabelPill label={p.prediction} /></td>
                      <td className="py-1.5 pr-3"><LabelPill label={p.ground_truth} /></td>
                      <td className="py-1.5 pr-3 mono text-[10px]">{p.snapshot_label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CmCell({ label, value, color }: { label: string; value: number; color: 'success' | 'danger' | 'warning' | 'info' }) {
  const cls = {
    success: 'border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]',
    danger: 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger))]',
    warning: 'border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]',
    info: 'border-[hsl(var(--info)/0.4)] bg-[hsl(var(--info-bg))] text-[hsl(var(--info))]',
  }[color];
  return (
    <div className={`p-4 rounded border ${cls} text-center`}>
      <div className="text-[10px] uppercase tracking-wide font-semibold">{label}</div>
      <div className="text-2xl font-mono font-bold tabular-nums mt-1">{formatInt(value)}</div>
    </div>
  );
}
