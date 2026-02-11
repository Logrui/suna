'use client';

import React from 'react';
import { getStepIconAndColor } from '../../shared/workflow-definitions';
import { ToolIcon } from '../../shared/tool-icon';
import type { StepTypeButtonProps } from './types';

/**
 * Renders a single step type button with icon, name, and description.
 * Supports compact mode for use inside collapsible groups.
 * 
 * Icon resolution order:
 * 1. Step's own iconUrl (from stepType.iconUrl or config)
 * 2. Inherited icon URL from parent group (inheritedIconUrl prop)
 * 3. Lucide icon component based on step type
 */
export function StepTypeButton({ stepType, onClick, compact = false, inheritedIconUrl }: StepTypeButtonProps) {
    const { icon: IconComponent, color, iconUrl: stepIconUrl } = getStepIconAndColor(stepType);

    // Use step's own iconUrl if available, otherwise fall back to inherited group icon
    const effectiveIconUrl = stepIconUrl || inheritedIconUrl;

    return (
        <button
            key={stepType.id}
            onClick={onClick}
            className={
                compact
                    ? "w-full p-2 text-left border border-transparent hover:border-border rounded-lg hover:bg-muted/50 transition-colors"
                    : "w-full p-3 text-left border border-border rounded-2xl hover:bg-muted/50 transition-colors"
            }
        >
            <div className="flex items-center gap-3">
                <ToolIcon
                    icon={IconComponent}
                    iconUrl={effectiveIconUrl}
                    color={color}
                    size={compact ? "sm" : "md"}
                />
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {stepType.name}
                    </div>
                    <div className={`text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
                        {stepType.description}
                    </div>
                </div>
            </div>
        </button>
    );
}
