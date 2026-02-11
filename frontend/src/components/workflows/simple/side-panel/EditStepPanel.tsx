'use client';

import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { EditStepPanelProps } from './types';

/**
 * Panel content for the "Edit Step" mode.
 * Allows editing step name, description, and configuration.
 */
export function EditStepPanel({
    onClose,
    selectedStep,
    onUpdateStep,
    onDeleteStep
}: EditStepPanelProps) {
    return (
        <div className="flex flex-col h-full bg-card rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">Edit Step</h2>
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
                    {/* Basic info */}
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="step-name" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                Name
                            </Label>
                            <Input
                                id="step-name"
                                value={selectedStep.name}
                                onChange={(e) => onUpdateStep({ id: selectedStep.id, name: e.target.value })}
                                placeholder="Step name"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="step-description" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                Description
                            </Label>
                            <Textarea
                                id="step-description"
                                value={selectedStep.description}
                                onChange={(e) => onUpdateStep({ id: selectedStep.id, description: e.target.value })}
                                placeholder="What should this step do?"
                                rows={3}
                                className="mt-1 resize-none"
                            />
                        </div>
                    </div>

                    {/* Tool configuration */}
                    {selectedStep.config?.tool_name && (
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <div className="font-medium text-sm mb-2 text-zinc-900 dark:text-zinc-100">
                                Tool Configuration
                            </div>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                                Using: <Badge variant="default" className="ml-1">{selectedStep.config.tool_name}</Badge>
                            </div>
                        </div>
                    )}

                    {/* Condition configuration */}
                    {selectedStep.type === 'condition' && (
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="condition-expression" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    Condition
                                </Label>
                                <Input
                                    id="condition-expression"
                                    value={selectedStep.conditions?.expression || ''}
                                    onChange={(e) => onUpdateStep({
                                        id: selectedStep.id,
                                        conditions: { ...selectedStep.conditions, expression: e.target.value }
                                    })}
                                    placeholder="Enter condition expression"
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    )}

                    {/* Delete button */}
                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDeleteStep(selectedStep.id)}
                            className="w-full"
                        >
                            <Trash2 className="h-4 w-4" />
                            {selectedStep.conditions?.type === 'if' ? 'Delete Conditional Group' : 'Delete Step'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
