'use client';

import React from 'react';
import { List, Network, GitBranch, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowTabsNavigationProps {
    activeTab: string;
    onTabChange: (value: string) => void;
    isSaving?: boolean;
}

export const WorkflowTabsNavigation = ({ activeTab, onTabChange, isSaving }: WorkflowTabsNavigationProps) => {
    return (
        <div className="flex items-center gap-2">
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
                <button
                    onClick={() => onTabChange('advanced-legacy')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                        activeTab === 'advanced-legacy'
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    title="Legacy React Flow editor for comparison"
                >
                    <GitBranch className="w-3.5 h-3.5" />
                    Advanced (Legacy)
                </button>
            </div>

            {/* Saving indicator */}
            {isSaving && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                </div>
            )}
        </div>
    );
};
