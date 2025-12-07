import React from 'react';
import { useExecutionStore } from '@/store/workflows/executionStore';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface LiveNodeStatusProps {
    nodeId: string;
    className?: string;
}

export function LiveNodeStatus({ nodeId, className }: LiveNodeStatusProps) {
    const status = useExecutionStore((state) => state.nodeStatus[nodeId]?.status);

    if (!status || status === 'pending') return null;

    return (
        <div className={cn(
            "absolute -top-3 -right-3 z-10 rounded-full p-1 shadow-md border",
            status === 'running' && "bg-blue-100 border-blue-200 text-blue-600 animate-pulse",
            status === 'completed' && "bg-green-100 border-green-200 text-green-600",
            status === 'failed' && "bg-red-100 border-red-200 text-red-600",
            className
        )}>
            {status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
            {status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
            {status === 'failed' && <XCircle className="w-4 h-4" />}
        </div>
    );
}
