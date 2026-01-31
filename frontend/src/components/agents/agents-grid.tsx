import React, { useState } from 'react';
import { Trash2, MessageCircle, Wrench, GlobeLock, Download, Shield, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useUnpublishTemplate } from '@/hooks/secure-mcp/use-secure-mcp';
import { toast } from 'sonner';
import { UnifiedAgentCard } from '@/components/ui/unified-agent-card';
import { AgentAvatar } from '../thread/content/agent-avatar';
import { AgentConfigurationDialog } from './agent-configuration-dialog';
import { AgentModal } from './agent-modal';
import { isStagingMode } from '@/lib/config';
import type { Agent } from '@/hooks/agents/utils';



interface AgentsGridProps {
  agents: Agent[];
  onEditAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
  onToggleDefault: (agentId: string, currentDefault: boolean) => void;
  deleteAgentMutation?: { isPending: boolean }; // Made optional as we'll track per-agent state
  isDeletingAgent?: (agentId: string) => boolean;
  onPublish?: (agent: Agent) => void;
  publishingId?: string | null;
}

export const AgentsGrid: React.FC<AgentsGridProps> = ({
  agents,
  onEditAgent,
  onDeleteAgent,
  onToggleDefault,
  deleteAgentMutation,
  isDeletingAgent,
  onPublish,
  publishingId: externalPublishingId
}) => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [configAgentId, setConfigAgentId] = useState<string | null>(null);
  const router = useRouter();

  const unpublishAgentMutation = useUnpublishTemplate();

  const handleAgentClick = (agent: Agent) => {
    setSelectedAgent(agent);
  };

  const handleCustomize = (agentId: string) => {
    setSelectedAgent(null);
    setConfigAgentId(agentId);
    setShowConfigDialog(true);
  };

  const handleChat = (agentId: string) => {
    router.push(`/dashboard?agent_id=${agentId}`);
    setSelectedAgent(null);
  };

  const handlePublish = (agentId: string) => {
    const agent = agents.find(a => a.agent_id === agentId);
    if (agent && onPublish) {
      onPublish(agent);
      setSelectedAgent(null);
    }
  };

  const handleUnpublish = async (agentId: string) => {
    try {
      setUnpublishingId(agentId);
      await unpublishAgentMutation.mutateAsync(agentId);
      toast.success('Worker made private');
      setSelectedAgent(null);
    } catch (error: any) {
      toast.error('Failed to make Worker private');
    } finally {
      setUnpublishingId(null);
    }
  };


  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map((agent) => {
          const agentData = {
            ...agent,
            id: agent.agent_id
          };

          const isDeleting = isDeletingAgent?.(agent.agent_id) || false;
          const isGloballyDeleting = deleteAgentMutation?.isPending || false;

          return (
            <div key={agent.agent_id} className="relative group flex flex-col h-full">
              {isDeleting && (
                <div className="absolute inset-0 bg-destructive/10 backdrop-blur-sm rounded-lg z-20 flex items-center justify-center">
                  <div className="bg-background/95 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2 shadow-lg border">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                    <span className="text-sm font-medium text-destructive">Deleting...</span>
                  </div>
                </div>
              )}

              <div className={`transition-all duration-200 ${isDeleting ? 'opacity-60 scale-95' : ''}`}>
                <UnifiedAgentCard
                  variant="agent"
                  data={{
                    id: agent.agent_id,
                    name: agent.name,
                    tags: agent.tags,
                    created_at: agent.created_at,
                    agent_id: agent.agent_id,
                    is_default: agent.is_default,
                    is_public: agent.is_public,
                    marketplace_published_at: agent.marketplace_published_at,
                    download_count: agent.download_count,
                    current_version: agent.current_version,
                    metadata: agent.metadata,
                    icon_name: agent.icon_name,
                    icon_color: agent.icon_color,
                    icon_background: agent.icon_background,
                  }}
                  actions={{
                    onClick: () => !isDeleting && handleAgentClick(agent),
                  }}
                />
              </div>
              <div className={`absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity ${isDeleting ? 'pointer-events-none' : ''}`}>
                {!agent.is_default && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                        disabled={isDeleting || isGloballyDeleting}
                        title="Delete agent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isDeleting ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl">Delete Worker</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete &quot;{agent.name}&quot;? This action cannot be undone.
                          {agent.is_public && (
                            <span className="block mt-2 text-amber-600 dark:text-amber-400">
                              Note: This agent is currently published to the marketplace and will be removed from there as well.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAgent(agent.agent_id);
                          }}
                          disabled={isDeleting || isGloballyDeleting}
                          className="bg-destructive hover:bg-destructive/90 text-white"
                        >
                          {isDeleting ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                              Deleting...
                            </>
                          ) : (
                            'Delete'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AgentModal
        agent={selectedAgent}
        isOpen={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onCustomize={handleCustomize}
        onChat={handleChat}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        isPublishing={externalPublishingId === selectedAgent?.agent_id}
        isUnpublishing={unpublishingId === selectedAgent?.agent_id}
      />

      {configAgentId && (
        <AgentConfigurationDialog
          open={showConfigDialog}
          onOpenChange={setShowConfigDialog}
          agentId={configAgentId}
          onAgentChange={(newAgentId) => {
            setConfigAgentId(newAgentId);
          }}
        />
      )}
    </>
  );
};