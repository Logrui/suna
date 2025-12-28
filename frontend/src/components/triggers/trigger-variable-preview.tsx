"use client";

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TriggerVariablePreviewProps {
    payload?: Record<string, any>;
    appName?: string; // Name of the app/toolkit the variables come from
    onInsertVariable?: (variableName: string) => void;
    className?: string;
}

/**
 * Extracts variable names from a JSON schema payload
 */
function extractVariables(schema: Record<string, any>, prefix = ''): { name: string; type: string; description?: string }[] {
    const variables: { name: string; type: string; description?: string }[] = [];

    if (!schema) return variables;

    // Handle JSON Schema format with properties
    if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
            const prop = value as Record<string, any>;
            const fullPath = prefix ? `${prefix}.${key}` : key;

            if (prop.type === 'object' && prop.properties) {
                // Recursively extract nested properties
                variables.push(...extractVariables(prop, fullPath));
            } else {
                variables.push({
                    name: fullPath,
                    type: prop.type || 'string',
                    description: prop.description
                });
            }
        }
    } else {
        // Handle flat key-value format
        for (const [key, value] of Object.entries(schema)) {
            if (key !== 'type' && key !== 'description' && key !== 'title' && key !== 'required') {
                const val = value as Record<string, any>;
                if (typeof val === 'object' && val !== null) {
                    variables.push({
                        name: key,
                        type: val.type || 'object',
                        description: val.description
                    });
                }
            }
        }
    }

    return variables;
}

/**
 * TriggerVariablePreview - Shows available variables from trigger payload schema
 * Users can click variables to insert them into the Agent Instructions textarea
 */
export function TriggerVariablePreview({ payload, appName, onInsertVariable, className }: TriggerVariablePreviewProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copiedVar, setCopiedVar] = useState<string | null>(null);

    const variables = useMemo(() => {
        if (!payload) return [];
        return extractVariables(payload);
    }, [payload]);

    if (variables.length === 0) {
        return null;
    }

    const handleCopyVariable = (varName: string) => {
        const template = `{{${varName}}}`;
        navigator.clipboard.writeText(template);
        setCopiedVar(varName);
        setTimeout(() => setCopiedVar(null), 1500);

        if (onInsertVariable) {
            onInsertVariable(varName);
        }
    };

    return (
        <div className={cn("rounded-lg border border-border/50 bg-muted/30", className)}>
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium">
                        Available Variables{appName ? ` from ${appName}` : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">({variables.length})</span>
                </div>
                <span className="text-xs text-muted-foreground">Click to insert (WIP)</span>
            </button>

            {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border/50">
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {variables.map((variable) => (
                            <Button
                                key={variable.name}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs font-mono bg-background/50 hover:bg-primary/10 hover:border-primary/50"
                                onClick={() => handleCopyVariable(variable.name)}
                                title={variable.description || `Type: ${variable.type}`}
                            >
                                {copiedVar === variable.name ? (
                                    <Check className="h-3 w-3 mr-1 text-green-500" />
                                ) : (
                                    <Copy className="h-3 w-3 mr-1 text-muted-foreground" />
                                )}
                                {`{{${variable.name}}}`}
                            </Button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Click a variable to copy it. Paste into your instructions to use incoming data from the trigger.
                    </p>
                </div>
            )}
        </div>
    );
}
