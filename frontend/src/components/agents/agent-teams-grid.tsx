'use client';

import React from 'react';
import { UnifiedTeamCard, BaseTeamData } from '@/components/ui/agent-team-card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface TeamsGridProps {
    Teams: BaseTeamData[];
    onEditTeam: (teamId: string) => void;
    onDeleteTeam: (teamId: string) => void;
    onToggleDefault?: (teamId: string, currentDefault: boolean) => void;
    deleteTeamMutation?: any;
    isDeletingTeam?: (teamId: string) => boolean;
    onPublish?: (team: any) => void;
    publishingId?: string | null;
}

export const TeamsGrid: React.FC<TeamsGridProps> = ({
    Teams,
    onEditTeam,
    onDeleteTeam,
    isDeletingTeam,
}) => {
    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Create New Team Card */}
            {/* <div className="group relative h-full min-h-[300px] rounded-2xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center p-6">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
          <Plus className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Create New Team</h3>
        <p className="text-sm text-muted-foreground max-w-[200px]">
          Assemble a new team of agents to collaborate on tasks
        </p>
      </div> */}

            {Teams.map((team) => (
                <UnifiedTeamCard
                    key={team.id}
                    data={team}
                    actions={{
                        onEdit: () => onEditTeam(team.id),
                        onDelete: () => onDeleteTeam(team.id),
                        onClick: () => onEditTeam(team.id), // For now, click edits
                    }}
                    state={{
                        isDeleting: isDeletingTeam?.(team.id),
                    }}
                />
            ))}
        </div>
    );
};
