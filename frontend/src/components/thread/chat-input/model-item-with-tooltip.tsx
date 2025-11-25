import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { ModelProviderIcon } from '@/lib/model-provider-icons';
import { Lock, Check, Cpu, Zap } from 'lucide-react';
import type { ModelOption } from '@/hooks/agents';

interface ModelItemWithTooltipProps {
    model: ModelOption;
    isActive: boolean;
    canAccess: boolean;
    onSelect: () => void;
}

export function ModelItemWithTooltip({
    model,
    isActive,
    canAccess,
    onSelect,
}: ModelItemWithTooltipProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
    const itemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isHovered && itemRef.current) {
            const rect = itemRef.current.getBoundingClientRect();
            setTooltipPos({
                top: rect.bottom,
                left: rect.right + 8
            });
        }
    }, [isHovered]);

    const tooltip = isHovered && typeof document !== 'undefined' ? createPortal(
        <div
            className="fixed z-[9999] w-64 p-3 bg-popover border border-border shadow-lg rounded-xl pointer-events-none"
            style={{
                top: `${tooltipPos.top}px`,
                left: `${tooltipPos.left}px`,
            }}
        >
            <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h4 className="font-medium text-sm text-foreground">{model.label}</h4>
                        {
                            model.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {model.description}
                                </p>
                            )
                        }
                    </div >
                    {
                        model.requiresSubscription && (
                            <Lock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        )
                    }
                </div >

                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-lg">
                        <span className="text-muted-foreground flex items-center gap-1">
                            <Cpu className="h-3 w-3" /> Context
                        </span>
                        <span className="font-medium">
                            {model.contextWindow ? `${(model.contextWindow / 1000).toFixed(0)}k` : 'Unknown'}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 p-2 bg-muted/50 rounded-lg">
                        <span className="text-muted-foreground flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Speed
                        </span>
                        <span className="font-medium">
                            {model.id.includes('flash') || model.id.includes('lite') || model.id.includes('haiku') ? 'Fast' : model.id.includes('ollama') || model.id.includes('lm_studio') ? 'Local' : 'Standard'}
                        </span>
                    </div>
                </div>
                {
                    model.capabilities && model.capabilities.length > 0 && (
                        <div className="space-y-1">
                            {
                                model.id.includes('ollama') || model.id.includes('lm_studio') ? (
                                    <span className="text-xs text-muted-foreground">Local</span>
                                ) : (
                                    <span className="text-xs text-muted-foreground">Capabilities</span>
                                )
                            }
                            <div className="flex flex-wrap gap-1">
                                {model.capabilities.map((cap) => (
                                    <span key={cap} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
                                        {cap}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )
                }
            </div >
        </div >,
        document.body
    ) : null;

    return (
        <>
            <SpotlightCard
                className={cn(
                    "transition-colors cursor-pointer bg-transparent",
                    !canAccess && "opacity-60"
                )}
            >
                <div
                    ref={itemRef}
                    className="flex items-center gap-3 text-sm cursor-pointer px-1 py-1 relative"
                    onMouseEnter={() => {
                        console.log('[Tooltip] Mouse ENTER on model:', model.id, model.label);
                        setIsHovered(true);
                    }}
                    onMouseLeave={() => {
                        console.log('[Tooltip] Mouse LEAVE on model:', model.id, model.label);
                        setIsHovered(false);
                    }}
                    onClick={onSelect}
                >
                    <ModelProviderIcon
                        modelId={model.id}
                        size={32}
                        className={cn("flex-shrink-0", !canAccess && "opacity-50")}
                    />
                    <span className={cn("flex-1 truncate font-medium", !canAccess && "text-muted-foreground")}>
                        {model.label}
                    </span>
                    {!canAccess && (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    {isActive && canAccess && (
                        <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    )}
                </div>
            </SpotlightCard>
            {tooltip}
        </>
    );
}
