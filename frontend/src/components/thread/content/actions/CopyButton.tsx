'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
    text: string;
    className?: string;
    size?: "default" | "sm" | "lg" | "icon";
}

export function CopyButton({ text, className, size = "icon" }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

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
                    onClick={handleCopy}
                >
                    {copied ? (
                        <Check className="h-3.5 w-3.5 text-foreground" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
                <p>{copied ? 'Copied!' : 'Copy'}</p>
            </TooltipContent>
        </Tooltip>
    );
}
