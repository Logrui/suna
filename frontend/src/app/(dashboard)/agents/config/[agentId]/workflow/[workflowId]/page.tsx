'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkflowTabsNavigation } from '@/components/workflows/workflow-tabs-navigation';
import { SimpleWorkflowEditor } from '@/components/workflows/simple-workflow-editor';
import { AdvancedWorkflowEditor } from '@/components/workflows/advanced-workflow-editor';

export default function WorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = params.agentId as string;
  const workflowId = params.workflowId as string;

  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab');
    return tab === 'advanced' ? 'advanced' : 'simple';
  }, [searchParams]);

  const handleTabChange = (newTab: string) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set('tab', newTab);

    // Construct new URL
    // We use replace to avoid cluttering history if user switches back and forth rapidly
    // But push might be better if they want to use back button to switch modes
    router.push(`?${currentParams.toString()}`);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with Tabs */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">Workflow Editor</h1>
            
            <div className="ml-4 border-l pl-4 h-6 flex items-center">
              <WorkflowTabsNavigation
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'simple' ? (
          <SimpleWorkflowEditor agentId={agentId} workflowId={workflowId} />
        ) : (
          <AdvancedWorkflowEditor agentId={agentId} workflowId={workflowId} />
        )}
      </div>
    </div>
  );
}