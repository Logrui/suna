'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAgent, useUpdateAgent } from '@/hooks/agents/use-agents';
import { ExpandableMarkdownEditor } from '@/components/ui/expandable-markdown-editor';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentTriggers } from '@/hooks/triggers';
import { useAgentWorkflows } from '@/hooks/react-query/agents/use-agent-workflows';
import { Zap, BookOpen, Workflow, Wrench, Server, ChevronRight, Plus, Settings2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { AgentWorkflow } from '@/hooks/react-query/agents/workflow-utils';
import { GranularToolConfiguration } from '@/components/agents/tools/granular-tool-configuration';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { useToolsMetadata } from '@/hooks/tools/use-tools-metadata';
import { getAllToolGroups, getToolGroup } from '@/components/agents/tools/tool-groups';
import { icons } from 'lucide-react';

interface OverviewScreenProps {
    agentId: string;
    onNavigate?: (view: string) => void;
}

function isPlaybook(workflow: AgentWorkflow): boolean {
    try {
        const stepsAny = (workflow.steps as unknown as any[]) || [];
        const start = stepsAny.find(
            (s) => s?.name === 'Start' && s?.description === 'Click to add steps or use the Add Node button',
        );
        const child = start?.children?.[0] ?? stepsAny[0];
        return Boolean(child?.config?.playbook);
    } catch {
        return false;
    }
}

export function OverviewScreen({ agentId, onNavigate }: OverviewScreenProps) {
    const { data: agent, isLoading: isAgentLoading } = useAgent(agentId);
    const updateAgentMutation = useUpdateAgent();
    const [systemPrompt, setSystemPrompt] = useState('');
    const [tools, setTools] = useState<Record<string, any>>({});

    const { data: triggers = [], isLoading: isTriggersLoading } = useAgentTriggers(agentId);
    const { data: workflows = [], isLoading: isWorkflowsLoading } = useAgentWorkflows(agentId);
    const { data: toolsMetadata } = useToolsMetadata();

    const playbooks = useMemo(() => workflows.filter(isPlaybook), [workflows]);
    const agentWorkflows = useMemo(() => workflows.filter(w => !isPlaybook(w)), [workflows]);

    useEffect(() => {
        if (agent?.system_prompt) {
            setSystemPrompt(agent.system_prompt);
        }
        if (agent?.agentpress_tools) {
            setTools(agent.agentpress_tools);
        }
    }, [agent?.system_prompt, agent?.agentpress_tools]);

    const isSunaAgent = agent?.metadata?.is_suna_default || false;
    const restrictions = agent?.metadata?.restrictions || {};
    const isSystemPromptEditable = (restrictions.system_prompt_editable !== false) && !isSunaAgent;
    const areToolsEditable = (restrictions.tools_editable !== false) && !isSunaAgent;

    const handleSave = async (value: string) => {
        if (!isSystemPromptEditable) {
            if (isSunaAgent) {
                toast.error("Default System Prompts cannot be edited", {
                    description: "Suna agent system prompts are managed centrally.",
                });
            }
            return;
        }

        try {
            await updateAgentMutation.mutateAsync({
                agentId,
                system_prompt: value,
            });
            setSystemPrompt(value);
            toast.success('System prompt updated successfully');
        } catch (error) {
            console.error('Failed to update system prompt:', error);
            toast.error('Failed to update system prompt');
        }
    };

    const handleToolsChange = async (newTools: Record<string, boolean | { enabled: boolean; description: string }>) => {
        if (!areToolsEditable) {
            if (isSunaAgent) {
                toast.error("Tools cannot be edited", {
                    description: "Suna's tools are managed centrally.",
                });
            }
            return;
        }

        try {
            await updateAgentMutation.mutateAsync({
                agentId,
                agentpress_tools: newTools,
            });
            setTools(newTools);
            toast.success('Tools updated successfully');
        } catch (error) {
            console.error('Failed to update tools:', error);
            toast.error('Failed to update tools');
        }
    };

    if (isAgentLoading) {
        return (
            <div className="flex-1 overflow-auto pb-6 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                <div className="px-1 pt-1 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <Skeleton className="h-[300px] w-full rounded-xl" />
                            <Skeleton className="h-[200px] w-full rounded-xl" />
                        </div>
                        <div className="space-y-6">
                            <Skeleton className="h-[200px] w-full rounded-xl" />
                            <Skeleton className="h-[200px] w-full rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const configuredIntegrations = [
        ...(agent?.configured_mcps || []),
        ...(agent?.custom_mcps || [])
    ];

    const getIconComponent = (iconName?: string) => {
        if (!iconName) return Wrench;
        const IconComponent = (icons as any)[iconName];
        return IconComponent || Wrench;
    };

    return (
        <div className="flex-1 overflow-auto pb-6 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="px-1 pt-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-[2000px]">
                    {/* Left Column */}
                    <div className="flex flex-col gap-6 min-w-0 max-w-[1000px]">
                        {/* System Prompt */}
                        <div className="flex flex-col">
                            <Label className="text-base font-semibold mb-3 block flex-shrink-0">
                                System Prompt
                            </Label>
                            <div className="h-[300px]">
                                <ExpandableMarkdownEditor
                                    value={systemPrompt}
                                    onSave={handleSave}
                                    disabled={!isSystemPromptEditable && !isSunaAgent}
                                    placeholder="Define how your agent should behave..."
                                    className="h-full"
                                />
                            </div>
                        </div>

                        {/* Automation Grid */}
                        <div className="grid grid-cols-1 gap-4">
                            <CompactList
                                title="Triggers"
                                icon={Zap}
                                count={triggers.length}
                                items={triggers.map(t => ({ id: t.trigger_id, name: t.name, description: t.description }))}
                                emptyText="No triggers configured"
                                onViewAll={() => onNavigate?.('triggers')}
                            />
                            <CompactList
                                title="Playbooks"
                                icon={BookOpen}
                                count={playbooks.length}
                                items={playbooks.map(p => ({ id: p.id, name: p.name, description: p.description }))}
                                emptyText="No playbooks created"
                                onViewAll={() => onNavigate?.('playbooks')}
                            />
                            <CompactList
                                title="Workflows"
                                icon={Workflow}
                                count={agentWorkflows.length}
                                items={agentWorkflows.map(w => ({ id: w.id, name: w.name, description: w.description }))}
                                emptyText="No workflows created"
                                onViewAll={() => onNavigate?.('workflows')}
                            />
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="flex flex-col gap-6 min-w-0 max-w-[1000px]">
                        {/* Tools */}
                        <div className="flex flex-col h-[600px]">
                            <div className="flex items-center justify-between mb-3">
                                <Label className="text-base font-semibold block">
                                    Tools Configuration
                                </Label>
                                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => onNavigate?.('tools')}>
                                    View All <ChevronRight className="h-3 w-3" />
                                </Button>
                            </div>
                            <Card className="flex bg-muted/30 border-border/50 overflow-hidden">
                                <GranularToolConfiguration
                                    tools={tools}
                                    onToolsChange={handleToolsChange}
                                    disabled={!areToolsEditable}
                                    isSunaAgent={isSunaAgent}
                                    isLoading={updateAgentMutation.isPending}
                                    compact={true}
                                />
                            </Card>
                        </div>

                        {/* Integrations */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <Label className="text-base font-semibold block">
                                    Integrations
                                </Label>
                                <Badge variant="secondary" className="text-xs">
                                    {configuredIntegrations.length} Connected
                                </Badge>
                            </div>
                            <Card className="flex-1 bg-muted/30 border-border/50">
                                <ScrollArea className="h-[300px]">
                                    <div className="p-4 space-y-3">
                                        {configuredIntegrations.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground text-sm">
                                                No integrations connected
                                            </div>
                                        ) : (
                                            configuredIntegrations.map((mcp: any, i) => (
                                                <div key={i} onClick={() => onNavigate?.('integrations')} className="cursor-pointer">
                                                    <SpotlightCard
                                                        className="bg-card border border-border hover:border-primary/50 transition-colors"
                                                    >
                                                        <div className="p-3 flex items-center justify-between">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-card border border-border/50 flex-shrink-0">
                                                                    <Server className="h-5 w-5 text-foreground" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-medium text-sm truncate">{mcp.name}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {mcp.type === 'sse' ? 'SSE Endpoint' : 'Stdio Process'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                        </div>
                                                    </SpotlightCard>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface CompactListProps {
    title: string;
    icon: React.ElementType;
    count: number;
    items: Array<{ id: string; name: string; description?: string }>;
    emptyText: string;
    onViewAll?: () => void;
}

function CompactList({ title, icon: Icon, count, items, emptyText, onViewAll }: CompactListProps) {
    return (
        <Card className="overflow-hidden border-border/50 bg-muted/30">
            <div className="p-3 border-b border-border/50 flex items-center justify-between bg-card/50">
                <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{title}</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] min-w-[1.25rem]">
                        {count}
                    </Badge>
                </div>
                {onViewAll && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={onViewAll}>
                        View All <ChevronRight className="h-3 w-3" />
                    </Button>
                )}
            </div>
            <div className="p-2">
                {items.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                        {emptyText}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.slice(0, 3).map((item) => (
                            <div key={item.id} onClick={onViewAll} className="cursor-pointer">
                                <SpotlightCard
                                    className="bg-card border border-border hover:border-primary/50 transition-colors"
                                >
                                    <div className="p-2 flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sm truncate">{item.name}</div>
                                            {item.description && (
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {item.description}
                                                </div>
                                            )}
                                        </div>
                                        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </SpotlightCard>
                            </div>
                        ))}
                        {items.length > 3 && (
                            <div className="text-center pt-1">
                                <span className="text-xs text-muted-foreground">
                                    +{items.length - 3} more
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}
