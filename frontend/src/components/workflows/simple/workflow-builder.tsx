'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Clock, PlugZap, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/components/ui/sidebar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TriggerSelector } from '@/components/triggers/trigger-selector';
import { type TriggerWithAgent } from '@/hooks/triggers/use-all-triggers';
import { ConditionalStep } from '@/components/workflows/types';
import { WorkflowSteps } from './steps/workflow-steps';
import { WorkflowLayout } from './workflow-layout';
import { useWorkflowSteps } from './hooks/use-workflow-steps';
import type { ToolMetadata } from '@/hooks/tools/use-tools-metadata';

interface WorkflowBuilderProps {
    steps: ConditionalStep[];
    onStepsChange: (steps: ConditionalStep[]) => void;
    agentTools?: {
        agentpress_tools: Array<{ name: string; description?: string; icon?: string; enabled: boolean }>;
        mcp_tools: Array<{ name: string; description?: string; icon?: string; server?: string }>;
    };
    toolsMetadata?: Record<string, ToolMetadata>;
    isLoadingTools?: boolean;
    agentId?: string;
    workflowId?: string;
    versionData?: {
        version_id: string;
        configured_mcps: unknown[];
        custom_mcps: unknown[];
        system_prompt: string;
        agentpress_tools: unknown;
    };
    onToolsUpdate?: () => void;
    workflowName?: string;
    workflowDescription?: string;
    onSave?: () => void;
    isSaving?: boolean;
    onExecute?: () => void;
    isExecuting?: boolean;
    onNameChange?: (name: string) => void;
    onDescriptionChange?: (description: string) => void;
}

// Root node structure that parser expects
const createRootNode = (children: ConditionalStep[] = []): ConditionalStep => ({
    id: 'start-node',
    name: 'Start',
    description: 'Click to add steps or use the Add Node button',
    type: 'instruction',
    config: {},
    order: 0,
    children: children
});

