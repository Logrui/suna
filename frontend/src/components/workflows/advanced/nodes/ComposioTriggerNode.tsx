'use client';

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { NodeData } from '@/components/workflows/types';
import { Zap, Settings } from 'lucide-react';
import { LiveNodeStatus } from '../../shared/monitoring/LiveNodeStatus';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import { useWorkflow } from '@/hooks/react-query/workflows/useWorkflow';
import { useCanvasStore } from '@/stores/workflows';
import { ComposioTriggerSelector } from './ComposioTriggerSelector';

export const ComposioTriggerNode = memo(({ id, data, selected }: NodeProps<Node<NodeData>>) => {
    const params = useParams();
    const { workflow } = useWorkflow(params.id as string);
    const agentId = workflow?.agent_id;

    const [showSelector, setShowSelector] = useState(false);
    const { updateNodeConfig } = useCanvasStore();

    const handleSave = (triggerData: {
        appName: string;
        appSlug: string;
        appLogo?: string;
        triggerName: string;
        triggerSlug: string;
        config: Record<string, any>;
        profileId: string;
    }) => {
        updateNodeConfig(id, {
            triggerType: 'composio',
            composioTriggerConfig: {
                appName: triggerData.appName,
                appSlug: triggerData.appSlug,
                triggerName: triggerData.triggerName,
                triggerSlug: triggerData.triggerSlug,
                config: {
                    ...triggerData.config,
                    profileId: triggerData.profileId
                },
                logo: triggerData.appLogo
            }
        });
        setShowSelector(false);
    };

    const triggerConfig = data.config?.composioTriggerConfig;

    return (
        <div className={`relative flex flex-col text-base p-3 gap-3 rounded-lg border shadow-sm bg-card border-border w-[300px] ${selected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
            <LiveNodeStatus nodeId={id} />

            {/* Header */}
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <div className="p-2 bg-muted text-foreground rounded-md flex items-center justify-center overflow-hidden">
                    {triggerConfig?.logo ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={triggerConfig.logo} alt={triggerConfig.appName} className="w-4 h-4 object-contain" />
                    ) : (
                        <Zap className="shrink-0 size-4" />
                    )}
                </div>
                <div className="text-sm font-medium truncate">
                    {triggerConfig?.appName || 'Composio Trigger'}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 nodrag" onClick={() => setShowSelector(true)}>
                    <Settings className="h-3 w-3" />
                </Button>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col gap-3">
                <div className="text-muted-foreground text-xs leading-5 font-normal line-clamp-2">
                    {triggerConfig?.triggerName ? (
                        <>Triggered by <strong>{triggerConfig.triggerName}</strong> event</>
                    ) : (
                        "Select a Composio app event to trigger this workflow."
                    )}
                </div>

                {!triggerConfig && (
                    <Button variant="outline" size="sm" onClick={() => setShowSelector(true)} className="w-full nodrag">
                        Select Trigger
                    </Button>
                )}
            </div>

            {/* Footer */}
            <div className="-mx-3 -mb-3 px-3 pb-3 pt-3 bg-muted/30 rounded-b-lg border-t border-border/50">
                <div className="flex flex-row items-center gap-1 text-muted-foreground text-[10px] font-normal">
                    Output:
                    <div className="flex flex-row items-center gap-2">
                        <div className="inline-flex flex-row items-center gap-1 py-0.5 px-1.5 rounded-sm bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                            <p className="text-xs font-normal truncate">@trigger</p>
                        </div>
                    </div>
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="w-3 h-3 !bg-blue-600 !z-50"
            />

            {agentId && (
                <ComposioTriggerSelector
                    open={showSelector}
                    onOpenChange={setShowSelector}
                    agentId={agentId}
                    onSave={handleSave}
                    initialConfig={triggerConfig ? {
                        appSlug: triggerConfig.appSlug,
                        triggerSlug: triggerConfig.triggerSlug,
                        config: triggerConfig.config,
                        profileId: triggerConfig.config?.profileId
                    } : undefined}
                />
            )}
        </div>
    );
});

ComposioTriggerNode.displayName = 'ComposioTriggerNode';
