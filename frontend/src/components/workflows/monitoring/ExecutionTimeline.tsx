import React, { useEffect, useRef } from 'react';
import { useExecutionStore } from '@/store/workflows/executionStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, PlayCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export function ExecutionTimeline() {
    const events = useExecutionStore((state) => state.events);
    const status = useExecutionStore((state) => state.status);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [events]);

    if (status === 'idle' && events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <PlayCircle className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Ready to execute</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full w-full">
            <div className="p-4 space-y-4">
                {events.map((event, index) => (
                    <div key={index} className="flex gap-3 text-sm">
                        <div className="mt-0.5">
                            {getEventIcon(event.type)}
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                                <span className={cn("font-medium", getEventColor(event.type))}>
                                    {getEventTitle(event)}
                                </span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                    {format(new Date(event.timestamp), 'HH:mm:ss')}
                                </span>
                            </div>
                            <p className="text-muted-foreground text-xs break-all">
                                {event.message}
                            </p>
                            {event.details && (
                                <div className="bg-muted/50 rounded p-2 text-xs font-mono mt-1 overflow-x-auto">
                                    <pre>{JSON.stringify(event.details, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>
        </ScrollArea>
    );
}

function getEventIcon(type: string) {
    switch (type) {
        case 'execution_started':
            return <PlayCircle className="w-4 h-4 text-blue-500" />;
        case 'execution_completed':
            return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        case 'execution_failed':
            return <XCircle className="w-4 h-4 text-red-500" />;
        case 'node_started':
            return <Clock className="w-4 h-4 text-yellow-500" />;
        case 'node_completed':
            return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        case 'node_failed':
            return <AlertCircle className="w-4 h-4 text-red-500" />;
        default:
            return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
}

function getEventColor(type: string) {
    switch (type) {
        case 'execution_started':
            return 'text-blue-500';
        case 'execution_completed':
            return 'text-green-500';
        case 'execution_failed':
            return 'text-red-500';
        case 'node_started':
            return 'text-yellow-600 dark:text-yellow-400';
        case 'node_completed':
            return 'text-green-600 dark:text-green-400';
        case 'node_failed':
            return 'text-red-600 dark:text-red-400';
        default:
            return 'text-foreground';
    }
}

function getEventTitle(event: any) {
    if (event.type === 'node_started' || event.type === 'node_completed' || event.type === 'node_failed') {
        return event.details?.label || event.node_id || 'Node';
    }
    switch (event.type) {
        case 'execution_started': return 'Execution Started';
        case 'execution_completed': return 'Execution Completed';
        case 'execution_failed': return 'Execution Failed';
        default: return 'Event';
    }
}
