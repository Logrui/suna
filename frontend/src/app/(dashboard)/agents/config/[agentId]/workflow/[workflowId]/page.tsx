'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkflowTabsNavigation } from '@/components/workflows/shared/workflow-tabs-navigation';
import { SimpleWorkflowEditor } from '@/components/workflows/simple/simple-workflow-editor';
import { AdvancedWorkflowEditor } from '@/components/workflows/advanced/advanced-workflow-editor';
import { AdvancedWorkflowEditor as AdvancedWorkflowEditorLegacy } from '@/components/workflows/advanced/advanced-workflow-editor_old';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';
import { AgentIconEditorDialog } from '@/components/agents/config/agent-icon-editor-dialog';
import { useAgent, useUpdateAgent } from '@/hooks/agents/use-agents';
import { useAgentWorkflow, useUpdateAgentWorkflow, type WorkflowMode } from '@/hooks/workflows';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// WorkflowMode type is now consistent: 'simple' | 'advanced' | 'advanced-legacy'
// This matches both the URL tab values and database mode values

export default function WorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = params.agentId as string;
  const workflowId = params.workflowId as string;

  // Fetch agent and workflow data
  const { data: agent, isLoading: isLoadingAgent } = useAgent(agentId);
  const { data: workflow, isLoading: isLoadingWorkflow } = useAgentWorkflow(agentId, workflowId);
  const updateAgentMutation = useUpdateAgent();
  const updateWorkflowMutation = useUpdateAgentWorkflow();

  const [isIconDialogOpen, setIsIconDialogOpen] = useState(false);
  const [hasInitializedTab, setHasInitializedTab] = useState(false);

  // Track if we're currently saving mode (to prevent race conditions)
  const [isSavingMode, setIsSavingMode] = useState(false);

  // Determine active tab: prioritize URL param, then fall back to database mode
  const activeTab = useMemo((): WorkflowMode => {
    const urlTab = searchParams.get('tab') as WorkflowMode | null;

    console.log('[Workflow Tab] Computing activeTab:', {
      urlTab,
      dbMode: workflow?.mode,
      hasInitializedTab,
      isSavingMode
    });

    // If URL has a valid tab, use it
    if (urlTab === 'advanced' || urlTab === 'advanced-legacy' || urlTab === 'simple') {
      return urlTab;
    }

    // If no URL tab and we have workflow data, use the database mode
    if (workflow?.mode) {
      return workflow.mode;
    }

    // Default to simple
    return 'simple';
  }, [searchParams, workflow?.mode, hasInitializedTab, isSavingMode]);

  // Initialize URL tab from database mode on first load (if no URL tab specified)
  // Only runs ONCE when workflow data first loads, prevents race conditions
  useEffect(() => {
    // Skip if already initialized or currently saving (prevents overwriting user's choice)
    if (hasInitializedTab || isSavingMode) {
      console.log('[Workflow Tab] Init skipped:', { hasInitializedTab, isSavingMode });
      return;
    }

    // Wait for workflow data to load
    if (!workflow) {
      console.log('[Workflow Tab] Init waiting for workflow data...');
      return;
    }

    const urlTab = searchParams.get('tab');
    console.log('[Workflow Tab] Init check:', { urlTab, dbMode: workflow.mode });

    // If no URL tab is set, update URL to match database mode
    if (!urlTab && workflow.mode) {
      console.log('[Workflow Tab] Syncing URL to DB mode:', workflow.mode);
      const currentParams = new URLSearchParams(searchParams.toString());
      currentParams.set('tab', workflow.mode);
      router.replace(`?${currentParams.toString()}`);
    }

    setHasInitializedTab(true);
  }, [workflow, hasInitializedTab, searchParams, router, isSavingMode]);

  // Handle tab change - save to database and update URL
  // Handle tab change - save mode to Suna Kortix Supabase database
  // Note: This is SEPARATE from suna-advanced-workflows (Langflow) which has its own save logic
  const handleTabChange = useCallback(async (newTab: string) => {
    const newMode = newTab as WorkflowMode;
    const previousTab = activeTab;

    console.log('[Kortix Supabase] 📋 Tab change requested:', {
      from: previousTab,
      to: newMode,
      agentId,
      workflowId,
      target: 'Suna Kortix Supabase (agent_workflows table)'
    });

    // Prevent double-saves
    if (isSavingMode) {
      console.warn('[Kortix Supabase] Already saving, ignoring request');
      return;
    }

    // Update URL immediately for responsive UI
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set('tab', newTab);
    router.push(`?${currentParams.toString()}`);

    // Save mode to Suna Kortix Supabase database
    setIsSavingMode(true);
    try {
      console.log('[Kortix Supabase] 📤 Sending PUT request to save mode:', {
        endpoint: `/workflows/agents/${agentId}/workflows/${workflowId}`,
        payload: { mode: newMode },
        database: 'Suna Kortix Supabase'
      });

      const result = await updateWorkflowMutation.mutateAsync({
        agentId,
        workflowId,
        workflow: { mode: newMode }
      });

      console.log('[Kortix Supabase] ✅ Mode saved to Suna Kortix Supabase:', {
        newMode,
        result: { id: result.id, mode: result.mode, updated_at: result.updated_at }
      });

      // Show success toast - Stage 1 complete (Kortix Supabase save)
      // Note: Stage 2 (Langflow sync) happens separately when AdvancedWorkflowEditor mounts
      toast.success(`Workflow mode saved: ${newMode}`);
    } catch (error) {
      console.error('[Kortix Supabase] ❌ Failed to save mode to Suna Kortix Supabase:', error);
      // Note: NOT rolling back URL - the tab switch is still valid
      // Langflow (suna-advanced-workflows) issues are separate and should not affect this
      toast.error('Failed to save workflow mode to Kortix Supabase');
    } finally {
      setIsSavingMode(false);
    }
  }, [searchParams, router, agentId, workflowId, updateWorkflowMutation, activeTab, isSavingMode]);

  // Local state for pending edits (not yet saved)
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [pendingDescription, setPendingDescription] = useState<string | null>(null);

  // Handle workflow name change - store locally (will be saved on Save button click)
  const handleWorkflowNameChange = useCallback((newName: string) => {
    if (!newName.trim()) return;
    setPendingName(newName.trim());
  }, []);

  // Handle workflow description change
  const handleWorkflowDescriptionChange = useCallback((newDescription: string) => {
    setPendingDescription(newDescription);
  }, []);

  const handleIconUpdate = async (iconName: string | null, iconColor: string, backgroundColor: string) => {
    try {
      await updateAgentMutation.mutateAsync({
        agentId,
        icon_name: iconName,
        icon_color: iconColor,
        icon_background: backgroundColor,
      });
      toast.success('Agent icon updated');
    } catch (error) {
      console.error('Failed to update agent icon:', error);
      toast.error('Failed to update agent icon');
    }
  };

  // Handle save workflow - saves name, mode, and description
  const handleSaveAdvancedWorkflow = useCallback(async () => {
    // Build update payload with only changed fields
    const updatePayload: Record<string, unknown> = {};

    // Include name if it was edited
    if (pendingName && pendingName !== workflow?.name) {
      updatePayload.name = pendingName;
    }

    // Include description if it was edited
    if (pendingDescription !== null && pendingDescription !== workflow?.description) {
      updatePayload.description = pendingDescription;
    }

    // Include current mode for consistency
    if (workflow?.mode) {
      updatePayload.mode = workflow.mode;
    }

    try {
      await updateWorkflowMutation.mutateAsync({
        agentId,
        workflowId,
        workflow: updatePayload
      });

      // Clear pending states after successful save
      setPendingName(null);
      setPendingDescription(null);

      toast.success('Workflow saved');
      console.log('[Workflow] Saved to database:', updatePayload);
    } catch (error) {
      console.error('[Workflow] Failed to save:', error);
      toast.error('Failed to save workflow');
    }
  }, [agentId, workflowId, workflow?.name, workflow?.description, workflow?.mode, pendingName, pendingDescription, updateWorkflowMutation]);

  // Determine if there are unsaved changes
  const hasUnsavedChanges = pendingName !== null || pendingDescription !== null;

  // Combined saving state - reactive to any mutation
  const isSaving = updateWorkflowMutation.isPending;

  const renderEditor = () => {
    // Show loading state while fetching workflow
    if (isLoadingWorkflow) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading workflow...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'simple':
        return (
          <SimpleWorkflowEditor
            agentId={agentId}
            workflowId={workflowId}
          />
        );
      case 'advanced':
        return (
          <AdvancedWorkflowEditor
            agentId={agentId}
            workflowId={workflowId}
            workflowName={pendingName ?? workflow?.name}
            workflowStatus={workflow?.status}
            workflowMode={workflow?.mode}
            onWorkflowNameChange={handleWorkflowNameChange}
            onSave={handleSaveAdvancedWorkflow}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        );
      case 'advanced-legacy':
        return (
          <AdvancedWorkflowEditorLegacy
            agentId={agentId}
            workflowId={workflowId}
          />
        );
      default:
        return (
          <SimpleWorkflowEditor
            agentId={agentId}
            workflowId={workflowId}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with Tabs */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
            </Button>

            {/* Agent name and icon - clickable to open icon editor */}
            <div className="flex items-center gap-2">
              {isLoadingAgent ? (
                <>
                  <Skeleton className="h-6 w-6 rounded-lg" />
                  <Skeleton className="h-5 w-24" />
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsIconDialogOpen(true)}
                    className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                    title="Click to customize agent icon"
                  >
                    <AgentAvatar agentId={agentId} size={36} />
                  </button>
                  <span className="text-lg font-semibold text-foreground">
                    {agent?.name || 'Agent'}
                  </span>
                </>
              )}
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-border" />

            <h1 className="text-lg font-semibold">Workflow Editor</h1>

            <div className="ml-4 border-l pl-4 h-6 flex items-center">
              <WorkflowTabsNavigation
                activeTab={activeTab}
                onTabChange={handleTabChange}
                isSaving={updateWorkflowMutation.isPending}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {renderEditor()}
      </div>

      {/* Agent Icon Editor Dialog */}
      <AgentIconEditorDialog
        isOpen={isIconDialogOpen}
        onClose={() => setIsIconDialogOpen(false)}
        agentName={agent?.name}
        agentDescription={agent?.system_prompt?.slice(0, 200)}
        currentIconName={agent?.icon_name ?? undefined}
        currentIconColor={agent?.icon_color ?? undefined}
        currentBackgroundColor={agent?.icon_background ?? undefined}
        onIconUpdate={handleIconUpdate}
      />
    </div>
  );
}