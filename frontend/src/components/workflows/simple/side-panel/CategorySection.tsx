'use client';

import React from 'react';
import { StepTypeButton } from './StepTypeButton';
import { StepTypeGroup } from './StepTypeGroup';
import type { CategorySectionProps, StepGroup, StepType } from './types';

/**
 * Categories that should render native (ungrouped) tools inside a collapsible.
 * For other categories, native tools are rendered as standalone buttons.
 */
const CATEGORIES_WITH_NATIVE_COLLAPSIBLE = new Set(['tools', 'integrations', 'native_tools']);

/**
 * Renders a single category section with its step types.
 * Handles grouping logic and determines whether to use collapsibles for native tools.
 */
export function CategorySection({ category, steps, searchQuery, onStepTypeClick }: CategorySectionProps) {
    if (steps.length === 0) return null;

    // Separate native (ungrouped) steps from grouped steps
    const nativeSteps = steps.filter(step => !step.group);
    const groupedSteps = steps.filter(step => step.group).reduce((acc, step) => {
        const groupName = step.group!;
        if (!acc[groupName]) {
            // Extract toolkit_slug from config for dynamic icon fetching
            const toolkitSlug = step.config?.toolkit_slug as string | undefined;
            acc[groupName] = {
                name: groupName,
                iconUrl: step.groupIconUrl,
                toolkitSlug: toolkitSlug,
                steps: []
            };
        }
        acc[groupName].steps.push(step);
        return acc;
    }, {} as Record<string, StepGroup>);

    const hasGroups = Object.keys(groupedSteps).length > 0;
    const isSearching = searchQuery.length > 0;

    // Determine if native tools should be rendered in a collapsible group
    // Criteria: 
    // 1. Category is explicitly marked for collapsible rendering, OR
    // 2. Category has both native and grouped tools (for visual consistency)
    const useNativeCollapsible =
        CATEGORIES_WITH_NATIVE_COLLAPSIBLE.has(category.id) ||
        (hasGroups && nativeSteps.length > 0);

    console.log(`[CategorySection] ${category.id}:`, {
        nativeCount: nativeSteps.length,
        groupsCount: Object.keys(groupedSteps).length,
        useNativeCollapsible,
        groups: Object.entries(groupedSteps).map(([name, g]) => ({
            name,
            iconUrl: g.iconUrl || '(none)',
            toolkitSlug: g.toolkitSlug || '(none)',
            stepCount: g.steps.length,
            firstStepIconUrl: g.steps[0]?.iconUrl || '(none)',
            firstStepGroupIconUrl: g.steps[0]?.groupIconUrl || '(none)',
        }))
    });

    return (
        <div className="space-y-3">
            <div>
                <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                    {category.name}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {category.description}
                </p>
            </div>

            <div className="space-y-2">
                {/* Render Native Steps */}
                {nativeSteps.length > 0 && (
                    useNativeCollapsible ? (
                        <StepTypeGroup
                            group={{
                                name: 'Native Tools',
                                steps: nativeSteps
                            }}
                            defaultCollapsed={true}
                            isSearching={isSearching}
                            onStepTypeClick={onStepTypeClick}
                        />
                    ) : (
                        // Render as standalone buttons (no collapsible wrapper)
                        nativeSteps.map(stepType => (
                            <StepTypeButton
                                key={stepType.id}
                                stepType={stepType}
                                onClick={() => onStepTypeClick(stepType)}
                            />
                        ))
                    )
                )}

                {/* Render Grouped Steps */}
                {Object.values(groupedSteps).map(group => (
                    <StepTypeGroup
                        key={group.name}
                        group={group}
                        defaultCollapsed={true}
                        isSearching={isSearching}
                        onStepTypeClick={onStepTypeClick}
                    />
                ))}
            </div>
        </div>
    );
}
