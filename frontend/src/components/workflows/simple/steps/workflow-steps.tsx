'use client';

import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConditionalStep } from '@/components/workflows/types';
import { StepCard } from './step-card';
import { TriggerStep } from './trigger-step';
import { ConditionalGroup } from './conditional-group';
import { AnimatedFlowLine } from '../../shared/animated-flow-line';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface WorkflowStepsProps {
    steps: ConditionalStep[];
    onAddStep: (index: number, parentStepId?: string) => void;
    onEditStep: (step: ConditionalStep) => void;
    onUpdateStep: (updates: Partial<ConditionalStep>) => void;
    onDeleteStep: (stepId: string) => void;
    onAddElseIf: (afterStepId: string) => void;
    onAddElse: (afterStepId: string) => void;
    onStepsChange: (steps: ConditionalStep[]) => void;
    agentTools?: any;
    isLoadingTools?: boolean;
}

export function WorkflowSteps({
    steps,
    onAddStep,
    onEditStep,
    onUpdateStep,
    onDeleteStep,
    onAddElseIf,
    onAddElse,
    onStepsChange,
    agentTools,
    isLoadingTools
}: WorkflowStepsProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Group conditional steps and generate sortable IDs
    const { triggerStep, groupedSteps, sortableIds } = useMemo(() => {
        // Enforce: Trigger step (if any) is always separated and handled as the first step
        const trigger = steps.find(s => s.config?.trigger_id && s.config?.trigger_type);
        const nonTriggerSteps = steps.filter(s => !(s.config?.trigger_id && s.config?.trigger_type));

        const result: Array<ConditionalStep | ConditionalStep[]> = [];
        const ids: string[] = [];
        let currentConditionGroup: ConditionalStep[] = [];

        nonTriggerSteps.forEach(step => {
            if (step.type === 'condition') {
                currentConditionGroup.push(step);
            } else {
                if (currentConditionGroup.length > 0) {
                    const group = [...currentConditionGroup];
                    result.push(group);
                    ids.push(`condition-group-${group[0]?.id}`);
                    currentConditionGroup = [];
                }
                result.push(step);
                ids.push(step.id);
            }
        });

        if (currentConditionGroup.length > 0) {
            const group = [...currentConditionGroup];
            result.push(group);
            ids.push(`condition-group-${group[0]?.id}`);
        }

        return { triggerStep: trigger, groupedSteps: result, sortableIds: ids };
    }, [steps]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (active.id !== over?.id) {
            const activeId = active.id as string;
            const overId = over?.id as string;

            // Find indices in the sortableIds array
            const oldIndex = sortableIds.findIndex(id => id === activeId);
            const newIndex = sortableIds.findIndex(id => id === overId);

            if (oldIndex !== -1 && newIndex !== -1) {
                // Reorder the groupedSteps array
                const newGroupedSteps = arrayMove(groupedSteps, oldIndex, newIndex);

                // Flatten back to steps array
                const newNonTriggerSteps: ConditionalStep[] = [];
                newGroupedSteps.forEach(item => {
                    if (Array.isArray(item)) {
                        newNonTriggerSteps.push(...item);
                    } else {
                        newNonTriggerSteps.push(item);
                    }
                });

                // Reconstruct full steps with Trigger at the top if it exists
                const newSteps = triggerStep ? [triggerStep, ...newNonTriggerSteps] : newNonTriggerSteps;

                // Update order values
                newSteps.forEach((step, idx) => {
                    step.order = idx;
                });

                // Call the parent's onStepsChange
                onStepsChange(newSteps);
            }
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-2">
                {/* Always render Trigger Step at the top if it exists */}
                {triggerStep && (
                    <div className="mb-6 relative">
                        <TriggerStep
                            step={triggerStep}
                            onEdit={onEditStep}
                            onDelete={(step) => onDeleteStep(step.id)}
                        />
                        <div className="absolute left-1/2 -ml-px w-px h-6 bg-border -bottom-6" />

                        {/* Flow line between Trigger and First Step */}
                        {groupedSteps.length > 0 && (
                            <div className="relative flex items-center justify-center py-1 group/flow -mb-2 mt-4">
                                <AnimatedFlowLine />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onAddStep(1)} // Insert after trigger (index 1)
                                    className="absolute right-4 h-6 px-2 text-xs opacity-0 group-hover/flow:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm hover:bg-background cursor-pointer"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 relative">
                        {groupedSteps.map((item, index) => {
                            // Calculate actual index offset if trigger exists
                            // groupedSteps index 0 is actually index 1 if trigger exists
                            const visualIndex = index + (triggerStep ? 1 : 0);

                            // For adding a step AFTER this one
                            const nextStepIndex = visualIndex + 1;

                            return (
                                <React.Fragment key={Array.isArray(item) ? `condition-${item[0]?.id}` : item.id}>
                                    {Array.isArray(item) ? (
                                        // Conditional flow
                                        <ConditionalGroup
                                            conditionSteps={item}
                                            groupKey={`condition-group-${index}`}
                                            onUpdateStep={onUpdateStep}
                                            onAddElse={onAddElse}
                                            onAddElseIf={onAddElseIf}
                                            onRemove={onDeleteStep}
                                            onEdit={onEditStep}
                                            onAddStep={onAddStep}
                                            agentTools={agentTools}
                                            isLoadingTools={isLoadingTools}
                                        />
                                    ) : (
                                        // Regular step
                                        <StepCard
                                            step={item}
                                            stepNumber={visualIndex + 1}
                                            onEdit={onEditStep}
                                            onUpdateStep={onUpdateStep}
                                            agentTools={agentTools}
                                            isLoadingTools={isLoadingTools}
                                        />
                                    )}

                                    {/* Flow line between steps with hover add button */}
                                    {index < groupedSteps.length - 1 && (
                                        <div className="relative flex items-center justify-center py-1 group/flow">
                                            <AnimatedFlowLine />

                                            {/* Ghost add button that appears on hover */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onAddStep(nextStepIndex)}
                                                className="absolute right-4 h-6 px-2 text-xs opacity-0 group-hover/flow:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm hover:bg-background cursor-pointer"
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Add
                                            </Button>
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </SortableContext>

                {/* Add step button at the bottom */}
                <div className="flex justify-center pt-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddStep(steps.length)}
                        className="h-8 px-4 border border-dashed border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 bg-background hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Add step
                    </Button>
                </div>

                <DragOverlay>
                    {activeId ? (
                        <div className="opacity-75">
                            {(() => {
                                const activeStep = steps.find(s => s.id === activeId);
                                if (!activeStep) return null;
                                return (
                                    <StepCard
                                        step={activeStep}
                                        stepNumber={1}
                                        onEdit={() => { }}
                                        onUpdateStep={() => { }}
                                    />
                                );
                            })()}
                        </div>
                    ) : null}
                </DragOverlay>
            </div>
        </DndContext>
    );
} 
