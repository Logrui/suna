import React from 'react';
import { Bot, Search, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  type?: 'agent' | 'team';
  hasItems: boolean;
  onCreate: () => void;
  onClearFilters: () => void;
}

export const EmptyState = ({ type = 'agent', hasItems, onCreate, onClearFilters }: EmptyStateProps) => {
  const isAgent = type === 'agent';
  const itemLabel = isAgent ? 'agent' : 'team';
  const itemsLabel = isAgent ? 'agents' : 'teams';

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex flex-col items-center text-center max-w-md space-y-6">
        <div className="rounded-full bg-muted p-6">
          {!hasItems ? (
            isAgent ? <Bot className="h-12 w-12 text-muted-foreground" /> : <Users className="h-12 w-12 text-muted-foreground" />
          ) : (
            <Search className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">
            {!hasItems ? `No ${itemsLabel} yet` : `No ${itemsLabel} found`}
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            {!hasItems ? (
              isAgent
                ? 'Create your first agent to start automating tasks with custom instructions and tools. Configure custom AgentPress capabilities to fine tune agent according to your needs.'
                : 'Create your first team to collaborate with multiple agents. Organize agents into squads for specialized tasks.'
            ) : (
              `No ${itemsLabel} match your current search and filter criteria. Try adjusting your filters or search terms.`
            )}
          </p>
        </div>
        {!hasItems ? (
          <Button
            size="lg"
            onClick={onCreate}
            className="mt-4"
          >
            <Plus className="h-5 w-5" />
            Create your first {itemLabel}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="mt-4"
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}