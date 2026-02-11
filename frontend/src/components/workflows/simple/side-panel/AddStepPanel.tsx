'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CategorySection } from './CategorySection';
import type { AddStepPanelProps, StepType } from './types';

/**
 * Panel content for the "Add Step" mode.
 * Displays searchable categories of step types.
 */
export function AddStepPanel({
    onClose,
    availableStepTypes,
    categories,
    searchQuery,
    onSearchChange,
    onStepTypeClick
}: AddStepPanelProps) {
    // Filter step types based on search
    const filteredStepTypes = availableStepTypes.filter(type =>
        (type.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (type.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-card rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">Add Step</h2>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-auto bg-muted/30 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/50">
                <div className="space-y-6">
                    {/* Search */}
                    <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                            Choose a step type to add to your workflow
                        </p>
                        <Input
                            placeholder="Search steps..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full"
                            autoFocus
                        />
                    </div>

                    {/* Categories */}
                    {categories.map(category => {
                        const categorySteps = filteredStepTypes.filter(
                            step => step.category === category.id
                        );

                        return (
                            <CategorySection
                                key={category.id}
                                category={category}
                                steps={categorySteps}
                                searchQuery={searchQuery}
                                onStepTypeClick={onStepTypeClick}
                            />
                        );
                    })}

                    {/* Empty state */}
                    {filteredStepTypes.length === 0 && (
                        <div className="text-center py-8">
                            <div className="text-zinc-400 dark:text-zinc-500 mb-2">
                                No steps found
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                Try adjusting your search
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
