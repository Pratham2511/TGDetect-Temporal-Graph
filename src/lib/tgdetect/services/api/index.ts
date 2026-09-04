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
  EventFilter,
  EvaluationRun,
  GraphEdge,
  GraphNode,
  GraphStats,
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
    return api.get<Dataset[]>('/api/datasets');
  }

  async get(id: string): Promise<Dataset | null> {
    try {
      return await api.get<Dataset>(`/api/datasets/${encodeURIComponent(id)}`);
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
    return api.get<GraphStats>('/api/graph/stats');
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
    return api.get<ArtifactMeta[]>('/api/artifacts', {
      params: { job_id: jobId },
    });
  }
}

export class ApiModelService implements ModelService {
  async tgnnConfig(): Promise<TGNNModelConfig> {
    return api.get<TGNNModelConfig>('/api/model/config');
  }

  async tgnnSummary(): Promise<TGNNModelSummary> {
    return api.get<TGNNModelSummary>('/api/model/summary');
  }

  async snapshotMeta(): Promise<SnapshotMeta> {
    return api.get<SnapshotMeta>('/api/model/snapshots/meta');
  }

  async snapshots(limit?: number): Promise<SnapshotInfo[]> {
    const res = await api.get<{ meta: SnapshotMeta; snapshots: SnapshotInfo[] }>(
      '/api/model/snapshots',
      { params: limit ? { limit } : undefined }
    );
    return res.snapshots || [];
  }
}

export class ApiTrainingService implements TrainingService {
  async currentRun(): Promise<TrainingRun> {
    return api.get<TrainingRun>('/api/model/training');
  }

  async history(): Promise<TrainingRun['history']> {
    return api.get<TrainingRun['history']>('/api/model/training/history');
  }

  async evaluationRuns(): Promise<EvaluationRun[]> {
    return api.get<EvaluationRun[]>('/api/model/evaluation/runs');
  }

  async evaluationRun(split: 'train' | 'val' | 'test'): Promise<EvaluationRun | null> {
    try {
      return await api.get<EvaluationRun>('/api/model/evaluation', {
        params: { split },
      });
    } catch {
      return null;
    }
  }

  async predictions(split: 'train' | 'val' | 'test'): Promise<PredictionRow[]> {
    try {
      return await api.get<PredictionRow[]>('/api/model/predictions', {
        params: { split, limit: 100 },
      });
    } catch {
      return [];
    }
  }
}

export class ApiProcessingService implements ProcessingService {
  async jobs(): Promise<ProcessingJob[]> {
    return api.get<ProcessingJob[]>('/api/jobs');
  }

  async job(id: string): Promise<ProcessingJob | null> {
    try {
      return await api.get<ProcessingJob>(`/api/jobs/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  }
}
