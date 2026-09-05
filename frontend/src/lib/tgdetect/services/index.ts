/**
 * TGDetect service layer — UI → service interface → mock implementation.
 *
 * Every page component imports the SERVICE INTERFACE (e.g. `EventService`)
 * or a typed hook from this file. The mock implementation lives below.
 * Swapping mocks for a real API client later means implementing the same
 * interface with `fetch` calls — zero UI changes required.
 */

import {
  mockArtifacts,
  mockChainsAllStrategies,
  mockChainsPrimary,
  mockDatasets,
  mockEdges,
  mockEvents,
  mockEvaluationRun,
  mockEvaluationRuns,
  mockGraphStats,
  mockJobById,
  mockJobs,
  mockNodes,
  mockPredictions,
  mockSnapshotMeta,
  mockSnapshots,
  mockSubgraph,
  mockSubgraphs,
  mockTGNNConfig,
  mockTGNNSummary,
  mockTrainingHistory,
  mockTrainingRun,
} from '../mocks';
import {
  ApiArtifactService,
  ApiAttackChainService,
  ApiDatasetService,
  ApiEventService,
  ApiGraphService,
  ApiModelService,
  ApiProcessingService,
  ApiTrainingService,
} from './api';
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
  TrainingConfig,
  TrainingRun,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Async delay helper — simulates network latency without affecting semantics
// ─────────────────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Service interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface DatasetService {
  list(): Promise<Dataset[]>;
  get(id: string): Promise<Dataset | null>;
}

export interface EventService {
  list(filter?: EventFilter): Promise<{ items: TGEvent[]; total: number }>;
  get(eventId: string): Promise<TGEvent | null>;
  byChain(chainId: string): Promise<TGEvent[]>;
  byNode(nodeId: string): Promise<TGEvent[]>;
  recentMalicious(limit: number): Promise<TGEvent[]>;
}

export interface GraphService {
  nodes(): Promise<GraphNode[]>;
  edges(): Promise<GraphEdge[]>;
  stats(): Promise<GraphStats>;
}

export interface AttackChainService {
  list(filter?: ChainFilter): Promise<AttackChainSummary[]>;
  listByStrategy(strategy: ChainStrategy): Promise<AttackChainSummary[]>;
  get(chainId: string): Promise<AttackChainSummary | null>;
  subgraph(chainId: string): Promise<ChainSubgraph | null>;
  allStrategies(): Promise<Record<ChainStrategy, AttackChainSummary[]>>;
}

export interface ArtifactService {
  listForJob(jobId: string): Promise<ArtifactMeta[]>;
}

export interface ModelService {
  tgnnConfig(): Promise<TGNNModelConfig>;
  tgnnSummary(): Promise<TGNNModelSummary>;
  snapshotMeta(): Promise<SnapshotMeta>;
  snapshots(limit?: number): Promise<SnapshotInfo[]>;
}

export interface TrainingService {
  currentRun(): Promise<TrainingRun>;
  history(): Promise<TrainingRun['history']>;
  evaluationRuns(): Promise<EvaluationRun[]>;
  evaluationRun(split: 'train' | 'val' | 'test'): Promise<EvaluationRun | null>;
  predictions(split: 'train' | 'val' | 'test'): Promise<PredictionRow[]>;
}

