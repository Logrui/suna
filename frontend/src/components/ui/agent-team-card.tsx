'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Users, Settings, Trash2, Shield, Crown, ArrowRight, Bot, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';

// Unified team card variants
export type TeamCardVariant =
    | 'grid'      // Standard grid view
    | 'list'      // List view
    | 'compact';  // Compact version

// Agent interface for the team
export interface TeamAgent {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
    icon_name?: string;
    icon_color?: string;
    icon_background?: string;
}

// Base team data interface
export interface BaseTeamData {
    id: string;
    name: string;
    description?: string;
    agents: TeamAgent[];
    is_public?: boolean;
    created_at?: string;
    tags?: string[];
}

// Action handlers
export interface TeamCardActions {
    onEdit?: (data: BaseTeamData, e?: React.MouseEvent) => void;
    onDelete?: (data: BaseTeamData, e?: React.MouseEvent) => void;
    onClick?: (data: BaseTeamData) => void;
}

// Card state
export interface TeamCardState {
    isSelected?: boolean;
    isActioning?: boolean;
    isDeleting?: boolean;
}

// Main props interface
export interface UnifiedTeamCardProps {
    variant?: TeamCardVariant;
    data: BaseTeamData;
    actions?: TeamCardActions;
    state?: TeamCardState;

    // Styling
    className?: string;
}

// Main unified team card component
export const UnifiedTeamCard: React.FC<UnifiedTeamCardProps> = ({
    variant = 'grid',
    data,
    actions = {},
    state = {},
    className,
}) => {
    const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

    const {
        onEdit,
        onDelete,
        onClick,
    } = actions;

    const {
        isActioning = false,
        isDeleting = false
    } = state;

    // Handle delete confirmation
    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = () => {
        setShowDeleteDialog(false);
        onDelete?.(data);
    };

    const renderGridCard = () => {
        return (
            <Card
                className={cn(
                    'group relative bg-card rounded-2xl overflow-hidden transition-all duration-300 border cursor-pointer flex flex-col border-border/50 hover:border-primary/20 h-full',
                    className
                )}
                onClick={() => onClick?.(data)}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <CardContent className="relative p-6 flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Users className="h-6 w-6" />
                        </div>
                        <div className="flex gap-2">
                            {data.is_public && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 border-0 dark:bg-green-950 dark:text-green-300">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Public
                                </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                                {data.agents.length} Agents
                            </Badge>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-1">
                            {data.name}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                            {data.description || "No description provided."}
                        </p>
                    </div>

                    {/* Agents Stack */}
                    <div className="mt-auto">
                        <div className="flex items-center mb-4 pl-2">
                            {data.agents.slice(0, 4).map((agent, index) => (
                                <div
                                    key={agent.id}
                                    className="relative -ml-2 hover:z-10 transition-all duration-200 hover:scale-110"
                                    title={`${agent.name} (${agent.role || 'Agent'})`}
                                >
                                    <div className="ring-2 ring-background rounded-full">
                                        <AgentAvatar
                                            agentName={agent.name}
                                            iconName={agent.icon_name}
                                            iconColor={agent.icon_color}
                                            backgroundColor={agent.icon_background}
                                            size={32}
                                            className="border-0"
                                        />
                                    </div>
                                </div>
                            ))}
                            {data.agents.length > 4 && (
                                <div className="relative -ml-2 z-0">
                                    <div className="h-8 w-8 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-xs font-medium text-muted-foreground">
                                        +{data.agents.length - 4}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-4 border-t border-border/50 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1">
                                {data.tags?.slice(0, 2).map(tag => (
                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 h-5">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>

                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {onEdit && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(data, e);
                                        }}
                                    >
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                )}

                                {onDelete && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={handleDeleteClick}
                                        disabled={isDeleting}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>

                {/* Delete confirmation dialog */}
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Team</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete "<strong>{data.name}</strong>"? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmDelete();
                                }}
                                className="bg-destructive hover:bg-destructive/90 text-white"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete Team'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </Card>
        );
    };

    return renderGridCard();
};
