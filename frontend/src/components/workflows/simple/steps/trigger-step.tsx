'use client';

import React from 'react';
import { Settings, Zap, Clock, PlugZap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConditionalStep } from '@/components/workflows/types';
import { cn } from '@/lib/utils';

interface TriggerStepProps {
    step: ConditionalStep;
    onEdit: (step: ConditionalStep) => void;
    onDelete?: (step: ConditionalStep) => void;
}

export function TriggerStep({
    step,
    onEdit,
}: TriggerStepProps) {
    // Determine icon based on trigger type
    const getTriggerIcon = () => {
        const type = step.config?.trigger_type;
        if (type === 'schedule') return Clock;
        if (type === 'event') return PlugZap;
        return Zap;
    };

    const Icon = getTriggerIcon();

    return (
        <div className="relative group/trigger">
            {/* Background Glow Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl blur opacity-0 group-hover/trigger:opacity-100 transition duration-500" />

            <div className="relative bg-background/50 backdrop-blur-sm border border-border/50 rounded-2xl transition-all duration-300 group-hover/trigger:border-blue-500/30 group-hover/trigger:shadow-lg dark:bg-zinc-900/40">
                {/* Grain Overlay */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay rounded-2xl"
                    style={{ backgroundImage: "url('/noise.png')" }} />

                <div className="flex items-center gap-4 p-5">
                    {/* Trigger Icon with Glow */}
                    <div className="relative shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]">
                        <Icon className="h-5 w-5" />
                        <div className="absolute inset-0 bg-blue-500/5 rounded-xl animate-pulse" />
                    </div>

                    {/* Step content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold tracking-tight text-sm text-zinc-900 dark:text-zinc-100">
                                {step.name}
                            </span>
                            <Badge
                                variant="secondary"
                                className="text-[10px] h-4.5 px-1.5 font-medium uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                            >
                                <Sparkles className="h-2.5 w-2.5 mr-1" />
                                Trigger
                            </Badge>
                        </div>

                        {step.description && (
                            <div className="text-xs text-muted-foreground/80 line-clamp-1 leading-relaxed">
                                {step.description}
                            </div>
                        )}

                        {(step.config?.schedule || step.config?.trigger_type === 'schedule') && (
                            <div className="text-[10px] font-medium text-blue-600/70 dark:text-blue-400/70 mt-1.5 flex items-center gap-1 bg-blue-500/5 w-fit px-1.5 py-0.5 rounded-md border border-blue-500/10">
                                <Clock className="h-3 w-3" />
                                {step.config?.schedule || 'Scheduled Run'}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex items-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(step)}
                            className="h-8 w-8 rounded-lg opacity-0 group-hover/trigger:opacity-100 transition-all hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Visual connector indicator */}
            <div className="absolute left-1/2 -bottom-4 w-px h-4 bg-gradient-to-b from-blue-500/30 to-border" />
        </div>
    );
}

