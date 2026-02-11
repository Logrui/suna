"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Webhook, Copy, Check, ArrowRight } from 'lucide-react';
import { useCreateTrigger } from '@/hooks/triggers';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ExecutionTypeSelector } from './execution-type-selector';
import { WorkflowSelector } from './workflow-selector';
import { AgentModelSelector } from '@/components/agents/config/model-selector';
import { AgentSelector } from '@/components/agents/agent-selector';

interface WebhookTriggerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agentId?: string; // Optional - if not provided, show agent selector first
    onTriggerCreated?: (triggerId: string) => void;
}

export const WebhookTriggerDialog: React.FC<WebhookTriggerDialogProps> = ({
    open,
    onOpenChange,
    agentId: propAgentId,
    onTriggerCreated
}) => {
    const [selectedAgent, setSelectedAgent] = useState<string>(propAgentId || '');
    const [step, setStep] = useState<'agent' | 'config' | 'success'>(propAgentId ? 'config' : 'agent');
    const [name, setName] = useState('');
    const [agentPrompt, setAgentPrompt] = useState('');
    const [executionType, setExecutionType] = useState<'agent' | 'workflow'>('agent');
    const [workflowId, setWorkflowId] = useState<string | null>(null);
    const [model, setModel] = useState('kortix/basic');
    const [createdTriggerId, setCreatedTriggerId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const createTriggerMutation = useCreateTrigger();
    const isLoading = createTriggerMutation.isPending;

    const webhookUrl = createdTriggerId
        ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/triggers/${createdTriggerId}/webhook`
        : null;

    // Reset step based on propAgentId when dialog opens
    useEffect(() => {
        if (open) {
            if (propAgentId) {
                setSelectedAgent(propAgentId);
                setStep('config');
            } else {
                setStep('agent');
            }
        }
    }, [open, propAgentId]);

    const handleCreate = async () => {
        if (!selectedAgent) {
            toast.error('Please select an agent');
            return;
        }

        // For workflow execution, workflow_id is required
        if (executionType === 'workflow' && !workflowId) {
            toast.error('Please select a workflow');
            return;
        }

        const triggerName = name.trim() || 'Custom Webhook';

        try {
            const config: Record<string, any> = {
                execution_type: executionType,
            };

            if (executionType === 'agent') {
                if (agentPrompt.trim()) {
                    config.agent_prompt = agentPrompt.trim();
                }
                config.model = model;
            } else {
                config.workflow_id = workflowId;
            }

            const result = await createTriggerMutation.mutateAsync({
                agentId: selectedAgent,
                provider_id: 'generic_webhook',
                name: triggerName,
                description: 'Custom webhook trigger for external integrations',
                config,
            });

            setCreatedTriggerId(result.trigger_id);
            setStep('success');
            toast.success('Webhook trigger created successfully');
            onTriggerCreated?.(result.trigger_id);
        } catch (error: any) {
            toast.error(error.message || 'Failed to create webhook trigger');
            console.error('Error creating webhook trigger:', error);
        }
    };

    const handleCopy = async () => {
        if (webhookUrl) {
            await navigator.clipboard.writeText(webhookUrl);
            setCopied(true);
            toast.success('Webhook URL copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        // Reset state on close
        setName('');
        setAgentPrompt('');
        setExecutionType('agent');
        setWorkflowId(null);
        setModel('kortix/basic');
        setCreatedTriggerId(null);
        setCopied(false);
        if (!propAgentId) {
            setSelectedAgent('');
            setStep('agent');
        } else {
            setSelectedAgent(propAgentId);
            setStep('config');
        }
        onOpenChange(false);
    };

    const handleNextStep = () => {
        if (selectedAgent) {
            setStep('config');
        }
    };

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-medium tracking-tighter text-balance">
                        <Webhook className="h-5 w-5 text-primary" />
                        {step === 'success' ? 'Webhook Created' : 'Create Webhook Trigger'}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {step === 'agent' && 'First, select which agent should handle this webhook.'}
                        {step === 'config' && 'Create a custom webhook endpoint to trigger agents or workflows from external services.'}
                        {step === 'success' && 'Your webhook is ready. Use the URL below to trigger executions from external systems.'}
                    </DialogDescription>
                </DialogHeader>

                {step === 'agent' && (
                    // Step 1: Agent Selection
                    <div className="space-y-4 py-4">
                        <AgentSelector
                            selectedAgentId={selectedAgent}
                            onAgentSelect={setSelectedAgent}
                            placeholder="Choose an agent"
                        />
                    </div>
                )}

                {step === 'config' && (
                    // Step 2: Configuration form
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Trigger Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Zapier Integration"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <ExecutionTypeSelector
                            value={executionType}
                            onChange={setExecutionType}
                        />

                        {executionType === 'workflow' ? (
                            <WorkflowSelector
                                agentId={selectedAgent}
                                value={workflowId}
                                onChange={setWorkflowId}
                            />
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="prompt">Agent Instructions (Optional)</Label>
                                    <Textarea
                                        id="prompt"
                                        placeholder="Instructions for processing webhook data. The webhook payload is available as {{webhook_data}}."
                                        value={agentPrompt}
                                        onChange={(e) => setAgentPrompt(e.target.value)}
                                        rows={3}
                                        className="resize-none"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        If left empty, the agent will use its default instructions with the webhook data.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Model</Label>
                                    <AgentModelSelector
                                        value={model}
                                        onChange={setModel}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {step === 'success' && (
                    // Step 3: Success state - show webhook URL
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Webhook URL</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={webhookUrl || ''}
                                    readOnly
                                    className="font-mono text-xs bg-muted"
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleCopy}
                                    className="shrink-0"
                                >
                                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
                            <p className="text-sm font-medium">Authentication</p>
                            <p className="text-xs text-muted-foreground">
                                Include one of the following headers in your request:
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                <li><code className="bg-muted px-1 rounded">X-Trigger-Secret</code>: Your TRIGGER_WEBHOOK_SECRET</li>
                                <li><code className="bg-muted px-1 rounded">Authorization</code>: Bearer JWT token</li>
                            </ul>
                        </div>

                        <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2">
                            <p className="text-sm font-medium">Example Request</p>
                            <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                {`curl -X POST "${webhookUrl}" \\
  -H "X-Trigger-Secret: your-secret" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello from external system"}'`}
                            </pre>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 'agent' && (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button onClick={handleNextStep} disabled={!selectedAgent}>
                                Next
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        </>
                    )}
                    {step === 'config' && (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreate}
                                disabled={isLoading}
                            >
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Webhook
                            </Button>
                        </>
                    )}
                    {step === 'success' && (
                        <Button onClick={handleClose}>
                            Done
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
