import { apiClient } from '@/lib/api-client';

export interface LocalModel {
  id: string;          // e.g., "lm_studio:hermes-2-pro"
  name: string;        // e.g., "hermes-2-pro"
  provider: 'lm_studio' | 'ollama';
  loaded: boolean;
  context_window?: number;
  quantization?: string;
}

export interface LocalModelsResponse {
  lm_studio: LocalModel[];
  ollama: LocalModel[];
}

export interface WarmupRequest {
  model_id: string;
}

export interface UnloadRequest {
  model_id: string;
}

export interface UnloadProviderRequest {
  provider: string;
}

export interface ModelStatusResponse {
  model_id: string;
  status: 'loaded' | 'unloaded' | 'loading' | 'error';
  error?: string;
}

/**
 * Fetch all available local models from LM Studio and Ollama
 */
export async function getLocalModels() {
  return apiClient.get<LocalModelsResponse>('/models/local', {
    showErrors: true,
    errorContext: {
      operation: 'getLocalModels',
      resource: 'local-models',
    },
  });
}

/**
 * Request to warmup (load) a model in LM Studio or Ollama
 * This returns immediately while the actual loading happens in the background
 */
export async function warmupModel(modelId: string) {
  return apiClient.post<{ success: boolean; message: string }>('/models/warmup', {
    model_id: modelId
  }, {
    showErrors: true,
    errorContext: {
      operation: 'warmupModel',
      resource: modelId,
    },
  });
}

/**
 * Unload a specific model
 */
export async function unloadModel(modelId: string) {
  return apiClient.post<{ success: boolean; message: string }>('/models/unload', {
    model_id: modelId
  }, {
    showErrors: true,
    errorContext: {
      operation: 'unloadModel',
      resource: modelId,
    },
  });
}

/**
 * Unload all models from a provider
 */
export async function unloadProvider(provider: string) {
  return apiClient.post<{ success: boolean; message: string; unloaded_models: string[] }>('/models/unload_provider', {
    provider
  }, {
    showErrors: true,
    errorContext: {
      operation: 'unloadProvider',
      resource: provider,
    },
  });
}

/**
 * Get the status of a model
 */
export async function getModelStatus(modelId: string) {
  return apiClient.get<ModelStatusResponse>(`/models/${modelId}/status`, {
    showErrors: false,
    errorContext: {
      operation: 'getModelStatus',
      resource: modelId,
    },
  });
}
