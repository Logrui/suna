'use client';

import React from 'react';
import { GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BranchButtonProps {
    onClick: (e: React.MouseEvent) => void;
    className?: string;
    size?: "default" | "sm" | "lg" | "icon";
}

export function BranchButton({ onClick, className, size = "icon" }: BranchButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size={size}
                    className={cn(
                        "h-7 w-7 text-muted-foreground hover:text-foreground transition-colors",
                        className
                    )}
                    onClick={onClick}
                >
                    <GitBranch className="h-3.5 w-3.5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <p>Branch</p>
            </TooltipContent>
        </Tooltip>
    );
}
