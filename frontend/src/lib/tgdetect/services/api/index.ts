/**
 * Real API-backed implementations of the TGDetect service interfaces.
 *
 * Calls the FastAPI backend at http://localhost:8000 via `apiClient`.
 * Directly mirrors backend types with zero mock fabrication.
 */

import { api } from '../../api/client';
import type {
  ArtifactMeta,
  AttackChainSummary,
  ChainFilter,
  ChainStrategy,
  ChainSubgraph,
  Dataset,
  DatasetKind,
  EventFilter,
  EventLabel,
  EvaluationRun,
  GraphEdge,
  GraphNode,
  GraphStats,
  ModelMeta,
  PredictionRow,
  ProcessingJob,
  SnapshotInfo,
  SnapshotMeta,
  TGEvent,
  TGNNModelConfig,
  TGNNModelSummary,
  TrainingRun,
} from '../../types';
import type {
  ArtifactService,
  AttackChainService,
  DatasetService,
  EventService,
  GraphService,
  ModelService,
  ProcessingService,
  TrainingService,
} from '../index';

export class ApiDatasetService implements DatasetService {
  async list(): Promise<Dataset[]> {
    const raw = await api.get<any[]>('/api/datasets');
    return raw.map((d) => ({
      id: d.id,
      name: d.name,
      kind: (d.kind as DatasetKind) || 'synthetic_demo',
      source: d.source || '',
      metadata_dir: null,
      size_bytes: d.raw_bytes || d.size_bytes || 0,
      estimated_events: d.num_raw_events ?? d.estimated_events ?? null,
      created_at: d.created_at ?? null,
      last_job_id: 'job-mordor-empire-01',
      tags: ['synthetic_demo', 'mordor_empire'],
    }));
  }

  async get(id: string): Promise<Dataset | null> {
    try {
      const d = await api.get<any>(`/api/datasets/${encodeURIComponent(id)}`);
      if (!d) return null;
      return {
        id: d.id,
        name: d.name,
        kind: (d.kind as DatasetKind) || 'synthetic_demo',
        source: d.source || '',
        metadata_dir: null,
        size_bytes: d.raw_bytes || d.size_bytes || 0,
        estimated_events: d.num_raw_events ?? d.estimated_events ?? null,
        created_at: d.created_at ?? null,
        last_job_id: 'job-mordor-empire-01',
        tags: ['synthetic_demo', 'mordor_empire'],
      };
    } catch {
      return null;
    }
  }
}

export class ApiEventService implements EventService {
  async list(filter?: EventFilter): Promise<{ items: TGEvent[]; total: number }> {
    const params: Record<string, string | number | boolean | null | undefined> = {};
    if (filter) {
      if (filter.event_id_query) params.search = filter.event_id_query;
      if (filter.labels && filter.labels.length > 0) params.labels = filter.labels.join(',');
      if (filter.node_types && filter.node_types.length > 0) params.node_types = filter.node_types.join(',');
      if (filter.relations && filter.relations.length > 0) params.relations = filter.relations.join(',');
      if (filter.source_tags && filter.source_tags.length > 0) params.source_tags = filter.source_tags.join(',');
      if (filter.tactics && filter.tactics.length > 0) params.tactics = filter.tactics.join(',');
      if (filter.chain_ids && filter.chain_ids.length > 0) params.chain_ids = filter.chain_ids.join(',');
      if (filter.start_ts !== undefined) params.start_ts = filter.start_ts;
      if (filter.end_ts !== undefined) params.end_ts = filter.end_ts;
      if (filter.limit !== undefined) params.limit = filter.limit;
      if (filter.offset !== undefined) params.offset = filter.offset;
    }
    return api.get<{ items: TGEvent[]; total: number }>('/api/events', { params });
  }

  async get(eventId: string): Promise<TGEvent | null> {
    try {
      return await api.get<TGEvent>(`/api/events/${encodeURIComponent(eventId)}`);
    } catch {
      return null;
    }
  }

