'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutTemplate } from 'lucide-react';
import { useCanvasStore } from '@/store/workflows/canvasStore';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export const AutoLayoutButton = () => {
    const layoutNodes = useCanvasStore((state) => state.layoutNodes);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="bg-card border-border hover:bg-accent hover:text-accent-foreground h-8 w-8"
                        onClick={() => layoutNodes('TB')}
                    >
                        <LayoutTemplate className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                    <p>Auto Layout</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
