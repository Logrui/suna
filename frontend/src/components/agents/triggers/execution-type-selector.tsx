"use client";

import { Bot, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type ExecutionType = 'agent' | 'workflow';

interface ExecutionTypeSelectorProps {
    value: ExecutionType;
    onChange: (value: ExecutionType) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * ExecutionTypeSelector - A radio-style selector for choosing between
 * agent conversation and workflow execution for triggers.
 */
export function ExecutionTypeSelector({
    value,
    onChange,
    disabled = false,
    className,
}: ExecutionTypeSelectorProps) {
    return (
        <div className={cn("space-y-2", className)}>
            <Label className="text-sm font-medium">When triggered run one of the following options:</Label>
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange('agent')}
                    className={cn(
                        "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                        "hover:border-primary/50 hover:bg-accent/50",
                        value === 'agent'
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border/50 bg-background/50",
                        disabled && "cursor-not-allowed opacity-50"
                    )}
                >
                    <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        value === 'agent'
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                    )}>
                        <Bot className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-medium">Kortix Worker (Default)</div>
                        <div className="text-xs text-muted-foreground">
                            Start a conversation and/or chat
                        </div>
                    </div>
                    {value === 'agent' && (
                        <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                    )}
                </button>

                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange('workflow')}
                    className={cn(
                        "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                        "hover:border-primary/50 hover:bg-accent/50",
                        value === 'workflow'
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border/50 bg-background/50",
                        disabled && "cursor-not-allowed opacity-50"
                    )}
                >
                    <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        value === 'workflow'
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                    )}>
                        <Workflow className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-medium">Workflow</div>
                        <div className="text-xs text-muted-foreground">
                            Run a simple or advanced workflow
                        </div>
                    </div>
                    {value === 'workflow' && (
                        <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                    )}
                </button>
            </div>
        </div>
    );
}