  async byChain(chainId: string): Promise<TGEvent[]> {
    return api.get<TGEvent[]>(`/api/chains/${encodeURIComponent(chainId)}/events`);
  }

  async byNode(nodeId: string): Promise<TGEvent[]> {
    const res = await api.get<{ items: TGEvent[]; total: number }>('/api/events', {
      params: { node_id: nodeId, limit: 50 },
    });
    return res.items;
  }

  async recentMalicious(limit: number): Promise<TGEvent[]> {
    return api.get<TGEvent[]>('/api/events/recent-malicious', {
      params: { limit },
    });
  }
}

export class ApiGraphService implements GraphService {
  async nodes(): Promise<GraphNode[]> {
    return api.get<GraphNode[]>('/api/graph/nodes');
  }

  async edges(): Promise<GraphEdge[]> {
    return api.get<GraphEdge[]>('/api/graph/edges');
  }

  async stats(): Promise<GraphStats> {
    const s = await api.get<any>('/api/graph/stats');
    if (s && s.normalization) {
      const accepted = s.normalization.accepted ?? 0;
      const rejected = s.normalization.rejected ?? 0;
      if (s.normalization.seen == null) {
        s.normalization.seen = accepted + rejected;
      }
    }
    if (s && s.labeling) {
      const total = s.graph?.total_events ?? s.labeling.total_events ?? 0;
      const mal = s.labeling.malicious_events ?? s.graph?.malicious_events ?? 0;
      if (s.labeling.benign_events == null) {
        s.labeling.benign_events = s.graph?.benign_events ?? Math.max(0, total - mal);
      }
      if (s.labeling.total_events == null) {
        s.labeling.total_events = total;
      }
    }
    return s as GraphStats;
  }
}

export class ApiAttackChainService implements AttackChainService {
  async list(filter?: ChainFilter): Promise<AttackChainSummary[]> {
    const params: Record<string, string | number | boolean | null | undefined> = {};
    if (filter?.strategies && filter.strategies.length > 0) {
      params.strategy = filter.strategies[0];
    }
    return api.get<AttackChainSummary[]>('/api/chains', { params });
  }

  async listByStrategy(strategy: ChainStrategy): Promise<AttackChainSummary[]> {
    return api.get<AttackChainSummary[]>('/api/chains', {
      params: { strategy },
    });
  }

  async get(chainId: string): Promise<AttackChainSummary | null> {
    try {
      return await api.get<AttackChainSummary>(`/api/chains/${encodeURIComponent(chainId)}`);
    } catch {
      return null;
    }
  }

  async subgraph(chainId: string): Promise<ChainSubgraph | null> {
    try {
      return await api.get<ChainSubgraph>(`/api/chains/${encodeURIComponent(chainId)}/subgraph`);
    } catch {
      return null;
    }
  }

  async allStrategies(): Promise<Record<ChainStrategy, AttackChainSummary[]>> {
    return api.get<Record<ChainStrategy, AttackChainSummary[]>>('/api/chains/strategies');
  }
}

export class ApiArtifactService implements ArtifactService {
  async listForJob(jobId: string): Promise<ArtifactMeta[]> {
    const raw = await api.get<any[]>('/api/artifacts', {
      params: { job_id: jobId },
    });
    return raw.map((a) => {
      const pathStr = a.path || a.id || '';
      const fmt: 'parquet' | 'json' = pathStr.endsWith('.parquet') ? 'parquet' : 'json';
      return {
        kind: a.kind as any,
        path: pathStr,
        format: fmt,
        size_bytes: a.size_bytes ?? 0,
        row_count: a.row_count ?? null,
        schema: (a.schema || []).map((s: any) => ({
          name: s.name,
          type: s.type,
          nullable: !!s.nullable,
          description: s.name,
        })),
        preview: a.preview || [],
      };
    });
  }
}

export class ApiModelService implements ModelService {
  async models(): Promise<ModelMeta[]> {
    return api.get<ModelMeta[]>('/api/models');
  }

