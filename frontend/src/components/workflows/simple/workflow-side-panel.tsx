'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ConditionalStep } from '@/components/workflows/types';

import { ComposioRegistry } from '@/components/agents/composio/composio-registry';
import { CustomMCPDialog } from '@/components/agents/mcp/custom-mcp-dialog';
import { useAgent, useUpdateAgent } from '@/hooks/agents';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { AddStepPanel, EditStepPanel, StepType, Category } from './side-panel';

interface WorkflowSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'add' | 'edit';
    selectedStep?: ConditionalStep | null;
    availableStepTypes: StepType[];
    categories: Category[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onCreateStep: (stepType: StepType) => void;
    onUpdateStep: (updates: Partial<ConditionalStep>) => void;
    onDeleteStep: (stepId: string) => void;
    isLoadingTools?: boolean;
    agentId?: string;
    versionData?: unknown;
    onToolsUpdate?: () => void;
}

const FLOATING_LAYOUT_ID = 'workflow-panel-float';

export function WorkflowSidePanel({
    isOpen,
    onClose,
    mode,
    selectedStep,
    availableStepTypes,
    categories,
    searchQuery,
    onSearchChange,
    onCreateStep,
    onUpdateStep,
    onDeleteStep,
    isLoadingTools: _isLoadingTools = false,
    agentId,
    versionData: _versionData,
    onToolsUpdate
}: WorkflowSidePanelProps) {
    const [showComposioRegistry, setShowComposioRegistry] = useState(false);
    const [showCustomMCPDialog, setShowCustomMCPDialog] = useState(false);
    const queryClient = useQueryClient();
    const { data: agent } = useAgent(agentId || '');
    const updateAgentMutation = useUpdateAgent();

    const isMobile = useIsMobile();

    const handleClose = React.useCallback(() => {
        onClose();
    }, [onClose]);

    // Escape key handler
    React.useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                handleClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleClose]);

    /**
     * Handles step type clicks, opening special dialogs for certain step types.
     */
    const handleStepTypeClick = (stepType: StepType) => {
        if (stepType.id === 'credentials_profile') {
            setShowComposioRegistry(true);
        } else if (stepType.id === 'mcp_configuration') {
            setShowCustomMCPDialog(true);
        } else {
            onCreateStep(stepType);
        }
    };

    /**
     * Handles Composio tools selection - creates workflow steps for selected tools.
     */
    const handleComposioToolsSelected = (
        _profileId: string,
        selectedTools: string[],
        appName: string,
        _appSlug: string,
        appIconUrl?: string
    ) => {
        setShowComposioRegistry(false);
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
        queryClient.invalidateQueries({ queryKey: ['composio', 'profiles'] });

        if (onToolsUpdate) {
            onToolsUpdate();
        }

        if (selectedTools && selectedTools.length > 0) {
            selectedTools.forEach((toolName, index) => {
                // Format tool name for display, e.g. GITHUB_CREATE_ISSUE -> Github Create Issue
                const displayName = toolName
                    .split('_')
                    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
                    .join(' ');

                onCreateStep({
                    id: `composio-${Date.now()}-${index}`,
                    name: displayName,
                    description: `Execute ${toolName} using ${appName}`,
                    icon: 'Zap',
                    category: 'integrations',
                    group: appName,
                    groupIconUrl: appIconUrl,
                    config: {
                        step_type: 'tool',
                        tool_name: toolName,
                        group_icon_url: appIconUrl
                    }
                });
            });
            toast.success(`Added workflow step for ${appName}`);
            toast.success(`Connected ${appName} integration!`);
        }
    };

    /**
     * Handles saving a custom MCP configuration.
     */
    const handleCustomMCPSave = async (customConfig: {
        name: string;
        type: 'http';
        config: Record<string, unknown>;
        enabledTools: string[];
    }) => {
        try {
            const existingCustomMCPs = agent?.custom_mcps || [];
            const newMCPConfig = {
                name: customConfig.name,
                type: customConfig.type,
                config: customConfig.config,
                enabledTools: customConfig.enabledTools
            };
            await updateAgentMutation.mutateAsync({
                agentId: agentId!,
                // Type assertion needed: CustomMCPDialog uses 'http' but mutation expects 'json' | 'sse'
                // This is a known type mismatch that should be resolved in the agent types
                custom_mcps: [...existingCustomMCPs, newMCPConfig] as typeof existingCustomMCPs
            });

            onCreateStep({
                id: 'mcp_configuration',
                name: `${customConfig.name} MCP`,
                description: `MCP server configuration for ${customConfig.name}`,
                icon: 'Cog',
                category: 'configuration',
                config: {
                    step_type: 'mcp_configuration',
                    tool_name: customConfig.enabledTools[0] || `${customConfig.name} MCP`,
                    mcp_name: customConfig.name,
                    mcp_type: customConfig.type,
                    enabled_tools: customConfig.enabledTools
                }
            });

            // Invalidate queries to refresh tools
            queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
            queryClient.invalidateQueries({ queryKey: ['agent-tools', agentId] });

            // Trigger parent tools update
            if (onToolsUpdate) {
                onToolsUpdate();
            }

            setShowCustomMCPDialog(false);
            toast.success('Custom MCP server added successfully');
        } catch (_error) {
            toast.error('Failed to add custom MCP server');
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <AnimatePresence mode="wait">
                <motion.div
                    key="workflow-sidepanel"
                    layoutId={FLOATING_LAYOUT_ID}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    transition={{
                        opacity: { duration: 0.15 },
                        x: { type: "spring", stiffness: 400, damping: 35 },
                        layout: {
                            type: "spring",
                            stiffness: 400,
                            damping: 35
                        }
                    }}
                    className={cn(
                        'fixed top-14 right-2 bottom-4 border border-border rounded-lg flex flex-col z-30 bg-card shadow-sm',
                        isMobile
                            ? 'left-2'
                            : 'w-[40vw] sm:w-[450px] md:w-[500px] lg:w-[550px] xl:w-[645px]',
                    )}
                    style={{
                        overflow: 'hidden',
                    }}
                >
                    {mode === 'add' ? (
                        <AddStepPanel
                            onClose={handleClose}
                            availableStepTypes={availableStepTypes}
                            categories={categories}
                            searchQuery={searchQuery}
                            onSearchChange={onSearchChange}
                            onStepTypeClick={handleStepTypeClick}
                        />
                    ) : selectedStep ? (
                        <EditStepPanel
                            onClose={handleClose}
                            selectedStep={selectedStep}
                            onUpdateStep={onUpdateStep}
                            onDeleteStep={onDeleteStep}
                        />
                    ) : null}
                </motion.div>
            </AnimatePresence>

            {/* Composio Registry Dialog */}
            <Dialog open={showComposioRegistry} onOpenChange={setShowComposioRegistry}>
                <DialogContent className="p-0 max-w-6xl h-[90vh] overflow-hidden">
                    <DialogHeader className="sr-only">
                        <DialogTitle>App Integrations</DialogTitle>
                    </DialogHeader>
                    <ComposioRegistry
                        selectedAgentId={agentId}
                        onClose={() => setShowComposioRegistry(false)}
                        onToolsSelected={handleComposioToolsSelected}
                    />
                </DialogContent>
            </Dialog>

            {/* Custom MCP Dialog */}
            <CustomMCPDialog
                open={showCustomMCPDialog}
                onOpenChange={setShowCustomMCPDialog}
                onSave={handleCustomMCPSave}
                agentId={agentId}
            />
        </>
    );
}
