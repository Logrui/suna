"use client";

import { useState } from "react";
import { Zap, AlertCircle, Loader2, Plus, Check, X, Clock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAllTriggers, type TriggerWithAgent } from "@/hooks/triggers/use-all-triggers";
import { TriggerCreationDialog } from "./trigger-creation-dialog";
import { toast } from "sonner";

interface TriggerSelectorProps {
    onSelect: (trigger: TriggerWithAgent) => void;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

/**
 * TriggerSelector - A dropdown for selecting an existing trigger to add to a workflow.
 * Includes inline capability to open the TriggerCreationDialog.
 */
export function TriggerSelector({
    onSelect,
    disabled = false,
    className,
    placeholder = "Select a trigger...",
}: TriggerSelectorProps) {
    const { data: triggers, isLoading, error } = useAllTriggers();
    const [triggerDialogType, setTriggerDialogType] = useState<'schedule' | 'event' | 'webhook' | null>(null);

    if (isLoading) {
        return (
            <div className={cn("flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 p-3", className)}>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading triggers...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn("flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/5 p-3", className)}>
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">Failed to load triggers</span>
            </div>
        );
    }

    const sortedTriggers = [...(triggers || [])].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className={cn("relative", className)}>
            <Select
                onValueChange={(val) => {
                    if (val === "__create_event__") {
                        setTriggerDialogType('event');
                    } else if (val === "__create_schedule__") {
                        setTriggerDialogType('schedule');
                    } else if (val === "__create_webhook__") {
                        setTriggerDialogType('webhook');
                    } else {
                        const trigger = triggers?.find(t => t.trigger_id === val);
                        if (trigger) onSelect(trigger);
                    }
                }}
                disabled={disabled}
            >
                <SelectTrigger className="w-full rounded-xl border-border/50 bg-background/50 py-6">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]" side="bottom" position="popper" sideOffset={8}>
                    {/* Creation Options */}
                    <SelectItem value="__create_event__">
                        <div className="flex items-center gap-2 text-primary">
                            <Zap className="h-4 w-4" />
                            <span className="font-medium">New Event Trigger</span>
                        </div>
                    </SelectItem>
                    <SelectItem value="__create_schedule__">
                        <div className="flex items-center gap-2 text-primary">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">New Scheduled Trigger</span>
                        </div>
                    </SelectItem>
                    <SelectItem value="__create_webhook__">
                        <div className="flex items-center gap-2 text-primary">
                            <Globe className="h-4 w-4" />
                            <span className="font-medium">New Custom Webhook Trigger</span>
                        </div>
                    </SelectItem>

                    {sortedTriggers.length > 0 && (
                        <>
                            <Separator className="my-1" />
                            {sortedTriggers.map((trigger) => (
                                <SelectItem key={trigger.trigger_id} value={trigger.trigger_id}>
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-primary shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium truncate">{trigger.name}</span>
                                            {trigger.agent_name && (
                                                <span className="text-[10px] text-muted-foreground line-clamp-1">
                                                    Worker: {trigger.agent_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </SelectItem>
                            ))}
                        </>
                    )}
                </SelectContent>
            </Select>

            {/* Trigger Creation Dialog */}
            <TriggerCreationDialog
                open={!!triggerDialogType}
                onOpenChange={(open) => {
                    if (!open) setTriggerDialogType(null);
                }}
                type={triggerDialogType || 'event'}
                onTriggerCreated={(triggerId) => {
                    setTriggerDialogType(null);
                    toast.success("Trigger created. You can now select it from the list.");

                    // Auto-select the newly created trigger
                    if (triggerId && triggers) {
                        const trigger = triggers.find(t => t.trigger_id === triggerId);
                        if (trigger) onSelect(trigger);
                    }
                }}
            />
        </div>
    );
}
