'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, MoreHorizontal, Trash2, ExternalLink, Search, Frown, ChevronRight, Settings, Wrench, MessageCircle, Shield, GlobeLock, Download, Pencil } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { useAgents, useDeleteAgent, useUpdateAgent } from '@/hooks/agents/use-agents';
import { useUnpublishTemplate } from '@/hooks/secure-mcp/use-secure-mcp';
import { cn } from '@/lib/utils';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { Button } from '@/components/ui/button';
import { AgentConfigurationDialog } from '@/components/agents/agent-configuration-dialog';
import { AgentModal } from '@/components/agents/agent-modal';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';
import { NewAgentDialog } from '@/components/agents/new-agent-dialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteConfirmationDialog } from "@/components/thread/DeleteConfirmationDialog";
import { toast } from "sonner";
import { useQueryClient } from '@tanstack/react-query';
import { agentKeys } from '@/hooks/agents/keys';
import { isStagingMode } from '@/lib/config';
import type { Agent } from '@/hooks/agents/utils';


// Component for individual agent item
const AgentItem: React.FC<{
    agent: Agent;
    isActive: boolean;
    isSunaDefault?: boolean;
    onAgentClick: (agent: Agent) => void;
    onCustomize: (agentId: string) => void;
    onRename: (agentId: string, newName: string) => Promise<void>;
    handleDeleteAgent: (agentId: string, agentName: string) => void;
}> = ({ agent, isActive, isSunaDefault, onAgentClick, onCustomize, onRename, handleDeleteAgent }) => {
    const [isHoveringCard, setIsHoveringCard] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(agent.name);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleSaveRename = async () => {
        if (newName.trim() === '' || newName === agent.name) {
            setIsEditing(false);
            setNewName(agent.name);
            return;
        }

        try {
            setIsUpdating(true);
            await onRename(agent.agent_id, newName);
            setIsEditing(false);
        } catch (error) {
            setNewName(agent.name);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveRename();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setNewName(agent.name);
        }
    };

    return (
        <SpotlightCard
            className={cn(
                "transition-colors cursor-pointer",
                isActive ? "bg-muted" : "bg-transparent"
            )}
        >
            <div
                className="flex items-center gap-3 p-2.5 text-sm"
                onClick={() => onAgentClick(agent)}
                onMouseEnter={() => setIsHoveringCard(true)}
                onMouseLeave={() => setIsHoveringCard(false)}
            >
                <div className="flex-shrink-0">
                    <AgentAvatar
                        agent={agent}
                        agentId={agent.agent_id}
                        size={32}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <input
                            autoFocus
                            className="w-full bg-background border border-primary/50 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={handleSaveRename}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isUpdating}
                        />
                    ) : (
                        <>
                            <div className="text-sm font-medium truncate">{agent.name}</div>
                            {isSunaDefault && (
                                <div className="text-xs text-muted-foreground truncate">Default agent</div>
                            )}
                        </>
                    )}
                </div>
                <div className="flex-shrink-0 relative">
                    <ChevronRight
                        className={cn(
                            "h-4 w-4 text-muted-foreground transition-opacity",
                            isHoveringCard ? "opacity-0" : "opacity-100"
                        )}
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "absolute top-1/2 right-0 -translate-y-1/2 p-1 rounded-2xl hover:bg-accent transition-all text-muted-foreground",
                                    isHoveringCard ? "opacity-100" : "opacity-0 pointer-events-none"
                                )}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            >
                                <MoreHorizontal className="h-4 w-4 rotate-90" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onCustomize(agent.agent_id);
                                }}
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                Customize Worker
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(`/agents/config/${agent.agent_id}`, '_blank');
                                }}
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open in new tab
                            </DropdownMenuItem>
                            {!isSunaDefault && (
                                <>
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsEditing(true);
                                        }}
                                    >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDeleteAgent(agent.agent_id, agent.name);
                                        }}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                                        <span className="text-destructive">Delete</span>
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </SpotlightCard>
    );
};

