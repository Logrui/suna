'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Save, GitBranch, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface WorkflowHeaderProps {
    workflowName: string;
    workflowDescription?: string;
    onToggleSidePanel: () => void;
    onSave: () => void;
    onExecute?: () => void;
    isSaving?: boolean;
    isExecuting?: boolean;
    onNameChange?: (name: string) => void;
    onDescriptionChange?: (description: string) => void;
}

export function WorkflowHeader({
    workflowName,
    workflowDescription,
    onToggleSidePanel,
    onSave,
    onExecute,
    isSaving = false,
    isExecuting = false,
    onNameChange,
    onDescriptionChange
}: WorkflowHeaderProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [localName, setLocalName] = useState(workflowName || 'Untitled Simple Workflow');
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Sync local name with prop when it changes
    useEffect(() => {
        setLocalName(workflowName || 'Untitled Simple Workflow');
    }, [workflowName]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const handleNameSave = () => {
        setIsEditingName(false);
        if (localName.trim() && localName !== workflowName) {
            onNameChange?.(localName.trim());
        } else if (!localName.trim()) {
            // Reset to original if empty
            setLocalName(workflowName || 'Untitled Simple Workflow');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNameSave();
        } else if (e.key === 'Escape') {
            setIsEditingName(false);
            setLocalName(workflowName || 'Untitled Simple Workflow');
        }
    };

    return (
        <div className="px-6 py-4 flex items-center justify-between border-b bg-background/50 backdrop-blur-sm relative h-14">
            {/* Left Section - Placeholder for side panel toggle if needed */}
            <div className="flex-1 flex items-center">
                {/* Space reserved for future left-aligned items */}
                <Badge variant="outline" className="border-white/50 text-white dark:text-white">
                    Kortix Simple Workflows
                </Badge>
            </div>

            {/* Center Section - Workflow Name and Icon */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
                {/* Workflow Icon */}
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <GitBranch className="h-4 w-4 text-primary" />
                </div>

                {/* Editable Workflow Name */}
                <div className="flex flex-col items-center">
                    {isEditingName ? (
                        <Input
                            ref={nameInputRef}
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            onBlur={handleNameSave}
                            onKeyDown={handleKeyDown}
                            className="h-8 text-lg font-semibold bg-transparent border-primary/30 focus:border-primary w-64 text-center"
                            placeholder="Enter workflow name"
                        />
                    ) : (
                        <h1
                            onClick={() => setIsEditingName(true)}
                            className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors text-center whitespace-nowrap"
                            title="Click to edit workflow name"
                        >
                            {localName}
                        </h1>
                    )}
                </div>
            </div>

            {/* Right Section - Action Buttons */}
            <div className="flex-1 flex items-center justify-end gap-2">
                {onExecute && (
                    <Button
                        onClick={onExecute}
                        disabled={isExecuting || isSaving}
                        variant="outline"
                        size="sm"
                    >
                        <Play className="h-3.5 w-3.5" />
                        {isExecuting ? 'Executing...' : 'Execute'}
                    </Button>
                )}
                <Button
                    onClick={onSave}
                    disabled={isSaving}
                    size="sm"
                    className="h-8"
                >
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? 'Saving...' : 'Save Workflow'}
                </Button>
            </div>
        </div>
    );
}
