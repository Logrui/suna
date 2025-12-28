"use client";

import { useState } from "react";
import { Workflow, AlertCircle, Loader2, Plus, Check, X } from "lucide-react";
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
import { useAgentWorkflows, useCreateAgentWorkflow } from "@/hooks/workflows/use-agent-workflows";
import { toast } from "sonner";

interface WorkflowSelectorProps {
    agentId: string;
    value: string | null;
    onChange: (workflowId: string | null) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * WorkflowSelector - A dropdown for selecting an active workflow when 
 * a trigger is configured to execute a workflow instead of an agent conversation.
 * Includes inline workflow creation capability.
 */
export function WorkflowSelector({
    agentId,
    value,
    onChange,
    disabled = false,
    className,
}: WorkflowSelectorProps) {
    const { data: workflows, isLoading, error, refetch } = useAgentWorkflows(agentId);
    const createWorkflowMutation = useCreateAgentWorkflow();

    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newWorkflowName, setNewWorkflowName] = useState("");
    const [newWorkflowDescription, setNewWorkflowDescription] = useState("");

    // Filter to active workflows only, but also include any workflows (user can create one that gets activated)
    const activeWorkflows = workflows?.filter(w => w.status === 'active') || [];
    const allWorkflows = workflows || [];

    const handleCreateWorkflow = async () => {
        if (!newWorkflowName.trim()) {
            toast.error("Please enter a workflow name");
            return;
        }

        try {
            const newWorkflow = await createWorkflowMutation.mutateAsync({
                agentId,
                workflow: {
                    name: newWorkflowName.trim(),
                    description: newWorkflowDescription.trim() || undefined,
                    status: 'active', // Create as active so it can be used immediately
                    mode: 'simple',
                    steps: [],
                }
            });

            toast.success(`Workflow "${newWorkflowName}" created`);
            setIsCreatingNew(false);
            setNewWorkflowName("");
            setNewWorkflowDescription("");

            // Select the newly created workflow
            if (newWorkflow?.id) {
                onChange(newWorkflow.id);
            }

            // Refetch workflows to include the new one
            refetch();
        } catch (err) {
            console.error("Failed to create workflow:", err);
            toast.error("Failed to create workflow");
        }
    };

    const handleCancelCreate = () => {
        setIsCreatingNew(false);
        setNewWorkflowName("");
        setNewWorkflowDescription("");
    };

    if (isLoading) {
        return (
            <div className={cn("space-y-2", className)}>
                <Label className="text-sm font-medium">Select Workflow</Label>
                <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading workflows...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn("space-y-2", className)}>
                <Label className="text-sm font-medium">Select Workflow</Label>
                <div className="flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/5 p-3">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">Failed to load workflows</span>
                </div>
            </div>
        );
    }

    // Show create form if creating new
    if (isCreatingNew) {
        return (
            <div className={cn("space-y-3", className)}>
                <Label className="text-sm font-medium">Create New Workflow</Label>
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Workflow Name *</Label>
                        <Input
                            value={newWorkflowName}
                            onChange={(e) => setNewWorkflowName(e.target.value)}
                            placeholder="Enter workflow name"
                            className="h-9"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Description (optional)</Label>
                        <Input
                            value={newWorkflowDescription}
                            onChange={(e) => setNewWorkflowDescription(e.target.value)}
                            placeholder="Brief description of what this workflow does"
                            className="h-9"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelCreate}
                            disabled={createWorkflowMutation.isPending}
                        >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateWorkflow}
                            disabled={!newWorkflowName.trim() || createWorkflowMutation.isPending}
                        >
                            {createWorkflowMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                                <Check className="h-3.5 w-3.5 mr-1" />
                            )}
                            Create Workflow
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Show empty state if no workflows exist (with create option)
    if (allWorkflows.length === 0) {
        return (
            <div className={cn("space-y-2", className)}>
                <Label className="text-sm font-medium">Select Workflow</Label>
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-center">
                    <Workflow className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">No workflows yet</p>
                    <p className="text-xs text-muted-foreground mb-3">
                        Create a workflow to use with this trigger.
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCreatingNew(true)}
                    >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Create Workflow
                    </Button>
                </div>
            </div>
        );
    }

    // Show selector with "Create New" option
    return (
        <div className={cn("space-y-2", className)}>
            <Label className="text-sm font-medium">Select Workflow</Label>
            <Select
                value={value || undefined}
                onValueChange={(val) => {
                    if (val === "__create_new__") {
                        setIsCreatingNew(true);
                    } else {
                        onChange(val || null);
                    }
                }}
                disabled={disabled}
            >
                <SelectTrigger className="w-full rounded-xl border-border/50 bg-background/50 py-6 [&>span]:text-left">
                    <SelectValue placeholder="Select a workflow..." />
                </SelectTrigger>
                <SelectContent>
                    {/* Create New Option */}
                    <SelectItem value="__create_new__">
                        <div className="flex items-center gap-2 text-primary">
                            <Plus className="h-4 w-4" />
                            <span className="font-medium">Create New Workflow</span>
                        </div>
                    </SelectItem>

                    {activeWorkflows.length > 0 && (
                        <>
                            <Separator className="my-1" />
                            {activeWorkflows.map((workflow) => (
                                <SelectItem key={workflow.id} value={workflow.id}>
                                    <div className="flex items-center gap-2">
                                        <Workflow className="h-4 w-4 text-primary" />
                                        <div className="flex flex-col">
                                            <span className="font-medium">{workflow.name}</span>
                                            {workflow.description && (
                                                <span className="text-xs text-muted-foreground line-clamp-1">
                                                    {workflow.description}
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
            {value && (
                <p className="text-xs text-muted-foreground">
                    This workflow will be executed when the trigger is activated.
                </p>
            )}
        </div>
    );
}
