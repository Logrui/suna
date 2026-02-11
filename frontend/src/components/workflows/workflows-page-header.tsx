'use client';

import React from 'react';
import { Workflow } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export const WorkflowsPageHeader = () => {
    return (
        <PageHeader icon={Workflow}>
            <div className="space-y-4">
                <div className="text-4xl font-semibold tracking-tight">
                    <span className="text-primary">Workflows</span>
                </div>
            </div>
        </PageHeader>
    );
};
