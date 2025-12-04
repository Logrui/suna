'use client';

import React from 'react';
import { UnifiedTeamCard, BaseTeamData } from './agent-team-card';

interface TeamsGridProps {
    Teams: BaseTeamData[];
    onEditTeam: (teamId: string) => void;
    onDeleteTeam: (teamId: string) => void;
    isDeletingTeam?: (teamId: string) => boolean;
    onTeamClick?: (team: BaseTeamData) => void;
}

export const TeamsGrid: React.FC<TeamsGridProps> = ({
    Teams,
    onEditTeam,
    onDeleteTeam,
    isDeletingTeam,
    onTeamClick
}) => {
    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Teams.map((team) => (
                <UnifiedTeamCard
                    key={team.id}
                    data={team}
                    actions={{
                        onEdit: () => onEditTeam(team.id),
                        onDelete: () => onDeleteTeam(team.id),
                        onClick: () => onTeamClick?.(team)
                    }}
                    state={{
                        isDeleting: isDeletingTeam?.(team.id)
                    }}
                    onClick={() => onTeamClick?.(team)}
                />
            ))}
        </div>
    );
};
