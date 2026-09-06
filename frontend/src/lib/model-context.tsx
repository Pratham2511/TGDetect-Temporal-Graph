'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api, API_BASE_URL } from '@/lib/tgdetect/api/client';
import { modelService } from '@/lib/tgdetect/services';
import type { ModelMeta } from '@/lib/tgdetect/types';

export type ApiHealthState = 'checking' | 'connected' | 'offline';

export interface ModelContextType {
  models: ModelMeta[];
  activeModelId: string;
  activeModel: ModelMeta | null;
  setActiveModelId: (id: string) => void;
  apiHealth: ApiHealthState;
  healthError: string | null;
  refreshHealth: () => Promise<void>;
  isLoadingModels: boolean;
}

// Canonical fallback models based on verified repository checkpoints
const DEFAULT_MODELS: ModelMeta[] = [
  {
    id: 'mordor_mixed',
    name: 'Mordor Mixed (Host Threat)',
    description: 'TemporalGNN (GraphSAGE + GRU) trained on Mordor multi-stage cyber range host telemetry',
    target: 'node',
    dataset_id: 'mordor_empire',
    dataset_name: 'Mordor Empire (Synthetic Demo)',
    checkpoint: 'best_model.pt',
    checkpoint_path: 'backend/models/checkpoints/mordor_mixed/best_model.pt',
    trainable_parameters: 36098,
    total_parameters: 36098,
    in_channels: 10,
    edge_dim: 8,
    output_heads: ['node_classifier', 'snapshot_classifier'],
    has_edge_classifier: false,
    evaluation_run_id: 'eval_test_mordor_mixed',
    evaluation_status: 'evaluated',
    metrics: {
      roc_auc: 0.7447,
      pr_auc: 0.2363,
      f1: 0.1004,
      precision: 0.0528,
      recall: 1.0,
      accuracy: 0.0528,
      samples: 20290,
      positives: 1072,
    },
  },
  {
    id: 'ctu13_ho_c47',
    name: 'CTU-13 Held-Out (Scenario 47)',
    description: 'TemporalGNN (GraphSAGE + GRU + EdgeHead) trained on CTU-13 botnet captures and evaluated on held-out Scenario 47',
    target: 'edge',
    dataset_id: 'ctu13_c47',
    dataset_name: 'CTU-13 Scenario 47 (NetFlow)',
    checkpoint: 'best_model.pt',
    checkpoint_path: 'backend/models/checkpoints/ctu13_ho_c47/best_model.pt',
    trainable_parameters: 38787,
    total_parameters: 38787,
    in_channels: 1,
    edge_dim: 37,
    output_heads: ['node_classifier', 'snapshot_classifier', 'edge_classifier'],
    has_edge_classifier: true,
    evaluation_run_id: 'eval_test_ctu13_ho_c47',
    evaluation_status: 'evaluated',
    metrics: {
      roc_auc: 0.9983,
      pr_auc: 0.7065,
      f1: 0.8388,
      precision: 0.7483,
      recall: 0.9543,
      accuracy: 0.9968,
      recall_1pct_fpr: 0.9958,
      samples: 1068851,
      positives: 9256,
    },
  },
];

const ModelContext = createContext<ModelContextType>({
  models: DEFAULT_MODELS,
  activeModelId: 'mordor_mixed',
  activeModel: DEFAULT_MODELS[0],
  setActiveModelId: () => {},
  apiHealth: 'checking',
  healthError: null,
  refreshHealth: async () => {},
  isLoadingModels: false,
});

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [models, setModels] = useState<ModelMeta[]>(DEFAULT_MODELS);
  const [activeModelId, setActiveModelIdState] = useState<string>('mordor_mixed');
  const [apiHealth, setApiHealth] = useState<ApiHealthState>('checking');
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  // Load saved model preference from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tgdetect_active_model');
      if (saved && (saved === 'mordor_mixed' || saved === 'ctu13_ho_c47')) {
        setActiveModelIdState(saved);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const setActiveModelId = useCallback((id: string) => {
    setActiveModelIdState(id);
    try {
      localStorage.setItem('tgdetect_active_model', id);
    } catch {
      // ignore
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    setApiHealth('checking');
    try {
      await api.checkHealth();
      setApiHealth('connected');
      setHealthError(null);

      // Fetch live models from backend
      setIsLoadingModels(true);
      try {
        const liveModels = await modelService.models();
        if (liveModels && liveModels.length > 0) {
          setModels(liveModels);
        }
      } catch (err: any) {
        console.warn('Could not fetch live models, using default metadata:', err);
      } finally {
        setIsLoadingModels(false);
      }
    } catch (err: any) {
      setApiHealth('offline');
      setHealthError(err?.message ?? `Cannot reach TGDetect API at ${API_BASE_URL}`);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    // Poll health periodically every 20 seconds
    const interval = setInterval(refreshHealth, 20000);
    return () => clearInterval(interval);
  }, [refreshHealth]);

  const activeModel = useMemo(() => {
    return models.find((m) => m.id === activeModelId) ?? models[0] ?? DEFAULT_MODELS[0];
  }, [models, activeModelId]);

  const value = useMemo(
    () => ({
      models,
      activeModelId,
      activeModel,
      setActiveModelId,
      apiHealth,
      healthError,
      refreshHealth,
      isLoadingModels,
    }),
    [models, activeModelId, activeModel, setActiveModelId, apiHealth, healthError, refreshHealth, isLoadingModels]
  );

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

export const useModel = () => useContext(ModelContext);