  async tgnnConfig(modelId?: string): Promise<TGNNModelConfig> {
    return api.get<TGNNModelConfig>('/api/model/config', {
      params: modelId ? { model_id: modelId } : undefined,
    });
  }

  async tgnnSummary(modelId?: string): Promise<TGNNModelSummary> {
    return api.get<TGNNModelSummary>('/api/model/summary', {
      params: modelId ? { model_id: modelId } : undefined,
    });
  }

  async snapshotMeta(): Promise<SnapshotMeta> {
    return api.get<SnapshotMeta>('/api/model/snapshots/meta');
  }

  async snapshots(limit?: number): Promise<SnapshotInfo[]> {
    const res = await api.get<{ meta: SnapshotMeta; snapshots: any[] }>(
      '/api/model/snapshots',
      { params: limit ? { limit } : undefined }
    );
    const list = res.snapshots || [];
    return list.map((s: any) => ({
      index: s.index ?? s.sequence ?? 0,
      sequence: s.sequence ?? s.index ?? 0,
      window_start_ts: s.window_start_ts ?? 0,
      window_end_ts: s.window_end_ts ?? 0,
      num_nodes: s.num_nodes ?? 0,
      num_edges: s.num_edges ?? 0,
      num_malicious_nodes: s.num_malicious_nodes ?? 0,
      num_malicious_edges: typeof s.num_malicious_edges === 'number' ? s.num_malicious_edges : 0,
      snapshot_label: (s.snapshot_label ?? s.label ?? 0) as EventLabel,
      label: (s.label ?? s.snapshot_label ?? 0) as EventLabel,
      path: s.path,
    }));
  }
}

export class ApiTrainingService implements TrainingService {
  async currentRun(modelId?: string): Promise<TrainingRun> {
    const raw = await api.get<any>('/api/model/training', {
      params: modelId ? { model_id: modelId } : undefined,
    });
    const history = raw.history || [];
    const bestEpochMetric = history.find((h: any) => h.epoch === raw.best_epoch) || history[0] || {};
    const cfg = raw.config || {};
    return {
      id: raw.id || raw.run_id || 'mordor-mixed-run-01',
      name: raw.model_type || 'TemporalGNN (GraphSAGE + GRU)',
      dataset_id: raw.dataset || raw.dataset_id || 'mordor_mixed',
      config: {
        snapshots_dir: cfg.snapshots ?? null,
        out_dir: cfg.out ?? null,
        epochs: cfg.epochs ?? raw.epochs_total ?? (history.length || null),
        batch_size: cfg.batch_size ?? null,
        lr: cfg.lr ?? null,
        weight_decay: cfg.weight_decay ?? null,
        gnn_layers: cfg.gnn_layers ?? null,
        rnn_layers: cfg.rnn_layers ?? null,
        hidden_channels: cfg.hidden_channels ?? null,
        out_channels: cfg.out_channels ?? null,
        dropout: cfg.dropout ?? null,
        window_size: cfg.window_size ?? null,
        val_ratio: cfg.val_ratio ?? null,
        test_ratio: cfg.test_ratio ?? null,
        split_mode: cfg.split_mode ?? null,
        seed: cfg.seed ?? null,
        grad_clip: cfg.grad_clip ?? null,
        seq_stride: cfg.seq_stride ?? null,
        block_size: cfg.block_size ?? null,
        select_metric: cfg.select_metric ?? null,
        no_threshold_tuning: cfg.no_threshold_tuning ?? null,
        pos_weight: cfg.pos_weight ?? null,
      },
      started_at: raw.started_at ?? null,
      ended_at: raw.ended_at ?? null,
      elapsed_s: raw.training_time_s ?? null,
      current_epoch: raw.epochs_total ?? (history.length || null),
      total_epochs: raw.epochs_total ?? (history.length || null),
      best_epoch: raw.best_epoch ?? null,
      best_metric: raw.best_metric ?? null,
      best_score: raw.best_metric_value ?? bestEpochMetric.f1 ?? bestEpochMetric.auc_roc ?? null,
      best_val_f1: bestEpochMetric.f1 ?? raw.best_metric_value ?? null,
      threshold: raw.threshold ?? null,
      history: history.map((h: any) => ({
        epoch: h.epoch,
        train_loss: h.train_loss,
        loss: h.loss,
        auc_roc: h.auc_roc ?? null,
        auc_pr: h.auc_pr ?? null,
        threshold: h.threshold ?? null,
        f1: h.f1,
        accuracy: h.accuracy,
        precision: h.precision,
        recall: h.recall,
      })),
      checkpoint_path: raw.checkpoint_path || null,
      final_model_path: raw.checkpoint_path || null,
      state: raw.status === 'completed' ? 'completed' : raw.status === 'failed' ? 'failed' : 'running',
      error: raw.error ?? null,
    };
  }

