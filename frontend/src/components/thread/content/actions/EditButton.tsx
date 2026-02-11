'use client';

import React from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface EditButtonProps {
    onClick: (e: React.MouseEvent) => void;
    className?: string;
    size?: "default" | "sm" | "lg" | "icon";
}

export function EditButton({ onClick, className, size = "icon" }: EditButtonProps) {
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
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <p>Edit</p>
            </TooltipContent>
        </Tooltip>
    );
}
