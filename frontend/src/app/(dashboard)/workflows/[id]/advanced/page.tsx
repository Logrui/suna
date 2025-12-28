'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdvancedWorkflowEditor } from '@/components/workflows/advanced/advanced-workflow-editor';
import { useWorkflow } from '@/hooks/react-query/workflows/useWorkflow';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Standalone Advanced Workflow Editor Page
 * 
 * This page provides direct access to the advanced workflow editor via URL:
 * /workflows/[id]/advanced
 * 
 * Note: The primary access point is via /agents/config/[agentId]/workflow/[workflowId]?tab=advanced
 * This standalone page is kept for backward compatibility and direct linking.
 */
export default function AdvancedWorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { workflow, loading } = useWorkflow(id);

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="h-[80%] w-[90%]" />
        </div>
      </div>
    );
  }

  // For standalone page, we don't have agentId from URL
  // Try to get it from workflow data or use empty string
  const agentId = workflow?.agent_id || '';

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {workflow?.name || 'Advanced Workflow Editor'}
              </h1>
              <p className="text-xs text-muted-foreground">
                Advanced Workflows • {id.slice(0, 8)}...
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <AdvancedWorkflowEditor agentId={agentId} workflowId={id} />
      </div>
    </div>
  );
}
