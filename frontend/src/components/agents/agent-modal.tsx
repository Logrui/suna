import React from 'react';
import { MessageCircle, Wrench, GlobeLock, Download, Shield, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AgentAvatar } from '../thread/content/agent-avatar';
import { isStagingMode } from '@/lib/config';
import type { Agent } from '@/hooks/agents/utils';

interface AgentModalProps {
    agent: Agent | null;
    isOpen: boolean;
    onClose: () => void;
    onCustomize: (agentId: string) => void;
    onChat: (agentId: string) => void;
    onPublish: (agentId: string) => void;
    onUnpublish: (agentId: string) => void;
    isPublishing: boolean;
    isUnpublishing: boolean;
}

export const AgentModal: React.FC<AgentModalProps> = ({
    agent,
    isOpen,
    onClose,
    onCustomize,
    onChat,
    onPublish,
    onUnpublish,
    isPublishing,
    isUnpublishing
}) => {
    if (!agent) return null;

    const isSunaAgent = agent.metadata?.is_suna_default || false;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-background/95 backdrop-blur-xl">
                <DialogTitle className="sr-only">Worker actions</DialogTitle>
                <div className="relative">
                    {/* Header background with texture/gradient */}
                    <div className="p-6 h-32 flex items-center justify-center relative bg-muted/30">
                        <div className="absolute inset-0 opacity-10 pointer-events-none"
                            style={{ backgroundImage: "url('/noise.png')", mixBlendMode: 'multiply' }} />
                        <AgentAvatar
                            agent={agent}
                            size={80}
                            className="z-10 shadow-2xl"
                        />
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                                    {agent.name}
                                </h2>
                                {!isSunaAgent && agent.current_version && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 uppercase tracking-wider font-bold">
                                        <GitBranch className="h-3 w-3 mr-1" />
                                        {agent.current_version.version_name}
                                    </Badge>
                                )}
                            </div>
                            {isSunaAgent && (
                                <p className="text-sm text-muted-foreground">Default system agent</p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => onCustomize(agent.agent_id)}
                                variant="outline"
                                className="flex-1 h-12 rounded-xl gap-2 hover:bg-muted/50 border-border/50"
                            >
                                <Wrench className="h-4 w-4" />
                                Customize
                            </Button>
                            <Button
                                onClick={() => onChat(agent.agent_id)}
                                className="flex-1 h-12 rounded-xl gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                            >
                                <MessageCircle className="h-4 w-4" />
                                Chat
                            </Button>
                        </div>

                        {!isSunaAgent && isStagingMode && (
                            <div className="pt-2">
                                {agent.is_public ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-1">
                                            <span className="flex items-center gap-1.5">
                                                <Shield className="h-3 w-3 text-primary" />
                                                Published as template
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Download className="h-3 w-3" />
                                                {agent.download_count || 0}
                                            </span>
                                        </div>
                                        <Button
                                            onClick={() => onUnpublish(agent.agent_id)}
                                            disabled={isUnpublishing}
                                            variant="ghost"
                                            className="w-full h-11 rounded-xl gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                                        >
                                            {isUnpublishing ? (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            ) : (
                                                <GlobeLock className="h-4 w-4" />
                                            )}
                                            Make Private
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        onClick={() => onPublish(agent.agent_id)}
                                        disabled={isPublishing}
                                        variant="outline"
                                        className="w-full h-11 rounded-xl gap-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-primary/5 transition-all"
                                    >
                                        {isPublishing ? (
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                        ) : (
                                            <Shield className="h-4 w-4" />
                                        )}
                                        Publish as Template
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