export function WorkflowBuilder({
    steps,
    onStepsChange,
    agentTools,
    toolsMetadata,
    isLoadingTools,
    agentId,
    versionData,
    onToolsUpdate,
    workflowName = 'Untitled Advanced Workflow',
    workflowDescription = '',
    onSave,
    isSaving = false,
    onExecute,
    isExecuting,
    onNameChange,
    onDescriptionChange
}: WorkflowBuilderProps) {
    // Ensure we always have the proper root structure
    const workflowSteps = useMemo(() => {
        // If we don't have steps or it's not the right structure, create proper root
        if (!steps || steps.length === 0) {
            return [createRootNode()];
        }

        // Check if we already have proper root structure
        const firstStep = steps[0];
        if (firstStep &&
            firstStep.name === 'Start' &&
            firstStep.description === 'Click to add steps or use the Add Node button' &&
            firstStep.type === 'instruction' &&
            Array.isArray(firstStep.children)) {
            return steps;
        }

        // If we have flat structure, wrap it in root node
        return [createRootNode(steps)];
    }, [steps]);

    // Get the actual workflow children (the steps we edit)
    const editableSteps = useMemo(() => {
        return workflowSteps[0]?.children || [];
    }, [workflowSteps]);

    // Handle changes to the editable steps
    const handleStepsChange = useCallback((newSteps: ConditionalStep[]) => {
        const updatedWorkflow = [createRootNode(newSteps)];
        onStepsChange(updatedWorkflow);
    }, [onStepsChange]);

    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [panelMode, setPanelMode] = useState<'add' | 'edit'>('add');
    const [selectedStep, setSelectedStep] = useState<ConditionalStep | null>(null);
    const [insertIndex, setInsertIndex] = useState<number>(-1);
    const [searchQuery, setSearchQuery] = useState('');
    const [parentStepId, setParentStepId] = useState<string | null>(null);

    // Trigger Dialog State
    const router = useRouter();
    const { setOpenMobile, isMobile } = useSidebar();
    const [triggerDialogType, setTriggerDialogType] = useState<'schedule' | 'event' | null>(null);

    const {
        handleAddStep,
        handleEditStep,
        handleCreateStep,
        handleUpdateStep,
        handleDeleteStep,
        handleAddElseIf,
        handleAddElse,
        getAvailableStepTypes,
        STEP_CATEGORIES
    } = useWorkflowSteps({
        steps: editableSteps, // Work with the children array
        onStepsChange: handleStepsChange, // Update the root structure
        agentTools,
        toolsMetadata,
        setIsPanelOpen,
        setPanelMode,
        setSelectedStep,
        setInsertIndex,
        setSearchQuery,
        selectedStep,
        insertIndex,
        parentStepId,
        setParentStepId
    });

    const handleToggleSidePanel = () => {
        setIsPanelOpen(!isPanelOpen);
    };

    return (
        <WorkflowLayout
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            isSidePanelOpen={isPanelOpen}
            onToggleSidePanel={handleToggleSidePanel}
            onSave={onSave || (() => { })}
            isSaving={isSaving}
            onExecute={onExecute}
            isExecuting={isExecuting}
            onNameChange={onNameChange}
            onDescriptionChange={onDescriptionChange}
            selectedStep={selectedStep}
            panelMode={panelMode}
            availableStepTypes={getAvailableStepTypes()}
            categories={STEP_CATEGORIES}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onCreateStep={handleCreateStep}
            onUpdateStep={handleUpdateStep}
            onDeleteStep={handleDeleteStep}
            isLoadingTools={isLoadingTools}
            agentId={agentId}
            versionData={versionData}
            onToolsUpdate={onToolsUpdate}
        >
            <div className="min-h-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="mx-auto max-w-3xl md:px-8 min-w-0 py-8">
                    {editableSteps.length === 0 ? (
                        <div className="flex-1 min-h-[70vh] flex flex-col items-center justify-center relative">

                            <div className="relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-1000">
                                <div className="space-y-4">
                                    <div className="w-20 h-20 bg-gradient-to-b from-primary/20 to-primary/5 rounded-3xl border border-primary/20 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/10">
                                        <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                                            <PlugZap className="h-6 w-6 text-primary" />
                                        </div>
                                    </div>
                                    <h2 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 text-balance sm:text-5xl">
                                        Build your <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-500">simple workflow</span>
                                    </h2>
                                    <p className="text-zinc-600 dark:text-zinc-400 text-lg max-w-lg mx-auto leading-relaxed text-balance">
                                        Every automated workflow begins with a trigger. Start by selecting how you want this agent to be activated.
                                    </p>
                                </div>

                                <div className="w-full max-w-sm mx-auto translate-y-0 hover:-translate-y-1 transition-transform duration-300 space-y-6">
                                    <div className="flex items-center justify-center gap-6 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] leading-none">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-3.5 w-3.5" />
                                            Scheduled
                                        </div>
                                        <div className="h-1 w-1 rounded-full bg-border/50" />
                                        <div className="flex items-center gap-2">
                                            <Zap className="h-3.5 w-3.5" />
                                            Event-based
                                        </div>
                                        <div className="h-1 w-1 rounded-full bg-border/50" />
                                        <div className="flex items-center gap-2 uppercase">
                                            <PlugZap className="h-3.5 w-3.5" />
                                            Webhook
                                        </div>
                                    </div>

                                    <div className="rounded-2xl bg-gradient-to-b from-border/50 to-transparent shadow-xl">
                                        <TriggerSelector
                                            placeholder="Select a Starting Trigger"
                                            className="w-full shadow-2xl shadow-black/5 [&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:justify-center"
                                            onSelect={(trigger) => {
                                                const newTriggerStep: ConditionalStep = {
                                                    id: crypto.randomUUID(),
                                                    name: trigger.name,
                                                    description: trigger.description || (trigger.trigger_type === 'schedule'
                                                        ? 'Runs on a defined schedule'
                                                        : 'Runs when an external event occurs'),
                                                    type: 'instruction',
                                                    config: {
                                                        trigger_id: trigger.trigger_id,
                                                        trigger_type: trigger.trigger_type,
                                                    },
                                                    order: 0,
                                                    children: []
                                                };
                                                handleStepsChange([...editableSteps, newTriggerStep]);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 min-w-0">
                            <WorkflowSteps
                                steps={editableSteps}
                                onAddStep={handleAddStep}
                                onEditStep={handleEditStep}
                                onUpdateStep={handleUpdateStep}
                                onDeleteStep={handleDeleteStep}
                                onAddElseIf={handleAddElseIf}
                                onAddElse={handleAddElse}
                                onStepsChange={handleStepsChange}
                                agentTools={agentTools}
                                isLoadingTools={isLoadingTools}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Trigger creation is now handled by TriggerSelector */}
        </WorkflowLayout >
    );
}