export interface ProcessingService {
  jobs(): Promise<ProcessingJob[]>;
  job(id: string): Promise<ProcessingJob | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: filter events in-memory (mirrors what an API would do)
// ─────────────────────────────────────────────────────────────────────────────

function applyEventFilter(events: TGEvent[], filter?: EventFilter): { items: TGEvent[]; total: number } {
  if (!filter) return { items: events, total: events.length };
  let out = events.slice();
  if (filter.event_id_query) {
    const q = filter.event_id_query.toLowerCase();
    out = out.filter((e) => e.event_id.toLowerCase().includes(q));
  }
  if (filter.labels && filter.labels.length > 0) {
    out = out.filter((e) => filter.labels!.includes(e.label));
  }
  if (filter.node_types && filter.node_types.length > 0) {
    const set = new Set(filter.node_types);
    out = out.filter((e) => set.has(e.src_type) || set.has(e.dst_type));
  }
  if (filter.relations && filter.relations.length > 0) {
    const set = new Set(filter.relations);
    out = out.filter((e) => set.has(e.relation));
  }
  if (filter.source_tags && filter.source_tags.length > 0) {
    const set = new Set(filter.source_tags);
    out = out.filter((e) => set.has(e.source_tag));
  }
  if (filter.tactics && filter.tactics.length > 0) {
    const set = new Set(filter.tactics);
    out = out.filter((e) => e.tactics.some((t) => set.has(t)));
  }
  if (filter.chain_ids && filter.chain_ids.length > 0) {
    const set = new Set(filter.chain_ids);
    out = out.filter((e) => e.chain_id !== null && set.has(e.chain_id));
  }
  if (filter.start_ts !== undefined) out = out.filter((e) => e.ts >= filter.start_ts!);
  if (filter.end_ts !== undefined) out = out.filter((e) => e.ts <= filter.end_ts!);
  const total = out.length;
  const offset = filter.offset ?? 0;
  const limit = filter.limit ?? 50;
  return { items: out.slice(offset, offset + limit), total };
}

function applyChainFilter(chains: AttackChainSummary[], filter?: ChainFilter): AttackChainSummary[] {
  if (!filter) return chains;
  let out = chains.slice();
  if (filter.strategies && filter.strategies.length > 0) {
    const set = new Set(filter.strategies);
    out = out.filter((c) => set.has(c.strategy));
  }
  if (filter.chain_id_query) {
    const q = filter.chain_id_query.toLowerCase();
    out = out.filter((c) => c.chain_id.toLowerCase().includes(q));
  }
  if (filter.min_events !== undefined) out = out.filter((c) => c.num_events >= filter.min_events!);
  if (filter.max_events !== undefined) out = out.filter((c) => c.num_events <= filter.max_events!);
  if (filter.min_duration_s !== undefined) out = out.filter((c) => c.duration_s >= filter.min_duration_s!);
  if (filter.max_duration_s !== undefined) out = out.filter((c) => c.duration_s <= filter.max_duration_s!);
  if (filter.limit !== undefined) out = out.slice(0, filter.limit);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock implementations
// ─────────────────────────────────────────────────────────────────────────────

class MockDatasetService implements DatasetService {
  async list(): Promise<Dataset[]> {
    await delay(80);
    return mockDatasets();
  }
  async get(id: string): Promise<Dataset | null> {
    await delay(40);
    return mockDatasets().find((d) => d.id === id) ?? null;
  }
}

class MockEventService implements EventService {
  async list(filter?: EventFilter): Promise<{ items: TGEvent[]; total: number }> {
    await delay(120);
    return applyEventFilter(mockEvents(), filter);
  }
  async get(eventId: string): Promise<TGEvent | null> {
    await delay(40);
    return mockEvents().find((e) => e.event_id === eventId) ?? null;
  }
  async byChain(chainId: string): Promise<TGEvent[]> {
    await delay(80);
    return mockEvents().filter((e) => e.chain_id === chainId);
  }
  async byNode(nodeId: string): Promise<TGEvent[]> {
    await delay(80);
    return mockEvents().filter((e) => e.src_id === nodeId || e.dst_id === nodeId);
  }
  async recentMalicious(limit: number): Promise<TGEvent[]> {
    await delay(80);
    return mockEvents()
      .filter((e) => e.label === 1)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
  }
}

class MockGraphService implements GraphService {
  async nodes(): Promise<GraphNode[]> {
    await delay(80);
    return mockNodes();
  }
  async edges(): Promise<GraphEdge[]> {
    await delay(80);
    return mockEdges();
  }
  async stats(): Promise<GraphStats> {
    await delay(80);
    return mockGraphStats();
  }
}

class MockAttackChainService implements AttackChainService {
  async list(filter?: ChainFilter): Promise<AttackChainSummary[]> {
    await delay(80);
    return applyChainFilter(mockChainsPrimary(), filter);
  }
  async listByStrategy(strategy: ChainStrategy): Promise<AttackChainSummary[]> {
    await delay(60);
    return mockChainsAllStrategies()[strategy];
  }
  async get(chainId: string): Promise<AttackChainSummary | null> {
    await delay(40);
    return mockChainsPrimary().find((c) => c.chain_id === chainId) ?? null;
  }
  async subgraph(chainId: string): Promise<ChainSubgraph | null> {
    await delay(60);
    return mockSubgraph(chainId);
  }
  async allStrategies(): Promise<Record<ChainStrategy, AttackChainSummary[]>> {
    await delay(60);
    return mockChainsAllStrategies();
  }
}

class MockArtifactService implements ArtifactService {
  async listForJob(jobId: string): Promise<ArtifactMeta[]> {
    await delay(80);
    return mockArtifacts(jobId);
  }
}

class MockModelService implements ModelService {
  async tgnnConfig(): Promise<TGNNModelConfig> {
    await delay(40);
    return mockTGNNConfig();
  }
  async tgnnSummary(): Promise<TGNNModelSummary> {
    await delay(40);
    return mockTGNNSummary();
  }
  async snapshotMeta(): Promise<SnapshotMeta> {
    await delay(40);
    return mockSnapshotMeta();
  }
  async snapshots(limit?: number): Promise<SnapshotInfo[]> {
    await delay(80);
    return mockSnapshots(limit);
  }
}

class MockTrainingService implements TrainingService {
  async currentRun(): Promise<TrainingRun> {
    await delay(40);
    return mockTrainingRun();
  }
  async history(): Promise<TrainingRun['history']> {
    await delay(60);
    return mockTrainingHistory();
  }
  async evaluationRuns(): Promise<EvaluationRun[]> {
    await delay(60);
    return mockEvaluationRuns();
  }
  async evaluationRun(split: 'train' | 'val' | 'test'): Promise<EvaluationRun | null> {
    await delay(40);
    return mockEvaluationRun(split);
  }
  async predictions(split: 'train' | 'val' | 'test'): Promise<PredictionRow[]> {
    await delay(80);
    return mockPredictions(split);
  }
}

class MockProcessingService implements ProcessingService {
  async jobs(): Promise<ProcessingJob[]> {
    await delay(80);
    return mockJobs();
  }
  async job(id: string): Promise<ProcessingJob | null> {
    await delay(40);
    return mockJobById(id);
  }
}

const isMockMode = process.env.NEXT_PUBLIC_TGDETECT_MOCK_MODE === 'true';

export const datasetService: DatasetService = isMockMode
  ? new MockDatasetService()
  : new ApiDatasetService();
export const eventService: EventService = isMockMode
  ? new MockEventService()
  : new ApiEventService();
export const graphService: GraphService = isMockMode
  ? new MockGraphService()
  : new ApiGraphService();
export const chainService: AttackChainService = isMockMode
  ? new MockAttackChainService()
  : new ApiAttackChainService();
export const artifactService: ArtifactService = isMockMode
  ? new MockArtifactService()
  : new ApiArtifactService();
export const modelService: ModelService = isMockMode
  ? new MockModelService()
  : new ApiModelService();
export const trainingService: TrainingService = isMockMode
  ? new MockTrainingService()
  : new ApiTrainingService();
export const processingService: ProcessingService = isMockMode
  ? new MockProcessingService()
  : new ApiProcessingService();
