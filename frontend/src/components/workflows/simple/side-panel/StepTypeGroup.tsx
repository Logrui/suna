'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, Box, Wrench, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StepTypeButton } from './StepTypeButton';
import { useToolkitIcon } from './use-toolkit-icon';
import type { StepTypeGroupProps } from './types';

/**
 * Renders a collapsible group of step types with a header showing the group name,
 * optional icon, and step count.
 * 
 * Icon Resolution Order:
 * 1. Static iconUrl from group props (already fetched/cached)
 * 2. Dynamic fetch via useToolkitIcon if toolkitSlug is provided
 * 3. "Native Tools" group uses Wrench icon
 * 4. Fallback: Box icon
 * 
 * @param group - The step group data
 * @param isSearching - If true, expands the group when user is searching
 * @param defaultCollapsed - If true, the group starts collapsed by default
 * @param onStepTypeClick - Callback when a step type is clicked
 */
export function StepTypeGroup({ group, isSearching = false, defaultCollapsed = false, onStepTypeClick }: StepTypeGroupProps) {
    // Use controlled state so we can respond to isSearching changes
    const [isOpen, setIsOpen] = useState(!defaultCollapsed);
    const [imageError, setImageError] = useState(false);

    // Dynamically fetch icon if toolkitSlug is provided and no static iconUrl exists
    const shouldFetchIcon = !!group.toolkitSlug && !group.iconUrl;
    const { iconUrl: fetchedIconUrl, isLoading: isLoadingIcon } = useToolkitIcon(
        shouldFetchIcon ? group.toolkitSlug : undefined,
        shouldFetchIcon
    );

    // Determine the final icon URL: static > fetched
    const resolvedIconUrl = group.iconUrl || fetchedIconUrl;

    // When isSearching changes, force open if searching
    useEffect(() => {
        if (isSearching) {
            setIsOpen(true);
        } else if (defaultCollapsed) {
            // When search is cleared, collapse back if defaultCollapsed is true
            setIsOpen(false);
        }
    }, [isSearching, defaultCollapsed]);

    // Reset image error when URL changes
    useEffect(() => {
        setImageError(false);
    }, [resolvedIconUrl]);

    // Debug: Log group icon URL data
    console.log(`[StepTypeGroup] Rendering group "${group.name}":`, {
        staticIconUrl: group.iconUrl || '(none)',
        toolkitSlug: group.toolkitSlug || '(none)',
        fetchedIconUrl: fetchedIconUrl || '(none)',
        resolvedIconUrl: resolvedIconUrl || '(none)',
        isLoadingIcon,
        stepCount: group.steps.length,
    });

    // Determine the icon to show
    const isNativeToolsGroup = group.name === 'Native Tools';

    const renderIcon = () => {
        // Native Tools group always uses Wrench icon
        if (isNativeToolsGroup) {
            return <Wrench className="w-5 h-5 text-muted-foreground" />;
        }

        // Show loading spinner while fetching icon
        if (shouldFetchIcon && isLoadingIcon) {
            return (
                <div className="w-5 h-5 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
            );
        }

        // Show image if we have a URL and no error
        if (resolvedIconUrl && !imageError) {
            return (
                <img
                    src={resolvedIconUrl}
                    alt=""
                    className="w-5 h-5 object-contain rounded"
                    onError={() => setImageError(true)}
                />
            );
        }

        // Fallback: Show first letter or Box icon
        if (group.name && group.name !== 'Native Tools') {
            return (
                <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">{group.name.charAt(0).toUpperCase()}</span>
                </div>
            );
        }

        return <Box className="w-5 h-5 text-muted-foreground" />;
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-foreground transition-colors group">
                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                {renderIcon()}
                <span>{group.name}</span>
                <span className="text-xs text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded-full">
                    {group.steps.length}
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-1 pl-4 border-l ml-2">
                {group.steps.map(stepType => (
                    <StepTypeButton
                        key={stepType.id}
                        stepType={stepType}
                        onClick={() => onStepTypeClick(stepType)}
                        compact
                        inheritedIconUrl={resolvedIconUrl}
                    />
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}
