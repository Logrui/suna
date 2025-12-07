'use client';

import React, { memo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface Model {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google' | 'other';
  description?: string;
  maxTokens?: number;
}

const AVAILABLE_MODELS: Model[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Most capable model, best for complex reasoning',
    maxTokens: 200000,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'Fast and efficient for simple tasks',
    maxTokens: 200000,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4 Omni',
    provider: 'openai',
    description: 'Multimodal capabilities, excellent reasoning',
    maxTokens: 128000,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and cost-effective',
    maxTokens: 128000,
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Experimental fast model',
    maxTokens: 1000000,
  },
];

interface ModelSelectorProps {
  /** Currently selected model ID */
  value?: string;

  /** Called when model selection changes */
  onChange: (modelId: string) => void;

  /** Optional CSS class */
  className?: string;

  /** Show model descriptions */
  showDescriptions?: boolean;

  /** Disable the selector */
  disabled?: boolean;
}

/**
 * ModelSelector Component
 *
 * Dropdown for selecting LLM model for AI step nodes.
 * Displays model name, provider, and optional description.
 *
 * Maps to: T038 (Phase 4: User Story 2)
 */
export const ModelSelector = memo<ModelSelectorProps>(
  ({ value, onChange, className = '', showDescriptions = true, disabled = false }) => {
    const selectedModel = AVAILABLE_MODELS.find((m) => m.id === value);

    const handleValueChange = (modelId: string) => {
      onChange(modelId);
    };

    return (
      <div className={`space-y-2 ${className}`}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Model
        </label>

        <Select value={value || ''} onValueChange={handleValueChange} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder="Select a model..."
              defaultValue={value}
            />
          </SelectTrigger>

          <SelectContent>
            {/* Group by provider */}
            {['anthropic', 'openai', 'google', 'other'].map((provider) => {
              const modelsInProvider = AVAILABLE_MODELS.filter((m) => m.provider === provider);
              if (modelsInProvider.length === 0) return null;

              return (
                <div key={provider}>
                  {/* Provider label */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </div>

                  {/* Models in this provider */}
                  {modelsInProvider.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        {selectedModel?.id === model.id && (
                          <Check size={16} className="text-blue-600" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </div>
              );
            })}
          </SelectContent>
        </Select>

        {/* Show selected model description */}
        {showDescriptions && selectedModel?.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {selectedModel.description}
          </p>
        )}

        {/* Show max tokens info */}
        {selectedModel?.maxTokens && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Max tokens: {selectedModel.maxTokens.toLocaleString()}
          </p>
        )}
      </div>
    );
  },
);

ModelSelector.displayName = 'ModelSelector';

export default ModelSelector;
