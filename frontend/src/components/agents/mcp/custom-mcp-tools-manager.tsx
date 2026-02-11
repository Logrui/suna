'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Zap, Save, AlertCircle, RefreshCw } from 'lucide-react';
import { useCustomMCPToolsData } from '@/hooks/agents/use-custom-mcp-tools';
import { CustomMCPToolsSelector } from './custom-mcp-tools-selector';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CustomMCPToolsManagerProps {
    agentId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mcpConfig: any;
    mcpName: string;
    onToolsUpdate?: (enabledTools: string[]) => void;
}

export const CustomMCPToolsManager: React.FC<CustomMCPToolsManagerProps> = ({
    agentId,
    open,
    onOpenChange,
    mcpConfig,
    mcpName,
    onToolsUpdate,
}) => {
    const {
        data,
        isLoading,
        error,
        updateMutation,
        isUpdating,
        refetch
    } = useCustomMCPToolsData(agentId, mcpConfig);

    const [selectedToolNames, setSelectedToolNames] = useState<string[]>([]);
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize selected tools from the data
    useEffect(() => {
        if (data?.tools) {
            const enabled = data.tools
                .filter(t => t.enabled)
                .map(t => t.name);
            setSelectedToolNames(enabled);
            setHasChanges(false);
        }
    }, [data]);

    const handleToolsChange = (newTools: string[]) => {
        setSelectedToolNames(newTools);

        // Check if there are actual changes compared to current data
        if (data?.tools) {
            const currentEnabled = data.tools.filter(t => t.enabled).map(t => t.name).sort();
            const nextEnabled = [...newTools].sort();
            const changed = JSON.stringify(currentEnabled) !== JSON.stringify(nextEnabled);
            setHasChanges(changed);
        }
    };

    const handleSave = async () => {
        try {
            await updateMutation.mutateAsync(selectedToolNames);
            toast.success(`${mcpName} tools updated successfully`);
            if (onToolsUpdate) {
                onToolsUpdate(selectedToolNames);
            }
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to update tools');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl gap-0 border-border/40 shadow-2xl">
                <DialogHeader className="p-8 pb-4 bg-muted/20 border-b border-border/40">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                                <Zap className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl tracking-tight font-semibold">Manage Tools</DialogTitle>
                                <DialogDescription className="text-sm mt-0.5">
                                    Selecting tools for <strong className="text-foreground">{mcpName}</strong>
                                </DialogDescription>
                            </div>
                        </div>
                        {hasChanges && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 animate-enter px-3 py-1">
                                Unsaved Changes
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col p-8 pt-6 pb-4">
                    {error ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                            <Alert variant="destructive" className="max-w-md rounded-2xl">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    {error instanceof Error ? error.message : 'Failed to load tools from the MCP server.'}
                                </AlertDescription>
                            </Alert>
                            <Button variant="outline" onClick={() => refetch()} className="rounded-xl px-6">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Retry Connection
                            </Button>
                        </div>
                    ) : (
                        <CustomMCPToolsSelector
                            tools={data?.tools || []}
                            selectedTools={selectedToolNames}
                            onToolsChange={handleToolsChange}
                            isLoading={isLoading}
                        />
                    )}
                </div>

                <DialogFooter className="p-8 pt-4 border-t border-border/40 bg-muted/20 flex flex-row items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground ml-1">
                        {selectedToolNames.length} tools enabled
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl px-6 hover:bg-muted/50">
                            {hasChanges ? 'Discard' : 'Close'}
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges || isUpdating || isLoading}
                            className="rounded-xl px-8 shadow-lg shadow-primary/20 min-w-[140px]"
                        >
                            {isUpdating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
