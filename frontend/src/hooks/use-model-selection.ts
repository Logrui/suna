'use client';

import { useModelStore } from '@/stores/model-store';
import { useSubscriptionData } from '@/contexts/SubscriptionContext';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAvailableModels } from '@/lib/api';
import { getLocalModels } from '@/lib/api/models';

export interface ModelOption {
  id: string;
  label: string;
  requiresSubscription: boolean;
  description?: string;
  priority?: number;
  recommended?: boolean;
  capabilities?: string[];
  contextWindow?: number;
  isLocal?: boolean;
  provider?: string;
}

// Helper function to get default model from API data
const getDefaultModel = (models: ModelOption[], hasActiveSubscription: boolean): string => {
  if (hasActiveSubscription) {
    // For premium users, find the first recommended model
    const recommendedModel = models.find(m => m.recommended);
    if (recommendedModel) return recommendedModel.id;
  }

  // For free users, find the first non-subscription model with highest priority
  const freeModels = models.filter(m => !m.requiresSubscription);
  if (freeModels.length > 0) {
    const sortedFreeModels = freeModels.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return sortedFreeModels[0].id;
  }

  // Fallback to first available model
  return models.length > 0 ? models[0].id : '';
};

export const useModelSelection = () => {
  // Fetch cloud models
  const { data: modelsData, isLoading: isLoadingCloud } = useQuery({
    queryKey: ['models', 'available'],
    queryFn: getAvailableModels,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Fetch local models (LM Studio + Ollama)
  const { data: localModelsData, isLoading: isLoadingLocal } = useQuery({
    queryKey: ['local-models'],
    queryFn: async () => {
      // console.log('🔧 useModelSelection: Fetching local models...');
      const response = await getLocalModels();
      // console.log('🔧 useModelSelection: Local models response:', response);

      // Handle error response properly
      if (!response.success || !response.data) {
        console.error('🔧 useModelSelection: Failed to fetch local models:', response.error);
        throw new Error(response.error?.message || 'Failed to fetch local models');
      }

      // console.log('🔧 useModelSelection: Local models data:', response.data);
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: subscriptionData } = useSubscriptionData();
  const { selectedModel, setSelectedModel } = useModelStore();

  const isLoading = isLoadingCloud || isLoadingLocal;

  // Transform API data to ModelOption format, merging cloud and local models
  const availableModels = useMemo<ModelOption[]>(() => {
    const models: ModelOption[] = [];

    // Add cloud models first
    if (modelsData?.models) {
      const cloudModels = modelsData.models.map(model => ({
        id: model.id, // Always use the actual model ID
        label: model.display_name || model.short_name || model.id,
        requiresSubscription: model.requires_subscription || false,
        priority: model.priority || 0,
        recommended: model.recommended || false,
        capabilities: model.capabilities || [],
        contextWindow: model.context_window || 128000,
        isLocal: false,
        provider: 'cloud'
      }));
      models.push(...cloudModels);
    }

    // Add local models and remove any duplicates
    if (localModelsData) {
      // console.log('🔧 useModelSelection: Processing local models:', localModelsData);

      // Process Ollama models
      if (localModelsData.ollama) {
        // console.log('🔧 useModelSelection: Found', localModelsData.ollama.length, 'Ollama models');

        // Remove any cloud models that match local Ollama models by name
        localModelsData.ollama.forEach(localModel => {
          const modelNameLower = localModel.name.toLowerCase();
          for (let i = models.length - 1; i >= 0; i--) {
            if (models[i].label && models[i].label.toLowerCase().includes(modelNameLower)) {
              // console.log('🔧 useModelSelection: Removing duplicate cloud model:', models[i].id, '(matches local:', localModel.id, ')');
              models.splice(i, 1);
            }
          }
        });

        // Add Ollama models with high priority
        localModelsData.ollama.forEach(model => {
          // console.log('🔧 useModelSelection: Adding Ollama model:', model.id);
          models.push({
            id: model.id, // e.g., "ollama:qwen3-coder:30b"
            label: model.name, // e.g., "qwen3-coder:30b"
            requiresSubscription: false,
            priority: 100, // High priority for local models
            recommended: false,
            capabilities: [],
            contextWindow: model.context_window || 128000,
            isLocal: true,
            provider: 'ollama'
          });
        });
      }

      // Process LM Studio models
      if (localModelsData.lm_studio) {
        // console.log('🔧 useModelSelection: Found', localModelsData.lm_studio.length, 'LM Studio models');

        // Remove any cloud models that match local LM Studio models
        localModelsData.lm_studio.forEach(localModel => {
          const modelNameLower = localModel.name.toLowerCase();
          for (let i = models.length - 1; i >= 0; i--) {
            if (models[i].label && models[i].label.toLowerCase().includes(modelNameLower)) {
              // console.log('🔧 useModelSelection: Removing duplicate cloud model:', models[i].id, '(matches local:', localModel.id, ')');
              models.splice(i, 1);
            }
          }
        });

        // Add LM Studio models with high priority
        localModelsData.lm_studio.forEach(model => {
          // console.log('🔧 useModelSelection: Adding LM Studio model:', model.id);
          models.push({
            id: model.id, // e.g., "lm_studio:hermes-2-pro"
            label: model.name, // e.g., "hermes-2-pro"
            requiresSubscription: false,
            priority: 100, // High priority for local models
            recommended: false,
            capabilities: [],
            contextWindow: model.context_window || 128000,
            isLocal: true,
            provider: 'lm_studio'
          });
        });
      }
    }

    // Sort all models by priority (local models will be first due to priority 100)
    return models.sort((a, b) => {
      // Sort by recommended first, then priority, then name
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.label.localeCompare(b.label);
    });
  }, [modelsData, localModelsData]);

  // Get accessible models based on subscription
  const accessibleModels = useMemo(() => {
    const hasActiveSubscription = subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing';
    return availableModels.filter(model => hasActiveSubscription || !model.requiresSubscription);
  }, [availableModels, subscriptionData]);

  // Initialize selected model when data loads
  useEffect(() => {
    if (isLoading || !accessibleModels.length) return;

    // If no model selected or selected model is not accessible, pick default from API data
    if (!selectedModel || !accessibleModels.some(m => m.id === selectedModel)) {
      const hasActiveSubscription = subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing';
      const defaultModelId = getDefaultModel(availableModels, hasActiveSubscription);

      // Make sure the default model is accessible
      const finalModel = accessibleModels.some(m => m.id === defaultModelId)
        ? defaultModelId
        : accessibleModels[0]?.id;

      if (finalModel) {
        console.log('🔧 useModelSelection: Setting API-determined default model:', finalModel);
        setSelectedModel(finalModel);
      }
    }
  }, [selectedModel, accessibleModels, availableModels, isLoading, setSelectedModel, subscriptionData]);

  const handleModelChange = (modelId: string) => {
    const model = accessibleModels.find(m => m.id === modelId);
    if (model) {
      console.log('🔧 useModelSelection: Changing model to:', modelId);
      setSelectedModel(modelId);
    }
  };

  return {
    selectedModel,
    setSelectedModel: handleModelChange,
    availableModels: accessibleModels,
    allModels: availableModels, // For compatibility
    isLoading,
    modelsData, // Expose raw API data for components that need it
    subscriptionStatus: (subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing') ? 'active' as const : 'no_subscription' as const,
    canAccessModel: (modelId: string) => {
      return accessibleModels.some(m => m.id === modelId);
    },
    isSubscriptionRequired: (modelId: string) => {
      const model = availableModels.find(m => m.id === modelId);
      return model?.requiresSubscription || false;
    },

    // Compatibility stubs for custom models (not needed with API-driven approach)
    handleModelChange,
    customModels: [] as any[], // Empty array since we're not using custom models
    addCustomModel: (_model: any) => { }, // No-op
    updateCustomModel: (_id: string, _model: any) => { }, // No-op
    removeCustomModel: (_id: string) => { }, // No-op

    // Get the actual model ID to send to the backend (no transformation needed now)
    getActualModelId: (modelId: string) => modelId,

    // Refresh function for compatibility (no-op since we use API)
    refreshCustomModels: () => { },
  };
};
