'use client';

import React, { useEffect, useState } from 'react';
import { WorkflowCanvas } from '@/components/workflows/canvas/WorkflowCanvas';
import { NodePalette } from '@/components/workflows/canvas/NodePalette';
import { PropertiesPanel } from '@/components/workflows/canvas/PropertiesPanel';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Save, Play, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWorkflow } from '@/hooks/react-query/workflows/useWorkflow';
import { useWorkflowValidation } from '@/hooks/react-query/workflows/useWorkflowValidation';
import { useCanvasStore } from '@/store/workflows/canvasStore';
import { toast } from 'sonner';
import { useWorkflowExecution } from '@/hooks/react-query/workflows/useWorkflowExecution';
import { ExecutionTimeline } from '@/components/workflows/monitoring/ExecutionTimeline';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface AdvancedWorkflowEditorProps {
    agentId: string;
    workflowId: string;
}

export function AdvancedWorkflowEditor({ agentId, workflowId }: AdvancedWorkflowEditorProps) {
    const router = useRouter();
    const id = workflowId; // Use workflowId passed from props

    const { workflow, loading, saveWorkflow } = useWorkflow(id);
    const { mutateAsync: validateWorkflow } = useWorkflowValidation(id);
    const { nodes, edges, viewport, setGraph } = useCanvasStore();
    const { executeWorkflow, isConnected, stopExecution, executionState } = useWorkflowExecution(id);
    const [isValidating, setIsValidating] = useState(false);
    const [showProperties, setShowProperties] = useState(true);
    const [activeTab, setActiveTab] = useState("properties");
    const [triggerContextOpen, setTriggerContextOpen] = useState(false);
    const [triggerContextJson, setTriggerContextJson] = useState('{}');

    const handleExecute = async () => {
        try {
            let context = {};
            try {
                context = JSON.parse(triggerContextJson);
            } catch (e) {
                toast.error("Invalid JSON in trigger context");
                return;
            }

            setTriggerContextOpen(false);
            setActiveTab("execution");
            setShowProperties(true);

            await executeWorkflow.mutateAsync({ triggerContext: context });
            toast.success("Execution started");
        } catch (error) {
            toast.error("Failed to start execution");
        }
    };

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
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full max-h-full">
            {/* Header Controls - Integrated into main page header via tabs, but we keep specific controls here if needed */}
            <div className="flex items-center justify-between border-b px-6 py-2 bg-background/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground">
                            {nodes.length} nodes, {edges.length} connections
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {executionState.status === 'running' && (
                        <Badge variant="outline" className="border-blue-500 text-blue-500 animate-pulse mr-2">
                            Running
                        </Badge>
                    )}
                    {executionState.status === 'completed' && (
                        <Badge variant="outline" className="border-green-500 text-green-500 mr-2">
                            Completed
                        </Badge>
                    )}
                    {executionState.status === 'failed' && (
                        <Badge variant="outline" className="border-red-500 text-red-500 mr-2">
                            Failed
                        </Badge>
                    )}

                    {executionState.status === 'running' ? (
                        <Button variant="destructive" size="sm" onClick={stopExecution}>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Stop
                        </Button>
                    ) : (
                        <Dialog open={triggerContextOpen} onOpenChange={setTriggerContextOpen}>
                            <DialogTrigger asChild>
                                <Button variant="default" size="sm">
                                    <Play className="w-4 h-4 mr-2" />
                                    Execute
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Execute Workflow</DialogTitle>
                                    <DialogDescription>
                                        Provide trigger context JSON to start the workflow.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="context">Trigger Context (JSON)</Label>
                                        <Textarea
                                            id="context"
                                            value={triggerContextJson}
                                            onChange={(e) => setTriggerContextJson(e.target.value)}
                                            className="font-mono text-xs h-[200px]"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleExecute} disabled={executeWorkflow.isPending}>
                                        {executeWorkflow.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Start Execution
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSave}
                        disabled={isValidating || saveWorkflow.isPending}
                    >
                        {(isValidating || saveWorkflow.isPending) ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Save
                    </Button>
                </div>
            </div>

            {/* Editor Layout */}
            <div className="flex flex-1 overflow-hidden relative">
                <NodePalette />
                <WorkflowCanvas />

                {/* Right Sidebar - Properties Panel */}
                {showProperties && (
                    <div className="w-80 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden flex flex-col z-10">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                            <div className="border-b px-2">
                                <TabsList className="w-full justify-start bg-transparent p-0 h-10">
                                    <TabsTrigger value="properties" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4">
                                        Properties
                                    </TabsTrigger>
                                    <TabsTrigger value="execution" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4">
                                        Execution
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="properties" className="flex-1 overflow-hidden m-0">
                                <PropertiesPanel />
                            </TabsContent>

                            <TabsContent value="execution" className="flex-1 overflow-hidden m-0">
                                <ExecutionTimeline />
                            </TabsContent>
                        </Tabs>
                    </div>
                )}

                {/* Toggle Properties Panel Button */}
                <button
                    onClick={() => setShowProperties(!showProperties)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 p-2 rounded-l-md border-l border-gray-200 dark:border-gray-800 transition-colors"
                    title={showProperties ? 'Hide properties panel' : 'Show properties panel'}
                >
                    {showProperties ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>
        </div>
    );
}
