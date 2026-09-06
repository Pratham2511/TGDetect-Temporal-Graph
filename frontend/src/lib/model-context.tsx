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

// Authoritative production model: CTU-13 Held-Out Benchmark (Scenario 47)
const PRODUCTION_MODEL: ModelMeta = {
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
};

const DEFAULT_MODELS: ModelMeta[] = [PRODUCTION_MODEL];

const ModelContext = createContext<ModelContextType>({
  models: DEFAULT_MODELS,
  activeModelId: 'ctu13_ho_c47',
  activeModel: PRODUCTION_MODEL,
  setActiveModelId: () => {},
  apiHealth: 'checking',
  healthError: null,
  refreshHealth: async () => {},
  isLoadingModels: false,
});

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [models, setModels] = useState<ModelMeta[]>(DEFAULT_MODELS);
  const [activeModelId, setActiveModelIdState] = useState<string>('ctu13_ho_c47');
  const [apiHealth, setApiHealth] = useState<ApiHealthState>('checking');
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  // Synchronize model preference from URL searchParams
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlModel = new URLSearchParams(window.location.search).get('model');
        if (urlModel && urlModel === 'ctu13_ho_c47') {
          setActiveModelIdState(urlModel);
          return;
        }
      }
      setActiveModelIdState('ctu13_ho_c47');
    } catch {
      // ignore
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

      // Fetch live models from authoritative backend
      setIsLoadingModels(true);
      try {
        const liveModels = await modelService.models();
        if (liveModels && liveModels.length > 0) {
          setModels(liveModels);
          if (liveModels[0]?.id) {
            setActiveModelIdState(liveModels[0].id);
          }
        }
      } catch (err: any) {
        console.warn('Could not fetch live models from backend:', err);
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
    return models.find((m) => m.id === activeModelId) ?? models[0] ?? PRODUCTION_MODEL;
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
