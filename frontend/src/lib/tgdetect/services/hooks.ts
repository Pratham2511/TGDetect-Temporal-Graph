'use client';

import { useEffect, useState } from 'react';
import {
  analyticsService,
  artifactService,
  chainService,
  datasetService,
  eventService,
  graphService,
  modelService,
  processingService,
  trainingService,
} from './index';
import type {
  ArtifactMeta,
  AttackChainSummary,
  ChainStrategy,
  ChainSubgraph,
  Dataset,
  EventFilter,
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
  EvaluationRun,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight hook — wraps a promise-returning service call in state
// (loading / success / error). UI is decoupled from the service impl.
// ─────────────────────────────────────────────────────────────────────────────

export type AsyncState = 'idle' | 'loading' | 'success' | 'empty' | 'failed';

export interface AsyncValue<T> {
  state: AsyncState;
  data: T | null;
  error: string | null;
  reload: () => void;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncValue<T> {
  const [state, setState] = useState<AsyncState>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Reset to loading state when deps change. This setState-in-effect is
    // intentional and idiomatic for async data fetching.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState('loading');
    fn()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState('success');
        if (Array.isArray(d) && d.length === 0) setState('empty');
        else if (d == null || (typeof d === 'object' && !Array.isArray(d) && Object.keys(d as object).length === 0)) {
          // Treat empty object as empty for some services.
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? String(err));
        setState('failed');
      });
    return () => { cancelled = true; };
  }, [...deps, reloadCount]);

  return { state, data, error, reload: () => setReloadCount((n) => n + 1) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-service hooks — UI imports these
// ─────────────────────────────────────────────────────────────────────────────

export function useDatasets() {
  return useAsync<Dataset[]>(() => datasetService.list(), []);
}

export function useEvents(filter?: EventFilter) {
  return useAsync(
    () => eventService.list(filter),
    [filter?.event_id_query, filter?.labels?.join(','), filter?.node_types?.join(','), filter?.relations?.join(','), filter?.source_tags?.join(','), filter?.tactics?.join(','), filter?.chain_ids?.join(','), filter?.start_ts, filter?.end_ts, filter?.limit, filter?.offset],
  );
}

export function useEvent(eventId: string | null) {
  return useAsync(() => (eventId ? eventService.get(eventId) : Promise.resolve(null)), [eventId]);
}

export function useChainEvents(chainId: string | null) {
  return useAsync(() => (chainId ? eventService.byChain(chainId) : Promise.resolve([])), [chainId]);
}

export function useNodeEvents(nodeId: string | null) {
  return useAsync(() => (nodeId ? eventService.byNode(nodeId) : Promise.resolve([])), [nodeId]);
}

export function useRecentMalicious(limit: number) {
  return useAsync(() => eventService.recentMalicious(limit), [limit]);
}

export function useGraphNodes() {
  return useAsync<GraphNode[]>(() => graphService.nodes(), []);
}

export function useGraphEdges() {
  return useAsync<GraphEdge[]>(() => graphService.edges(), []);
}

export function useGraphStats() {
  return useAsync<GraphStats>(() => graphService.stats(), []);
}

export function useChains() {
  return useAsync<AttackChainSummary[]>(() => chainService.list(), []);
}

export function useChain(chainId: string | null) {
  return useAsync(() => (chainId ? chainService.get(chainId) : Promise.resolve(null)), [chainId]);
}

export function useChainSubgraph(chainId: string | null) {
  return useAsync<ChainSubgraph | null>(() => (chainId ? chainService.subgraph(chainId) : Promise.resolve(null)), [chainId]);
}

export function useChainsByStrategy(strategy: ChainStrategy | null) {
  return useAsync(() => (strategy ? chainService.listByStrategy(strategy) : Promise.resolve([])), [strategy]);
}

export function useJobs() {
  return useAsync<ProcessingJob[]>(() => processingService.jobs(), []);
}

export function useJob(id: string | null) {
  return useAsync(() => (id ? processingService.job(id) : Promise.resolve(null)), [id]);
}

export function useArtifacts(jobId: string | null) {
  return useAsync<ArtifactMeta[]>(() => (jobId ? artifactService.listForJob(jobId) : Promise.resolve([])), [jobId]);
}

export function useModels() {
  return useAsync<ModelMeta[]>(() => modelService.models(), []);
}

export function useTGNNConfig(modelId?: string) {
  return useAsync<TGNNModelConfig>(() => modelService.tgnnConfig(modelId), [modelId]);
}

export function useTGNNSummary(modelId?: string) {
  return useAsync<TGNNModelSummary>(() => modelService.tgnnSummary(modelId), [modelId]);
}

export function useSnapshotMeta() {
  return useAsync<SnapshotMeta>(() => modelService.snapshotMeta(), []);
}

export function useSnapshots(limit?: number) {
  return useAsync<SnapshotInfo[]>(() => modelService.snapshots(limit), [limit]);
}

export function useTrainingRun(modelId?: string) {
  return useAsync<TrainingRun>(() => trainingService.currentRun(modelId), [modelId]);
}

export function useEvaluationRuns() {
  return useAsync<EvaluationRun[]>(() => trainingService.evaluationRuns(), []);
}

export function useEvaluationRun(split: 'train' | 'val' | 'test', runId?: string, modelId?: string) {
  return useAsync<EvaluationRun | null>(
    () => trainingService.evaluationRun(split, runId, modelId),
    [split, runId, modelId]
  );
}

export function usePredictions(split: 'train' | 'val' | 'test', modelId?: string) {
  return useAsync<PredictionRow[]>(() => trainingService.predictions(split, modelId), [split, modelId]);
}

export function useEventsAnalytics() {
  return useAsync(() => analyticsService.eventsAnalytics(), []);
}

export function useGraphAnalytics() {
  return useAsync(() => analyticsService.graphAnalytics(), []);
}

export function useAttacksAnalytics() {
  return useAsync(() => analyticsService.attacksAnalytics(), []);
}

export function useDatasetsAnalytics() {
  return useAsync(() => analyticsService.datasetsAnalytics(), []);
}
