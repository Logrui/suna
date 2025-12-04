'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    icon_name?: string;
    icon_color?: string;
    icon_background?: string;
    metadata?: {
        is_suna_default?: boolean;
    };
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
    isDeleting?: boolean;
}

export interface UnifiedTeamCardProps {
    data: BaseTeamData;
    actions?: TeamCardActions;
    state?: TeamCardState;
    className?: string;
    variant?: TeamCardVariant;
    onClick?: (data: BaseTeamData) => void;
}

export const UnifiedTeamCard: React.FC<UnifiedTeamCardProps> = ({
    data,
    actions = {},
    state = {},
    className,
    variant = 'grid',
    onClick
}) => {
    const { onEdit, onDelete, onClick: actionOnClick } = actions;
    const { isSelected = false, isDeleting = false } = state;

    const handleCardClick = () => {
        if (onClick) {
            onClick(data);
        } else if (actionOnClick) {
            actionOnClick(data);
        }
    };

    const renderGridCard = () => {
        return (
            <Card
                className={cn(
                    'group relative bg-card rounded-2xl overflow-hidden transition-all duration-300 border cursor-pointer flex flex-col border-border/50 hover:border-primary/20 h-full',
                    className
                )}
                onClick={handleCardClick}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <CardContent className="relative p-6 flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-shrink-0">
                            <AgentAvatar
                                agentName={data.name}
                                iconName={data.icon_name ?? 'users'}
                                iconColor={data.icon_color}
                                backgroundColor={data.icon_background}
                                isSunaDefault={true}
                                size={48}
                                className="border"
                            />
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
                                            isSunaDefault={true}
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

                    </div>
                </CardContent>
            </Card>
        );
    };

    return renderGridCard();
};
