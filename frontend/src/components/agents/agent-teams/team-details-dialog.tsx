'use client';

import React from 'react';
import { DynamicIcon } from 'lucide-react/dynamic';
import { Users, Calendar, Tag, MoreVertical, Edit, Trash2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface TeamAgent {
    id: string;
    name: string;
    role: string;
    icon_name?: string;
    icon_color?: string;
    icon_background?: string;
    avatar_url?: string;
}

interface TeamData {
    id: string;
    name: string;
    description: string;
    agents: TeamAgent[];
    created_at: string;
    structure: string;
    is_public: boolean;
    is_default: boolean;
    tags: string[];
    slug?: string;
    icon_name?: string;
    icon_color?: string;
    icon_background?: string;
}

interface TeamDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    team: TeamData | null;
    onEdit?: (teamId: string) => void;
    onDelete?: (teamId: string) => void;
}

export function TeamDetailsDialog({
    open,
    onOpenChange,
    team,
    onEdit,
    onDelete
}: TeamDetailsDialogProps) {
    if (!team) return null;

    const Icon = team.icon_name ? (props: any) => <DynamicIcon name={team.icon_name as any} {...props} /> : Users;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" hideCloseButton>
                <div className="p-6 pb-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div
                                className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm"
                                style={{
                                    backgroundColor: team.icon_background || '#F3F4F6',
                                    color: team.icon_color || '#000000'
                                }}
                            >
                                <Icon className="h-8 w-8" />
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl font-semibold leading-tight">
                                    {team.name}
                                </DialogTitle>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Created {formatDistanceToNow(new Date(team.created_at), { addSuffix: true })}</span>
                                    {team.is_default && (
                                        <>
                                            <span>•</span>
                                            <Badge variant="secondary" className="text-xs font-normal h-5">Default</Badge>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEdit?.(team.id)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Team
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onDelete?.(team.id)}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Team
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="mt-6">
                        <p className="text-muted-foreground leading-relaxed">
                            {team.description}
                        </p>
                    </div>

                    {team.tags && team.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {team.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="pl-2 gap-1 font-normal">
                                    <Tag className="h-3 w-3 text-muted-foreground" />
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

                <Separator />

                <div className="flex-1 overflow-hidden flex flex-col bg-muted/30">
                    <div className="px-6 py-3 border-b bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            Agents
                            <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1">
                                {team.agents.length}
                            </Badge>
                        </h3>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-6 grid gap-4 sm:grid-cols-2">
                            {team.agents.map((agent) => {
                                const AgentIcon = agent.icon_name ? (props: any) => <DynamicIcon name={agent.icon_name as any} {...props} /> : Users;

                                return (
                                    <div
                                        key={agent.id}
                                        className="flex items-center gap-3 p-3 rounded-xl border bg-background hover:border-primary/50 transition-colors group"
                                    >
                                        <div
                                            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border shadow-sm"
                                            style={{
                                                backgroundColor: agent.icon_background || '#F3F4F6',
                                                color: agent.icon_color || '#000000'
                                            }}
                                        >
                                            <AgentIcon className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium truncate">{agent.name}</div>
                                            <div className="text-xs text-muted-foreground truncate">{agent.role}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