export function NavAgentsView() {
    const { isMobile, state, setOpenMobile } = useSidebar();
    const router = useRouter();
    const pathname = usePathname();
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState('');
    const [showNewAgentDialog, setShowNewAgentDialog] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string } | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [unpublishingId, setUnpublishingId] = useState<string | null>(null);
    const [showConfigDialog, setShowConfigDialog] = useState(false);
    const [configAgentId, setConfigAgentId] = useState<string | null>(null);

    const {
        data: agentsResponse,
        isLoading: isAgentsLoading,
    } = useAgents({
        limit: 50,
        sort_by: 'updated_at',
        sort_order: 'desc'
    });

    const { mutate: deleteAgentMutation, isPending: isDeleting } = useDeleteAgent();
    const { mutateAsync: updateAgentMutation } = useUpdateAgent();

    const handleRename = async (agentId: string, newName: string) => {
        try {
            await updateAgentMutation({ agentId, name: newName });
            toast.success('Worker renamed successfully');
        } catch (error) {
            toast.error('Failed to rename worker');
            throw error;
        }
    };

    const unpublishMutation = useUnpublishTemplate();

    // Wrap agents in useMemo to prevent unnecessary re-renders
    const agents = useMemo(() => {
        return agentsResponse?.agents || [];
    }, [agentsResponse?.agents]);

    // Filter agents by search query
    const filteredAgents = useMemo(() => {
        if (!searchQuery.trim()) return agents;
        const query = searchQuery.toLowerCase();
        return agents.filter((agent: Agent) =>
            agent.name?.toLowerCase().includes(query)
        );
    }, [agents, searchQuery]);

    // Separate Suna default agent from custom agents
    const sunaAgent = useMemo(() => {
        return agents.find((a: Agent) => a.metadata?.is_suna_default === true);
    }, [agents]);

    const customAgents = useMemo(() => {
        return filteredAgents.filter((a: Agent) => a.metadata?.is_suna_default !== true);
    }, [filteredAgents]);

    const handleAgentClick = (agent: Agent) => {
        router.push(`/dashboard?agent_id=${agent.agent_id}`);
        if (isMobile) setOpenMobile(false);
    };

    const handleCustomize = (agentId: string) => {
        setConfigAgentId(agentId);
        setShowConfigDialog(true);
    };

    const handleChat = (agentId: string) => {
        router.push(`/dashboard?agent_id=${agentId}`);
        setSelectedAgent(null);
        if (isMobile) setOpenMobile(false);
    };

    const handleCloseModal = () => {
        setSelectedAgent(null);
    };

    const handlePublish = (agent: Agent) => {
        // Navigate to agents page with publish intent
        router.push(`/agents?tab=my-agents&agent=${agent.agent_id}`);
        if (isMobile) {
            setOpenMobile(false);
        }
        setSelectedAgent(null);
    };

    const handleUnpublish = async (agentId: string) => {
        try {
            setUnpublishingId(agentId);
            await unpublishMutation.mutateAsync(agentId);
            toast.success('Worker made private');
            setSelectedAgent(null);
        } catch {
            toast.error('Failed to make Worker private');
        } finally {
            setUnpublishingId(null);
        }
    };

    const handleDeleteAgent = (agentId: string, agentName: string) => {
        setAgentToDelete({ id: agentId, name: agentName });
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!agentToDelete) return;

        setIsDeleteDialogOpen(false);

        const agentId = agentToDelete.id;
        const isActive = pathname?.includes(agentId);

        deleteAgentMutation(agentId, {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
                toast.success('Worker deleted successfully');

                if (isActive) {
                    router.push('/agents');
                }
            },
            onSettled: () => {
                setAgentToDelete(null);
            }
        });
    };

    return (
        <div className="w-full flex flex-col h-full pt-4">
            {/* Search bar */}
            <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                    type="text"
                    placeholder="Search workers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl text-sm bg-muted/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
            </div>

            <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pb-32">
                {(state !== 'collapsed' || isMobile) && (
                    <>
                        {isAgentsLoading ? (
                            <div className="space-y-1">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <div key={`skeleton-${index}`} className="flex items-center gap-3 px-2 py-2">
                                        <div className="h-8 w-8 bg-muted/10 border-[1.5px] border-border rounded-2xl animate-pulse"></div>
                                        <div className="h-4 bg-muted rounded flex-1 animate-pulse"></div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredAgents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="w-12 h-12 bg-muted/50 rounded-2xl flex items-center justify-center mb-3">
                                    <Frown className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {searchQuery ? 'No workers found' : 'No workers yet'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Suna Default Agent */}
                                {sunaAgent && !searchQuery && (
                                    <AgentItem
                                        agent={sunaAgent}
                                        isActive={pathname?.includes(sunaAgent.agent_id) || false}
                                        isSunaDefault={true}
                                        onAgentClick={handleAgentClick}
                                        onCustomize={handleCustomize}
                                        onRename={handleRename}
                                        handleDeleteAgent={handleDeleteAgent}
                                    />
                                )}

                                {/* My Workers */}
                                {customAgents.length > 0 && (
                                    <div className="pt-2 space-y-1.5">
                                        {!searchQuery && (
                                            <div className="text-xs font-medium text-muted-foreground px-2.5 pb-2">
                                                My Workers
                                            </div>
                                        )}
                                        {customAgents.map((agent: Agent) => {
                                            const isActive = pathname?.includes(agent.agent_id) || false;
                                            return (
                                                <AgentItem
                                                    key={agent.agent_id}
                                                    agent={agent}
                                                    isActive={isActive}
                                                    onAgentClick={handleAgentClick}
                                                    onCustomize={handleCustomize}
                                                    onRename={handleRename}
                                                    handleDeleteAgent={handleDeleteAgent}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full shadow-none justify-center items-center h-10 px-4 bg-background mt-3"
                            onClick={() => setShowNewAgentDialog(true)}
                        >
                            <div className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                Add Workers
                            </div>
                        </Button>
                    </>
                )}
            </div>

            <NewAgentDialog
                open={showNewAgentDialog}
                onOpenChange={setShowNewAgentDialog}
                onSuccess={(agentId) => {
                    router.push(`/agents/config/${agentId}`);
                    if (isMobile) setOpenMobile(false);
                }}
            />

            {agentToDelete && (
                <DeleteConfirmationDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={() => setIsDeleteDialogOpen(false)}
                    onConfirm={confirmDelete}
                    threadName={agentToDelete.name}
                    isDeleting={isDeleting}
                />
            )}

            <AgentModal
                agent={selectedAgent}
                isOpen={!!selectedAgent}
                onClose={handleCloseModal}
                onCustomize={handleCustomize}
                onChat={handleChat}
                onPublish={(id) => handlePublish(selectedAgent!)}
                onUnpublish={handleUnpublish}
                isPublishing={false} // We don't track local publishing state here yet, but the modal accepts it
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
        </div>
    );
}