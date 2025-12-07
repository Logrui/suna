'use client';

import React, { memo, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ModelSelector from './ModelSelector';
import ToolSelector from './ToolSelector';
import PromptEditor from './PromptEditor';
import type { AIStepNodeData } from '@/types/workflows';
import type { Variable } from './VariableMentionPlugin';

interface AIStepNodeDataWithConfig extends Omit<AIStepNodeData, 'config'> {
  config: AIStepNodeData['config'] & {
    prompt?: string;
    model?: string;
    tools?: string[];
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
    output_variable?: string;
  };
}

interface AIStepConfigProps {
  /** Node data containing current configuration */
  nodeData: AIStepNodeDataWithConfig;

  /** Called when any configuration value changes */
  onConfigChange: (config: Partial<AIStepNodeDataWithConfig['config']>) => void;

  /** All available variables in workflow (for autocomplete and validation) */
  availableVariables?: Variable[];

  /** Validation errors */
  errors?: Record<string, string>;

  /** Optional CSS class */
  className?: string;
}

/**
 * AIStepConfig Component
 *
 * Property panel for configuring AI step nodes. Provides UI for:
 * - Model selection
 * - Prompt editing with variable references
 * - Tool selection
 * - Temperature and token parameters
 * - System prompt override
 * - Output variable naming
 *
 * Maps to: T037 (Phase 4: User Story 2)
 */
export const AIStepConfig = memo<AIStepConfigProps>(
  ({
    nodeData,
    onConfigChange,
    availableVariables = [],
    errors = {},
    className = '',
  }) => {
    const config = nodeData.config || {};

    // Handlers for each field
    const handleModelChange = useCallback(
      (modelId: string) => {
        onConfigChange({ model: modelId });
      },
      [onConfigChange],
    );

    const handleToolsChange = useCallback(
      (tools: string[]) => {
        onConfigChange({ tools });
      },
      [onConfigChange],
    );

    const handlePromptChange = useCallback(
      (text: string) => {
        onConfigChange({ prompt: text });
      },
      [onConfigChange],
    );

    const handleSystemPromptChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onConfigChange({ system_prompt: e.target.value });
      },
      [onConfigChange],
    );

    const handleTemperatureChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value)) {
          onConfigChange({ temperature: value });
        }
      },
      [onConfigChange],
    );

    const handleMaxTokensChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
          onConfigChange({ max_tokens: value });
        }
      },
      [onConfigChange],
    );

    const handleOutputVariableChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onConfigChange({ output_variable: e.target.value });
      },
      [onConfigChange],
    );

    // Validation helpers
    const isValid = useMemo(() => {
      return !!(config.prompt && config.model && config.tools && config.tools.length > 0);
    }, [config.prompt, config.model, config.tools]);

    const missingFields = useMemo(() => {
      const missing: string[] = [];
      if (!config.prompt) missing.push('prompt');
      if (!config.model) missing.push('model');
      if (!config.tools || config.tools.length === 0) missing.push('tools');
      return missing;
    }, [config.prompt, config.model, config.tools]);

    return (
      <Card className={`w-full ${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">AI Step Configuration</CardTitle>
          <CardDescription className="text-xs">
            Configure model, prompt, tools, and parameters for this AI step
          </CardDescription>

          {!isValid && (
            <Alert className="mt-3 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="ml-2 text-sm text-yellow-800 dark:text-yellow-200">
                Missing required fields: {missingFields.join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
            </TabsList>

            {/* Basic Tab: Model, Tools, Prompt */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              {/* Model Selector */}
              <ModelSelector
                value={config.model}
                onChange={handleModelChange}
                showDescriptions={true}
              />

              {errors.model && (
                <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="ml-2 text-sm text-red-800 dark:text-red-200">
                    {errors.model}
                  </AlertDescription>
                </Alert>
              )}

              {/* Tool Selector */}
              <ToolSelector
                value={config.tools || []}
                onChange={handleToolsChange}
              />

              {errors.tools && (
                <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="ml-2 text-sm text-red-800 dark:text-red-200">
                    {errors.tools}
                  </AlertDescription>
                </Alert>
              )}

              {/* Prompt with Rich Text Editor */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Prompt *
                </label>
                <PromptEditor
                  value={config.prompt || ''}
                  onChange={handlePromptChange}
                  variables={availableVariables || []}
                  minHeight="140px"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {availableVariables && availableVariables.length > 0 ? (
                    <>
                      Available variables: {availableVariables.map((v) => `@${v.name}`).join(', ')}
                    </>
                  ) : (
                    <>
                      Tip: Type @variable_name to insert variable references (with autocomplete)
                    </>
                  )}
                </p>
                {errors.prompt && (
                  <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertDescription className="ml-2 text-sm text-red-800 dark:text-red-200">
                      {errors.prompt}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>

            {/* Advanced Tab: Temperature, Max Tokens, System Prompt */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              {/* Temperature */}
              <div className="space-y-2">
                <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Temperature
                </label>
                <div className="flex items-center gap-4">
                  <input
                    id="temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.temperature ?? 0.7}
                    onChange={handleTemperatureChange}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <span className="text-sm font-mono w-12 text-center">
                    {(config.temperature ?? 0.7).toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Lower values (0.0-0.5) = more deterministic, Higher values (1.5-2.0) = more creative
                </p>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <label htmlFor="max_tokens" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max Tokens
                </label>
                <Input
                  id="max_tokens"
                  type="number"
                  min="1"
                  max="200000"
                  placeholder="e.g., 1000"
                  value={config.max_tokens || ''}
                  onChange={handleMaxTokensChange}
                  className="font-mono"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Maximum length of the AI response in tokens. Leave empty for model default.
                </p>
              </div>

              {/* System Prompt Override */}
              <div className="space-y-2">
                <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  System Prompt (Optional)
                </label>
                <Textarea
                  id="system_prompt"
                  placeholder="Override the default system prompt to customize AI behavior..."
                  value={config.system_prompt || ''}
                  onChange={handleSystemPromptChange}
                  className="min-h-[100px] font-mono text-sm"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Leave empty to use the agent's default system prompt
                </p>
              </div>
            </TabsContent>

            {/* Output Tab: Variable Output */}
            <TabsContent value="output" className="space-y-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="output_variable" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Output Variable Name (Optional)
                </label>
                <Input
                  id="output_variable"
                  type="text"
                  placeholder="e.g., step_result, analysis_output"
                  pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
                  value={config.output_variable || ''}
                  onChange={handleOutputVariableChange}
                  className="font-mono"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  If set, the AI step's output will be stored in a variable with this name and can be
                  referenced in subsequent steps using @output_variable
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Variable name must start with letter or underscore, followed by letters, numbers, or underscores
                </p>

                {errors.output_variable && (
                  <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertDescription className="ml-2 text-sm text-red-800 dark:text-red-200">
                      {errors.output_variable}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Configuration Summary */}
              <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info size={16} />
                    Configuration Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-semibold">Model:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-400">
                        {config.model || 'Not selected'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Tools:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-400">
                        {(config.tools || []).length} selected
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Temperature:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-400">
                        {(config.temperature ?? 0.7).toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Max Tokens:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-400">
                        {config.max_tokens || 'Default'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  },
);

AIStepConfig.displayName = 'AIStepConfig';

export default AIStepConfig;
