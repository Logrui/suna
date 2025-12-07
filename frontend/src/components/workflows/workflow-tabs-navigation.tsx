'use client';

import React from 'react';
import { List, Network } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowTabsNavigationProps {
    activeTab: string;
    onTabChange: (value: string) => void;
}

export const WorkflowTabsNavigation = ({ activeTab, onTabChange }: WorkflowTabsNavigationProps) => {
    return (
        <div className="flex p-1 bg-muted rounded-lg border border-border/50">
            <button
                onClick={() => onTabChange('simple')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === 'simple' 
                        ? "bg-background text-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
            >
                <List className="w-3.5 h-3.5" />
                Simple
            </button>
            <button
                onClick={() => onTabChange('advanced')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    activeTab === 'advanced' 
                        ? "bg-background text-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
            >
                <Network className="w-3.5 h-3.5" />
                Advanced
            </button>
        </div>
    );
};
