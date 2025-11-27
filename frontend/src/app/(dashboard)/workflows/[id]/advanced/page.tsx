'use client';

import React, { useEffect, useState } from 'react';
import { WorkflowCanvas } from '@/components/workflows/canvas/WorkflowCanvas';
import { NodePalette } from '@/components/workflows/canvas/NodePalette';
import { PropertiesPanel } from '@/components/workflows/canvas/PropertiesPanel';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Play, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWorkflow } from '@/hooks/react-query/workflows/useWorkflow';
import { useWorkflowValidation } from '@/hooks/react-query/workflows/useWorkflowValidation';
import { useCanvasStore } from '@/store/workflows/canvasStore';
import { toast } from 'sonner';

export default function AdvancedWorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { workflow, loading, saveWorkflow } = useWorkflow(id);
  const { mutateAsync: validateWorkflow } = useWorkflowValidation(id);
  const { nodes, edges, viewport, setGraph } = useCanvasStore();
  const [isValidating, setIsValidating] = useState(false);
  const [showProperties, setShowProperties] = useState(true);

  // Load workflow data into canvas store on mount
  useEffect(() => {
    if (workflow?.graph_definition) {
      const { nodes, edges, viewport } = workflow.graph_definition;
      setGraph(
        nodes || [],
        edges || [],
        viewport || { x: 0, y: 0, zoom: 1 }
      );
    }
  }, [workflow, setGraph]);

  // Save workflow with validation and compilation
  const handleSave = async () => {
    try {
      setIsValidating(true);

      // Create graph definition from current canvas state
      const graphDefinition = {
        nodes,
        edges,
        viewport,
      };

      // Validate the graph
      const validationResult = await validateWorkflow(graphDefinition);

      if (!validationResult.is_valid) {
        toast.error('Workflow validation failed', {
          description: validationResult.errors.map(e => e.message).join(', '),
        });
        return;
      }

      // Show warnings if any
      if (validationResult.warnings.length > 0) {
        validationResult.warnings.forEach(warning => {
          toast.warning(warning.message);
        });
      }

      // The validation endpoint returns compiled_logic
      // In a real implementation, the backend would return this
      // For now, we'll save the graph_definition and let the backend compile it
      await saveWorkflow.mutateAsync({
        graphDefinition,
        compiledLogic: {} as any, // Backend will compile this
      });

      toast.success('Workflow saved successfully');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error('Failed to save workflow', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-3 bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {workflow?.name || 'Advanced Workflow Editor'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {nodes.length} nodes, {edges.length} connections
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isValidating || saveWorkflow.isPending}
          >
            {(isValidating || saveWorkflow.isPending) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Workflow
          </Button>
        </div>
      </header>

      {/* Editor Layout */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <WorkflowCanvas />

        {/* Right Sidebar - Properties Panel */}
        {showProperties && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
            <PropertiesPanel />
          </div>
        )}

        {/* Toggle Properties Panel Button */}
        <button
          onClick={() => setShowProperties(!showProperties)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 p-2 rounded-l-md border-l border-gray-200 dark:border-gray-800 transition-colors"
          title={showProperties ? 'Hide properties panel' : 'Show properties panel'}
        >
          {showProperties ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </div>
  );
}
