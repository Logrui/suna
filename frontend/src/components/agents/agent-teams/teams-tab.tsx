'use client';

import React, { useState, useMemo } from 'react';
import { Globe, Plus, Search, BarChart, PenTool, Lightbulb, Type, Server, Eye, GitBranch, Shield, Rocket } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SearchBar } from '../custom-agents-page/search-bar';
import { EmptyState } from '../empty-state';
import { TeamsGrid } from './agent-teams-grid';
import { LoadingState } from '../loading-state';
import { Pagination } from '../pagination';
import { UnifiedTeamCard } from '@/components/ui/agent-team-card';
import { toast } from 'sonner';

// Mock Data for Agent Teams
const MOCK_TEAMS = [
  {
    id: 'team-1',
    name: 'Suna Superworker',
    description: 'A dedicated Suna Superworker team for general long running tasks. Manus like coordination and organization loop cycle',
    agents: [
      { id: 'a1', name: 'Suna Planner', role: 'Planning', icon_name: 'Search', icon_color: '#fdfdfdff', icon_background: '#000000ff' },
      { id: 'a2', name: 'Suna Worker', role: 'Execution', icon_name: 'BarChart', icon_color: '#ffffffff', icon_background: '#000000ff' },
      { id: 'a3', name: 'Suna Verifier', role: 'Verification', icon_name: 'PenTool', icon_color: '#ffffffff', icon_background: '#000000ff' },
    ],
    created_at: '2025-12-03T10:00:00Z',
    is_public: true,
    is_default: true,
    tags: ['Native', 'Analysis'],
    slug: 'superworker'
  },
  {
    id: 'team-2',
    name: 'Wide Research',
    description: 'Collaborative agents for generating blog posts, social media content, and marketing copy.',
    agents: [
      { id: 'a4', name: 'IdeaGen', role: 'Idea Generation', icon_name: 'Lightbulb', icon_color: '#f59e0b', icon_background: '#fffbeb' },
      { id: 'a5', name: 'CopyMaster', role: 'Copywriting', icon_name: 'Type', icon_color: '#ec4899', icon_background: '#fdf2f8' },
    ],
    created_at: '2025-12-03T14:30:00Z',
    is_public: true,
    is_default: true,
    tags: ['Research', 'Analysis'],
    slug: 'wide-research'
  },
  {
    id: 'team-3',
    name: 'DevOps Assistants',
    description: 'Automated pipeline monitoring, log analysis, and deployment management.',
    agents: [
      { id: 'a6', name: 'KubeMaster', role: 'DevOps Engineer', icon_name: 'Server', icon_color: '#6366f1', icon_background: '#eef2ff' },
      { id: 'a7', name: 'LogWatch', role: 'Monitoring', icon_name: 'Eye', icon_color: '#ef4444', icon_background: '#fef2f2' },
      { id: 'a8', name: 'GitBot', role: 'Version Control', icon_name: 'GitBranch', icon_color: '#f97316', icon_background: '#fff7ed' },
      { id: 'a9', name: 'SecGuard', role: 'Security', icon_name: 'Shield', icon_color: '#14b8a6', icon_background: '#f0fdfa' },
      { id: 'a10', name: 'DeployBot', role: 'Release Manager', icon_name: 'Rocket', icon_color: '#8b5cf6', icon_background: '#f5f3ff' },
    ],
    created_at: '2025-12-03T09:15:00Z',
    is_public: true,
    is_default: true,
    tags: ['DevOps', 'Automation', 'Infrastructure'],
    slug: 'devops-assistants'
  }
];

type TeamFilter = 'all' | 'templates';

interface TeamsTabProps {
  TeamsSearchQuery: string;
  setTeamsSearchQuery: (value: string) => void;
  TeamsLoading: boolean;
  Teams: any[]; // We'll ignore this for now and use MOCK_TEAMS
  TeamsPagination: any;
  viewMode: 'grid' | 'list';
  onCreateTeam: () => void;
  onEditTeam: (TeamId: string) => void;
  onDeleteTeam: (TeamId: string) => void;
  onToggleDefault: (TeamId: string, currentDefault: boolean) => void;
  onClearFilters: () => void;
  deleteTeamMutation?: any;
  isDeletingTeam?: (TeamId: string) => boolean;
  setTeamsPage: (page: number) => void;
  TeamsPageSize: number;
  onTeamsPageSizeChange: (pageSize: number) => void;
  onTeamClick?: (team: any) => void;

