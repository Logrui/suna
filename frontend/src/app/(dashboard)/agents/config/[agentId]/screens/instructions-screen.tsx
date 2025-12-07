'use client';

import React, { useState, useEffect } from 'react';
import { useAgent, useUpdateAgent } from '@/hooks/agents/use-agents';
import { ExpandableMarkdownEditor } from '@/components/ui/expandable-markdown-editor';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface InstructionsScreenProps {
    agentId: string;
}

export function InstructionsScreen({ agentId }: InstructionsScreenProps) {
    const { data: agent, isLoading } = useAgent(agentId);
    const updateAgentMutation = useUpdateAgent();
    const [systemPrompt, setSystemPrompt] = useState('');

    useEffect(() => {
        if (agent?.system_prompt) {
            setSystemPrompt(agent.system_prompt);
        }
    }, [agent?.system_prompt]);

    //Disables editing for Suna's default agent by passing disabled prop
    const isSunaAgent = agent?.metadata?.is_suna_default || false;
    const restrictions = agent?.metadata?.restrictions || {};
    const isEditable = (restrictions.system_prompt_editable !== false) && !isSunaAgent;

    const handleSave = async (value: string) => {
        if (!isEditable) {
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

    if (isLoading) {
        return (
            <div className="flex-1 overflow-auto pb-6">
                <div className="px-1 pt-1 space-y-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-[500px] w-full rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto pb-6">
            <div className="px-1 pt-1 flex flex-col h-full max-w-3xl">
                <Label className="text-base font-semibold mb-3 block flex-shrink-0">
                    System Prompt
                </Label>
                <div className="h-[500px]">
                    <ExpandableMarkdownEditor
                        value={systemPrompt}
                        onSave={handleSave}
                        disabled={!isEditable && !isSunaAgent} //allow opening the System Prompt editor for the Suna Agent. You can now view the prompt and click "Edit", but saving changes will still be blocked.
                        placeholder="Define how your agent should behave..."
                        className="h-full"
                    />
                </div>
            </div>
        </div>
    );
}
