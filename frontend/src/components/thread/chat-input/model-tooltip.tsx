import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ModelOption } from '@/hooks/agents';
import { Cpu, Zap, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelTooltipProps {
    model: ModelOption;
    children: React.ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    disabled?: boolean;
}

export function ModelTooltip({
    model,
    children,
    side = 'right',
    align = 'center',
    disabled = false,
}: ModelTooltipProps) {
    const [isHovered, setIsHovered] = useState(false);

    if (disabled) {
        return <>{children}</>;
    }

    const formatContextWindow = (tokens: number) => {
        if (tokens >= 1000000) {
            return `${(tokens / 1000000).toFixed(1)}M tokens`;
        }
        if (tokens >= 1000) {
            return `${(tokens / 1000).toFixed(0)}k tokens`;
        }
        return `${tokens} tokens`;
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}

            {isHovered && (
                <div
                    className={cn(
                        "absolute z-50 w-64 p-3 bg-popover border border-border shadow-lg rounded-xl",
                        "animate-in fade-in-0 zoom-in-95",
                        side === 'right' && "left-full top-0 ml-2",
                        side === 'left' && "right-full top-0 mr-2",
                        side === 'top' && "bottom-full left-0 mb-2",
                        side === 'bottom' && "top-full left-0 mt-2"
                    )}
                >
                    <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h4 className="font-medium text-sm text-foreground">{model.label}</h4>
                                {model.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                        {model.description}
                                    </p>
                                )}
                            </div>
                            {model.requiresSubscription && (
                                <Lock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-lg">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Cpu className="h-3 w-3" /> Context
                                </span>
                                <span className="font-medium">
                                    {model.contextWindow ? formatContextWindow(model.contextWindow) : 'Unknown'}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-lg">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Zap className="h-3 w-3" /> Speed
                                </span>
                                <span className="font-medium">
                                    {model.id.includes('flash') || model.id.includes('lite') || model.id.includes('haiku') ? 'Fast' : 'Standard'}
                                </span>
                            </div>
                        </div>

                        {model.capabilities && model.capabilities.length > 0 && (
                            <div className="space-y-1.5">
                                <span className="text-xs text-muted-foreground">Capabilities</span>
                                <div className="flex flex-wrap gap-1">
                                    {model.capabilities.map((cap) => (
                                        <Badge
                                            key={cap}
                                            variant="outline"
                                            className="text-[10px] h-5 px-1.5 bg-background border-border/50"
                                        >
                                            {cap}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
