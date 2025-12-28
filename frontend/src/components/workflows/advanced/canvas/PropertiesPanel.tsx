'use client';

import React, { memo, useCallback, useMemo } from 'react';
import { useCanvasStore } from '@/stores/workflows';
import { AIStepConfig } from '../config';
import useAIStepValidation from '@/hooks/workflows/useAIStepValidation';
import type { WorkflowNode, AIStepNodeData } from '@/components/workflows/types';
import type { Variable } from '../config/VariableMentionPlugin';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PropertiesPanelProps {
  /** Optional CSS class */
  className?: string;

  /** Available variables in the workflow (for autocomplete in Lexical editor) */
  availableVariables?: Variable[];

  /** Callback when panel is closed */
  onClose?: () => void;
}

/**
 * PropertiesPanel Component
 *
 * Side panel that displays configuration UI for the selected node.
 * Shows different configuration forms based on node type:
 * - AI Step: Model, tools, prompt, temperature, etc.
 * - Rule Condition: Rules configuration
 * - LLM Condition: Branches configuration
 * - Start: Trigger context
 * - End: Final message
 *
 * Maps to: T040 (Phase 4: User Story 2)
 */
export const PropertiesPanel = memo<PropertiesPanelProps>(
  ({ className = '', availableVariables = [], onClose }) => {
    const nodes = useCanvasStore((state) => state.nodes);
    const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
    const updateNodeConfig = useCanvasStore((state) => state.updateNodeConfig);

    // Get the first selected node (we only support one at a time)
    const selectedNode = useMemo(() => {
      if (selectedNodeIds.length === 0) return null;
      return nodes.find((node) => node.id === selectedNodeIds[0]);
    }, [nodes, selectedNodeIds]);

    // Extract variable names from Variable[] for validation
    const variableNames = useMemo(
      () => (availableVariables || []).map((v) => v.name),
      [availableVariables],
    );

    // Validation for AI Step nodes
    const validation = useAIStepValidation(
      selectedNode?.data?.config || {},
      variableNames,
    );

    const handleConfigChange = useCallback(
      (config: Record<string, unknown>) => {
        if (selectedNode) {
          updateNodeConfig(selectedNode.id, config);
        }
      },
      [selectedNode, updateNodeConfig],
    );

    // If no node is selected, show empty state
    if (!selectedNode) {
      return (
        <div className={`h-full flex flex-col items-center justify-center p-6 text-center ${className}`}>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              No node selected
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Click on a node in the canvas to configure its properties
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={`h-full flex flex-col bg-card border-l border-border ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {selectedNode.data.label || 'Node Properties'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedNode.type === 'ai_step' && 'Configure AI agent step'}
              {selectedNode.type === 'rule_condition' && 'Configure rule-based condition'}
              {selectedNode.type === 'llm_condition' && 'Configure conditional split'}
              {selectedNode.type === 'start' && 'Configure trigger'}
              {selectedNode.type === 'end' && 'Configure end point'}
            </p>
          </div>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ml-2"
            >
              <X size={16} />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-muted/30">
          {selectedNode.type === 'ai_step' && (
            <AIStepConfig
              nodeData={{
                ...selectedNode.data,
                config: selectedNode.data.config || {}
              } as AIStepNodeData}
              onConfigChange={handleConfigChange}
              availableVariables={availableVariables}
              errors={validation.errors}
            />
          )}

          {selectedNode.type === 'rule_condition' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rule Condition Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Rule condition configuration coming in Phase 6
                </p>
              </CardContent>
            </Card>
          )}

          {selectedNode.type === 'llm_condition' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conditional Split Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  LLM condition configuration coming in Phase 6
                </p>
              </CardContent>
            </Card>
          )}

          {selectedNode.type === 'start' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trigger Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Trigger context configuration coming in Phase 7
                </p>
              </CardContent>
            </Card>
          )}

          {selectedNode.type === 'end' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">End Point Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  End point configuration coming in Phase 5
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer: Validation Status */}
        {selectedNode.type === 'ai_step' && (
          <div className="border-t border-border p-4 bg-muted/50">
            <div className={`text-xs font-medium ${validation.isValid ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
              {validation.isValid ? '✓ Configuration valid' : '⚠ Configuration incomplete'}
            </div>
            {Object.entries(validation.warnings).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(validation.warnings).map(([key, message]) => (
                  <div key={key} className="text-xs text-muted-foreground">
                    ⚠ {message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

PropertiesPanel.displayName = 'PropertiesPanel';

export default PropertiesPanel;
