'use client';

import { motion } from 'framer-motion';
import { Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkflowsEmptyStateProps {
    onCreateClick: () => void;
}

export function WorkflowsEmptyState({ onCreateClick }: WorkflowsEmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/50 p-12 backdrop-blur-sm text-center"
        >
            {/* Grain Overlay */}
            <div
                className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply"
                style={{ backgroundImage: "url('/noise.png')" }}
            />

            <div className="relative z-10 flex flex-col items-center gap-6">
                <div className="p-4 rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-8 w-8" />
                </div>

                <div className="space-y-2 max-w-md">
                    <h2 className="text-xl font-medium tracking-tight">No workflows yet</h2>
                    <p className="text-muted-foreground">
                        Create your first workflow to automate tasks and supercharge your agents.
                    </p>
                </div>

                <Button onClick={onCreateClick} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Workflow
                </Button>
            </div>
        </motion.div>
    );
}