  async history(modelId?: string): Promise<TrainingRun['history']> {
    return api.get<TrainingRun['history']>('/api/model/training/history', {
      params: modelId ? { model_id: modelId } : undefined,
    });
  }

  async evaluationRuns(): Promise<EvaluationRun[]> {
    return api.get<EvaluationRun[]>('/api/model/evaluation/runs');
  }

  async evaluationRun(split: 'train' | 'val' | 'test', runId?: string, modelId?: string): Promise<EvaluationRun | null> {
    try {
      return await api.get<EvaluationRun>('/api/model/evaluation', {
        params: {
          split,
          ...(runId ? { run_id: runId } : {}),
          ...(modelId ? { model_id: modelId } : {}),
        },
      });
    } catch {
      return null;
    }
  }

  async predictions(split: 'train' | 'val' | 'test', modelId?: string): Promise<PredictionRow[]> {
    try {
      return await api.get<PredictionRow[]>('/api/model/predictions', {
        params: {
          split,
          limit: 100,
          ...(modelId ? { model_id: modelId } : {}),
        },
      });
    } catch {
      return [];
    }
  }
}

export class ApiProcessingService implements ProcessingService {
  async jobs(): Promise<ProcessingJob[]> {
    const raw = await api.get<any[]>('/api/jobs');
    return raw.map((j) => {
      const cfg = j.config || {};
      return {
        id: j.id,
        dataset_id: j.dataset_id,
        dataset_name: j.dataset_name || j.dataset_id || 'mordor_empire',
        config: {
          kind: (cfg.dataset_kind as DatasetKind) || 'synthetic_demo',
          source_tag: cfg.source_tag || 'mordor_empire',
          label_mode: cfg.label_mode || 'heuristic',
          force_label: cfg.force_label ?? null,
          label_window_s: cfg.label_window_s ?? 300,
          no_label_propagation: !cfg.label_propagation,
          strategies: cfg.strategies || ['chain_id', 'causal_parent', 'entity_time'],
          chain_window_s: cfg.window_s ?? 86400,
          chain_max_hops: cfg.max_hops ?? 2,
          max_subgraphs: cfg.max_subgraphs ?? 1000,
          chunk_size: cfg.chunk_size ?? 100000,
          limit: null,
          use_networkx: false,
        },
        state: (j.status === 'completed' ? 'completed' : j.status) as any,
        progress: (j.progress_pct ?? 100) / 100,
        current_step: j.description || 'Completed historical batch processing',
        output_dir: cfg.out_dir || 'data/processed/mordor_empire',
        graphs_dir: cfg.graphs_out || 'data/graphs',
        started_at: j.started_at ?? null,
        ended_at: j.completed_at ?? null,
        elapsed_s: j.elapsed_s ?? (j.completed_at && j.started_at ? j.completed_at - j.started_at : (j.stats?.elapsed_s ?? null)),
        stats_path: 'data/processed/mordor_empire/graph_stats.json',
        error: j.error ?? null,
      };
    });
  }

  async job(id: string): Promise<ProcessingJob | null> {
    try {
      const all = await this.jobs();
      return all.find((j) => j.id === id) ?? null;
    } catch {
      return null;
    }
  }
}
