'use client';

import React from 'react';
import { GripVertical, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConditionalStep } from '@/components/workflows/types';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getStepIconAndColor } from '../../shared/workflow-definitions';
import { ToolIcon } from '../../shared/tool-icon';

interface StepCardProps {
    step: ConditionalStep;
    stepNumber: number;
    isNested?: boolean;
    onEdit: (step: ConditionalStep) => void;
    onUpdateStep: (updates: Partial<ConditionalStep>) => void;
    agentTools?: any;
    isLoadingTools?: boolean;
    sortableId?: string; // Override the sortable ID for nested contexts
}

export function StepCard({
    step,
    stepNumber,
    isNested = false,
    onEdit,
    onUpdateStep,
    agentTools,
    isLoadingTools,
    sortableId
}: StepCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: sortableId || step?.id || 'unknown' });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const getStepIcon = (step: ConditionalStep) => {
        // Check if step has iconUrl or groupIconUrl from Composio/MCP
        const iconUrl = step.config?.icon_url || step.config?.group_icon_url;

        // Determine the proper step type based on the step configuration
        let stepType;

        if (step.type === 'condition') {
            stepType = {
                category: 'conditions',
                config: step.config,
                icon: 'Settings'
            };
        } else if (step.config?.tool_type === 'agentpress') {
            stepType = {
                category: 'tools',
                config: step.config,
                icon: 'FileText'
            };
        } else if (step.config?.tool_type === 'mcp' || step.config?.tool_type === 'composio') {
            stepType = {
                category: 'integrations',
                config: step.config,
                icon: 'Cog',
                iconUrl: iconUrl // Pass iconUrl to getStepIconAndColor
            };
        } else if (step.config?.step_type === 'mcp_configuration') {
            stepType = {
                category: 'configuration',
                config: { step_type: 'mcp_configuration' },
                icon: 'Cog'
            };
        } else if (step.config?.step_type === 'credentials_profile') {
            stepType = {
                category: 'configuration',
                config: { step_type: 'credentials_profile' },
                icon: 'Globe'
            };
        } else if (step.type === 'instruction') {
            stepType = {
                category: 'actions',
                config: step.config,
                icon: 'FileText'
            };
        } else if (step.type === 'sequence') {
            stepType = {
                category: 'actions',
                config: step.config,
                icon: 'GitBranch'
            };
        } else {
            // Default fallback
            stepType = {
                category: 'actions',
                config: step.config,
                icon: 'FileText'
            };
        }

        const { icon: IconComponent, color, iconUrl: resolvedIconUrl } = getStepIconAndColor(stepType);

        // Use iconUrl from step config or resolved from getStepIconAndColor
        const effectiveIconUrl = iconUrl || resolvedIconUrl;

        return (
            <ToolIcon
                icon={IconComponent}
                iconUrl={effectiveIconUrl}
                color={color}
                size="md"
            />
        );
    };

    if (!step) return null;

    return (
        <div ref={setNodeRef} style={style} className={cn("relative group/step", isDragging && "opacity-50 z-50")}>
            {/* Background Glow Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-2xl blur opacity-0 group-hover/step:opacity-100 transition duration-500" />

            <div className="relative bg-background/50 backdrop-blur-sm border border-border/50 rounded-2xl transition-all duration-300 group-hover/step:border-primary/30 group-hover/step:shadow-lg dark:bg-zinc-900/40">
                {/* Grain Overlay */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay rounded-2xl"
                    style={{ backgroundImage: "url('/noise.png')" }} />

                <div className="flex items-center gap-3 p-4">
                    {/* Drag handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                        <GripVertical className="h-4 w-4 text-zinc-400" />
                    </div>

                    {/* Step icon */}
                    <div className="shrink-0">
                        {getStepIcon(step)}
                    </div>

                    {/* Step content */}
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold tracking-tight text-sm truncate text-zinc-900 dark:text-zinc-100">
                            {step.name}
                        </div>
                        {(step.description && !step.config?.tool_name) && (
                            <div className="text-xs text-muted-foreground/80 truncate mt-0.5 leading-relaxed">
                                {step.description}
                            </div>
                        )}
                        {step.config?.tool_name && (
                            <Badge variant="secondary" className="mt-1 text-[10px] h-4.5 font-medium bg-primary/10 text-primary border-primary/20">
                                {step.config.tool_name}
                            </Badge>
                        )}
                    </div>

                    {/* Actions */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(step)}
                        className="h-8 w-8 p-0 shrink-0 opacity-0 group-hover/step:opacity-100 transition-all hover:bg-primary/10 hover:text-primary"
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