  myTemplates: any[];
  templatesLoading: boolean;
  templatesError: any;
  templatesActioningId: string | null;
  templatesPagination?: {
    current_page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
  templatesPage: number;
  setTemplatesPage: (page: number) => void;
  templatesPageSize: number;
  onTemplatesPageSizeChange: (pageSize: number) => void;
}

export const TeamsTab = ({
  TeamsSearchQuery,
  setTeamsSearchQuery,
  TeamsLoading,
  Teams,
  TeamsPagination,
  viewMode,
  onCreateTeam,
  onEditTeam,
  onDeleteTeam,
  onToggleDefault,
  onClearFilters,
  deleteTeamMutation,
  isDeletingTeam,
  setTeamsPage,
  TeamsPageSize,
  onTeamsPageSizeChange,
  onTeamClick,

  myTemplates,
  templatesLoading,
  templatesError,
  templatesActioningId,
  templatesPagination,
  templatesPage,
  setTemplatesPage,
  templatesPageSize,
}: TeamsTabProps) => {
  const [TeamFilter, setTeamFilter] = useState<TeamFilter>('all');

  const filterOptions = [
    { value: 'all', label: 'All Teams' },
    { value: 'templates', label: 'Templates' },
  ];

  const filteredMockTeams = useMemo(() => {
    const query = TeamsSearchQuery.toLowerCase();
    return MOCK_TEAMS.filter(team =>
      team.name.toLowerCase().includes(query) ||
      team.description.toLowerCase().includes(query) ||
      team.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [TeamsSearchQuery]);

  const handleClearFilters = () => {
    setTeamFilter('all');
    onClearFilters();
  };

  const handleCreateTeam = () => {
    onCreateTeam();
  };

  const handleEditTeam = (id: string) => {
    toast.info(`Edit Team ${id} feature coming soon!`);
    onEditTeam(id);
  };

  const handleDeleteTeam = (id: string) => {
    toast.info(`Delete Team ${id} feature coming soon!`);
    onDeleteTeam(id);
  };

  const renderTemplates = () => {
    return (
      <>
        {templatesLoading ? (
          <LoadingState viewMode={viewMode} />
        ) : templatesError ? (
          <div className="text-center py-16">
            <p className="text-destructive">Failed to load templates</p>
          </div>
        ) : !myTemplates || myTemplates.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-3xl flex items-center justify-center mb-6">
              <Globe className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">No published templates yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Publish your Teams to the marketplace to share them with the community and track their usage.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Template rendering logic would go here if we had team templates */}
            <div className="col-span-full text-center py-8 text-muted-foreground">
              Team templates are coming soon.
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6 mt-8 flex flex-col min-h-full">
      < div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6" >
        <SearchBar
          placeholder="Search Teams..."
          value={TeamsSearchQuery}
          onChange={setTeamsSearchQuery}
        />
        <div className="flex items-center gap-3">
          <Select value={TeamFilter} onValueChange={(value: TeamFilter) => setTeamFilter(value)}>
            <SelectTrigger className="w-[180px] h-12 rounded-xl">
              <SelectValue placeholder="Filter Teams" />
            </SelectTrigger>
            <SelectContent className='rounded-xl'>
              {filterOptions.map((filter) => (
                <SelectItem key={filter.value} className='rounded-xl' value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreateTeam} className="h-12 rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        </div>
      </div >
      <div className="flex-1">
        {TeamFilter === 'templates' ? (
          renderTemplates()
        ) : (
          <>
            {TeamsLoading ? (
              <LoadingState viewMode={viewMode} />
            ) : filteredMockTeams.length === 0 ? (
              <EmptyState
                type="team"
                hasItems={MOCK_TEAMS.length > 0}
                onCreate={handleCreateTeam}
                onClearFilters={handleClearFilters}
              />
            ) : (
              <TeamsGrid
                Teams={filteredMockTeams}
                onEditTeam={handleEditTeam}
                onDeleteTeam={handleDeleteTeam}
                isDeletingTeam={isDeletingTeam}
                onTeamClick={onTeamClick}
              />
            )}
          </>
        )}
      </div>
    </div >
  );
};