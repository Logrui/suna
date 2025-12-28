'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Workflow, Trash2, Calendar, Play, List, Network, GitBranch, Loader2, Pause, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { WorkflowExecutionDialog } from './workflow-execution-dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  useAgentWorkflows,
  useCreateAgentWorkflow,
  useUpdateAgentWorkflow,
  useDeleteAgentWorkflow,
  type AgentWorkflow,
  type CreateWorkflowRequest,
  type WorkflowMode,
} from '@/hooks/workflows';

interface AgentWorkflowsConfigurationProps {
  agentId: string;
  agentName: string;
}

// Helper function to get mode badge styling
function getModeBadge(mode: WorkflowMode) {
  switch (mode) {
    case 'simple':
      return {
        label: 'Simple Workflow',
        className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
      };
    case 'advanced':
      return {
        label: 'Advanced Workflow',
        className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
      };
    case 'advanced-legacy':
      return {
        label: 'Legacy Workflow',
        className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
      };
    default:
      return {
        label: 'Workflow',
        className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
      };
  }
}

export function AgentWorkflowsConfiguration({ agentId, agentName }: AgentWorkflowsConfigurationProps) {
  const router = useRouter();

  const { data: workflows = [], isLoading } = useAgentWorkflows(agentId);
  const createWorkflowMutation = useCreateAgentWorkflow();
  const updateWorkflowMutation = useUpdateAgentWorkflow();
  const deleteWorkflowMutation = useDeleteAgentWorkflow();

  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
  const [workflowToExecute, setWorkflowToExecute] = useState<AgentWorkflow | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<AgentWorkflow | null>(null);
  const [activeTab, setActiveTab] = useState('workflows');
  const [togglingWorkflowId, setTogglingWorkflowId] = useState<string | null>(null);

  const handleCreateWorkflow = useCallback(async () => {
    try {
      // New workflows are created as "simple" mode with "draft" status
      const defaultWorkflow: CreateWorkflowRequest = {
        name: 'Untitled Simple Workflow',
        description: 'A new workflow for automating tasks',
        steps: [],
        mode: 'simple',
        status: 'draft',
        agent_id: agentId,
      };

      const newWorkflow = await createWorkflowMutation.mutateAsync({
        agentId,
        workflow: defaultWorkflow
      });

      // Navigate to editor
      router.push(`/agents/config/${agentId}/workflow/${newWorkflow.id}`);
    } catch (error) {
      toast.error('Failed to create workflow');
      console.error(error);
    }
  }, [createWorkflowMutation, agentId, router]);

  // Toggle workflow between active and draft status
  const handleToggleStatus = useCallback(async (
    e: React.MouseEvent,
    workflow: AgentWorkflow
  ) => {
    e.stopPropagation(); // Prevent card click navigation

    const newStatus = workflow.status === 'active' ? 'draft' : 'active';
    setTogglingWorkflowId(workflow.id);

    try {
      await updateWorkflowMutation.mutateAsync({
        agentId,
        workflowId: workflow.id,
        workflow: { status: newStatus }
      });
      toast.success(
        newStatus === 'active'
          ? 'Workflow activated'
          : 'Workflow set to draft'
      );
    } catch (error) {
      toast.error('Failed to update workflow status');
      console.error(error);
    } finally {
      setTogglingWorkflowId(null);
    }
  }, [agentId, updateWorkflowMutation]);

  const handleExecuteWorkflow = useCallback((workflow: AgentWorkflow) => {
    setWorkflowToExecute(workflow);
    setIsExecuteDialogOpen(true);
  }, []);

  const handleWorkflowClick = useCallback((workflowId: string) => {
    router.push(`/agents/config/${agentId}/workflow/${workflowId}`);
  }, [agentId, router]);

  const handleDeleteWorkflow = useCallback((workflow: AgentWorkflow) => {
    setWorkflowToDelete(workflow);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!workflowToDelete) return;

    try {
      await deleteWorkflowMutation.mutateAsync({ agentId, workflowId: workflowToDelete.id });
      toast.success('Workflow deleted successfully');
      setIsDeleteDialogOpen(false);
      setWorkflowToDelete(null);
    } catch (error) {
      toast.error('Failed to delete workflow');
    }
  }, [agentId, workflowToDelete, deleteWorkflowMutation]);

  const handleExecutionSuccess = useCallback((result: any) => {
    setIsExecuteDialogOpen(false);
    setWorkflowToExecute(null);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 mb-4">
        <Button
          size='sm'
          variant='outline'
          className="flex items-center gap-2 h-10"
          onClick={handleCreateWorkflow}
          disabled={createWorkflowMutation.isPending}
        >
          <Plus className="h-4 w-4" />
          {createWorkflowMutation.isPending ? 'Creating...' : 'Create Workflow'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="workflows" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {/* Workflow Card Skeleton - repeat 3 times */}
                {[1, 2, 3].map((index) => (
                  <Card key={index} className="p-6 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Title skeleton */}
                        <Skeleton className="h-6 w-48" />
                        {/* Status badges skeleton */}
                        <div className="flex items-center space-x-2">
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-5 w-14 rounded-full" />
                        </div>
                        {/* Description skeleton */}
                        <Skeleton className="h-4 w-full max-w-md" />
                        <Skeleton className="h-4 w-3/4 max-w-sm" />
                        {/* Date skeleton */}
                        <div className="flex items-center pt-1">
                          <Skeleton className="h-4 w-4 mr-2 rounded" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <Skeleton className="h-8 w-20 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : workflows.length === 0 ? (
              <div className="text-center py-12 px-6 bg-muted/30 rounded-xl border-2 border-dashed border-border">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 border">
                  <Workflow className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold mb-2">No Workflows Configured</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Create advanced workflows to automate tasks and streamline your agent's operations.
                </p>
              </div>
            ) : (
              <div className="flex-1 space-y-4">
                {workflows.map((workflow) => {
                  const modeBadge = getModeBadge(workflow.mode);
                  const isActive = workflow.status === 'active';
                  const isToggling = togglingWorkflowId === workflow.id;

                  return (
                    <div key={workflow.id} className="group">
                      <Card
                        className={cn(
                          "p-6 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                        )}
                        onClick={() => handleWorkflowClick(workflow.id)}
                      >

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <h4 className="text-lg font-semibold truncate">{workflow.name}</h4>
                              {/* Mode Badge */}
                              <Badge
                                variant="outline"
                                className={cn("font-medium flex items-center gap-1.5", modeBadge.className)}
                              >
                                {modeBadge.label}
                              </Badge>
                            </div>

                            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                              {workflow.description}
                            </p>

                          </div>

                          {/* Right section: Action Buttons */}
                          <div className="flex-shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {/* Toggle Button - Pause/Play style */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleToggleStatus(e as unknown as React.MouseEvent, workflow)}
                              disabled={isToggling}
                              className="h-12 w-12 bg-primary border border-border hover:bg-muted text-background hover:text-foreground"
                            >
                              {isToggling ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : isActive ? (
                                <Pause className="h-7 w-7" />
                              ) : (
                                <Play className="h-5 w-5 ml-0.5" />
                              )}
                            </Button>

                            {/* Settings/Edit Button */}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWorkflowClick(workflow.id);
                              }}
                              className="h-12 w-12 bg-card border border-border hover:bg-muted"
                            >
                              <Settings className="h-5 w-5" />
                            </Button>

                            {/* Delete Button */}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteWorkflow(workflow);
                              }}
                              disabled={deleteWorkflowMutation.isPending}
                              className="h-12 w-12 bg-card border border-border hover:bg-muted text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <WorkflowExecutionDialog
        open={isExecuteDialogOpen}
        onOpenChange={setIsExecuteDialogOpen}
        workflow={workflowToExecute}
        agentId={agentId}
        onSuccess={handleExecutionSuccess}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete workflow {workflowToDelete?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteWorkflowMutation.isPending}
            >
              {deleteWorkflowMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
