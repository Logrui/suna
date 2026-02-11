import React, { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Search, Zap, X, Settings, ChevronDown, ChevronUp, Loader2, Server, Lock } from 'lucide-react';
import { useComposioCategories, useComposioToolkitsInfinite } from '@/hooks/composio/use-composio';
import { useComposioProfiles } from '@/hooks/composio/use-composio-profiles';
import { useAgent } from '@/hooks/agents/use-agents';
import { useUpdateAgentMCPs } from '@/hooks/agents/use-update-agent-mcps';
import { ComposioConnector } from './composio-connector';
import { ComposioToolsManager } from './composio-tools-manager';
import type { ComposioToolkit, ComposioProfile } from '@/hooks/composio/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CustomMCPDialog } from '../mcp/custom-mcp-dialog';

const CATEGORY_EMOJIS: Record<string, string> = {
  'popular': '🔥',
  'productivity': '📊',
  'crm': '👥',
  'marketing': '📢',
  'analytics': '📈',
  'communication': '💬',
  'project-management': '📋',
  'scheduling': '📅',
};

interface ConnectedApp {
  toolkit: ComposioToolkit;
  profile: ComposioProfile;
  mcpConfig: {
    name: string;
    type: string;
    config: Record<string, any>;
    enabledTools: string[];
  };
}

interface ComposioRegistryProps {
  onToolsSelected?: (profileId: string, selectedTools: string[], appName: string, appSlug: string, appIconUrl?: string) => void;
  onAppSelected?: (app: ComposioToolkit) => void;
  mode?: 'full' | 'profile-only';
  onClose?: () => void;
  showAgentSelector?: boolean;
  selectedAgentId?: string;
  onAgentChange?: (agentId: string | undefined) => void;
  initialSelectedApp?: string | null;
  isBlocked?: boolean;
  onBlockedClick?: () => void;
}

const getAgentConnectedApps = (
  agent: any,
  profiles: ComposioProfile[],
  toolkits: ComposioToolkit[]
): ConnectedApp[] => {
  if (!agent?.custom_mcps || !profiles?.length || !toolkits?.length) return [];

  const connectedApps: ConnectedApp[] = [];

  agent.custom_mcps.forEach((mcpConfig: any) => {
    if (mcpConfig.config?.profile_id) {
      const profile = profiles.find(p => p.profile_id === mcpConfig.config.profile_id);
      const toolkit = toolkits.find(t => t.slug === profile?.toolkit_slug);
      if (profile && toolkit) {
        connectedApps.push({
          toolkit,
          profile,
          mcpConfig
        });
      }
    }
  });

  return connectedApps;
};

const isAppConnectedToAgent = (
  agent: any,
  appSlug: string,
  profiles: ComposioProfile[]
): boolean => {
  if (!agent?.custom_mcps) return false;

  return agent.custom_mcps.some((mcpConfig: any) => {
    if (mcpConfig.config?.profile_id) {
      const profile = profiles.find(p => p.profile_id === mcpConfig.config.profile_id);
      return profile?.toolkit_slug === appSlug;
    }
    return false;
  });
};

const AppCardSkeleton = () => (
  <div className="border border-border/50 rounded-xl p-4">
    <div className="flex items-center gap-3 mb-3">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="flex-1">
        <Skeleton className="w-3/4 h-4 mb-2" />
        <Skeleton className="w-full h-3" />
      </div>
    </div>
    <div className="flex flex-wrap gap-1 mb-3">
      <Skeleton className="w-16 h-5" />
      <Skeleton className="w-20 h-5" />
    </div>
    <div className="flex justify-between items-center">
      <Skeleton className="w-24 h-6" />
      <Skeleton className="w-20 h-8" />
    </div>
  </div>
);

const ConnectedAppSkeleton = () => (
  <div className="border border-border/50 rounded-2xl p-4">
    <div className="flex items-start gap-3 mb-3">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="flex-1">
        <Skeleton className="w-3/4 h-4 mb-2" />
        <Skeleton className="w-full h-3" />
      </div>
      <Skeleton className="w-8 h-8 rounded" />
    </div>
    <div className="flex justify-between items-center">
      <Skeleton className="w-32 h-4" />
    </div>
  </div>
);

const ConnectedAppCard = ({
  connectedApp,
  onToggleTools,
  onConfigure,
  onManageTools,
  isUpdating
}: {
  connectedApp: ConnectedApp;
  onToggleTools: (profileId: string, enabled: boolean) => void;
  onConfigure: (app: ComposioToolkit, profile: ComposioProfile) => void;
  onManageTools: (connectedApp: ConnectedApp) => void;
  isUpdating: boolean;
}) => {
  const { toolkit, profile, mcpConfig } = connectedApp;
  const hasEnabledTools = mcpConfig.enabledTools && mcpConfig.enabledTools.length > 0;

  return (
    <div
      className="group border bg-card rounded-2xl p-4 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start gap-3 mb-3">
        {toolkit.logo ? (
          <img src={toolkit.logo} alt={toolkit.name} className="w-10 h-10 rounded-xl object-cover p-2 bg-muted border" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-sm font-medium">{toolkit.name.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-tight truncate mb-1">{toolkit.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            Connected as "{profile.profile_name}"
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onManageTools(connectedApp)}
            disabled={isUpdating}
            type="button"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {hasEnabledTools ? `${mcpConfig.enabledTools.length} tools enabled` : 'Connected (no tools)'}
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomMCPCard = ({
  mcpConfig,
  onRemove
}: {
  mcpConfig: any;
  onRemove: (mcpName: string) => void;
}) => {
  const hasTools = mcpConfig.enabledTools && mcpConfig.enabledTools.length > 0;

  return (
    <div className="group border bg-card rounded-2xl p-4 transition-all duration-200 hover:border-sidebar-primary/50">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
          <Server className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-tight truncate mb-1">{mcpConfig.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-mono">
            {mcpConfig.config?.url || 'Custom Configuration'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Future: Edit/Delete buttons */}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {hasTools ? `${mcpConfig.enabledTools.length} tools active` : 'Connected'}
          </div>
        </div>
      </div>
    </div>
  );
};

// ... existing components ...

export const ComposioRegistry: React.FC<ComposioRegistryProps> = ({
  onToolsSelected,
  onAppSelected,
  mode = 'full',
  onClose,
  showAgentSelector = false,
  selectedAgentId,
  onAgentChange,
  initialSelectedApp,
  isBlocked = false,
  onBlockedClick,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedApp, setSelectedApp] = useState<ComposioToolkit | null>(null);
  const [showConnector, setShowConnector] = useState(false);
  const [showConnectedApps, setShowConnectedApps] = useState(true);
  const [showCustomMCPs, setShowCustomMCPs] = useState(true);
  const [showToolsManager, setShowToolsManager] = useState(false);
  const [selectedConnectedApp, setSelectedConnectedApp] = useState<ConnectedApp | null>(null);
  const [showCustomMCPDialog, setShowCustomMCPDialog] = useState(false);

  // ... (existing state and hooks) ...

  const [internalSelectedAgentId, setInternalSelectedAgentId] = useState<string | undefined>(selectedAgentId);
  const queryClient = useQueryClient();

  const { data: categoriesData, isLoading: isLoadingCategories } = useComposioCategories();
  const {
    data: toolkitsInfiniteData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError
  } = useComposioToolkitsInfinite(search, selectedCategory);
  const { data: profiles, isLoading: isLoadingProfiles } = useComposioProfiles();

  const allToolkits = useMemo(() => {
    if (!toolkitsInfiniteData?.pages) return [];
    return toolkitsInfiniteData.pages.flatMap(page => page.toolkits || []);
  }, [toolkitsInfiniteData]);

  const currentAgentId = selectedAgentId ?? internalSelectedAgentId;
  const { data: agent, isLoading: isLoadingAgent } = useAgent(currentAgentId || '');
  const { mutate: updateAgent, isPending: isUpdatingAgent } = useUpdateAgentMCPs();

  const handleAgentSelect = (agentId: string | undefined) => {
    if (onAgentChange) {
      onAgentChange(agentId);
    } else {
      setInternalSelectedAgentId(agentId);
    }
  };

  const profilesByToolkit = useMemo(() => {
    const grouped: Record<string, ComposioProfile[]> = {};
    profiles?.forEach(profile => {
      if (profile.is_connected) {
        if (!grouped[profile.toolkit_slug]) {
          grouped[profile.toolkit_slug] = [];
        }
        grouped[profile.toolkit_slug].push(profile);
      }
    });
    return grouped;
  }, [profiles]);

  const connectedApps = useMemo(() => {
    if (!currentAgentId || !agent) return [];
    return getAgentConnectedApps(agent, profiles || [], allToolkits);
  }, [agent, profiles, allToolkits, currentAgentId]);

  const customMCPs = useMemo(() => {
    if (!currentAgentId || !agent?.custom_mcps) return [];
    // Filter for MCPs that do NOT have a profile_id (meaning they are generic/custom)
    return agent.custom_mcps.filter((mcp: any) => !mcp.config?.profile_id);
  }, [agent, currentAgentId]);

  const isLoadingConnectedApps = currentAgentId && (isLoadingAgent || isLoadingProfiles || isLoading);

  const filteredToolkits = useMemo(() => {
    if (!allToolkits) return [];
    return allToolkits;
  }, [allToolkits]);

  // Handle initial app selection
  useEffect(() => {
    if (initialSelectedApp && allToolkits.length > 0 && !selectedApp) {
      const appToSelect = allToolkits.find(
        toolkit => toolkit.slug?.toLowerCase() === initialSelectedApp.toLowerCase()
      );
      if (appToSelect) {
        setSelectedApp(appToSelect);
        setShowConnector(true);
        setShowConnectedApps(false);
      }
    }
  }, [initialSelectedApp, allToolkits, selectedApp]);

  // ... (handleConnect, handleConfigure, handleToggleTools, handleManageTools, handleConnectionComplete, handleCustomMCPSave implementations remain the same) ...
  const handleConnect = (app: ComposioToolkit) => {
    if (mode !== 'profile-only' && !currentAgentId && showAgentSelector) {
      toast.error('Please select an agent first');
      return;
    }
    setSelectedApp(app);
    setShowConnector(true);
  };

  const handleConfigure = (app: ComposioToolkit, profile: ComposioProfile) => {
    if (mode !== 'profile-only' && !currentAgentId) {
      toast.error('Please select an agent first');
      return;
    }
    setSelectedApp(app);
    setShowConnector(true);
  };

  const handleToggleTools = (profileId: string, enabled: boolean) => {
    if (!currentAgentId || !agent) return;

    const updatedCustomMcps = agent.custom_mcps?.map((mcpConfig: any) => {
      if (mcpConfig.config?.profile_id === profileId) {
        return {
          ...mcpConfig,
          enabledTools: enabled ? mcpConfig.enabledTools || [] : []
        };
      }
      return mcpConfig;
    }) || [];

    updateAgent({
      agentId: currentAgentId,
      custom_mcps: updatedCustomMcps
    }, {
      onSuccess: () => {
        toast.success(enabled ? 'Tools enabled' : 'Tools disabled');
      },
      onError: (error: any) => {
        toast.error(error.message || 'Failed to update tools');
      }
    });
  };

  const handleManageTools = (connectedApp: ConnectedApp) => {
    setSelectedConnectedApp(connectedApp);
    setShowToolsManager(true);
  };

  const handleConnectionComplete = (profileId: string, appName: string, appSlug: string) => {
    setShowConnector(false);
    queryClient.invalidateQueries({ queryKey: ['composio', 'profiles'] });

    if (currentAgentId) {
      queryClient.invalidateQueries({ queryKey: ['agents', 'detail', currentAgentId] });
    }

    if (onToolsSelected) {
      onToolsSelected(profileId, [], appName, appSlug, selectedApp?.logo);
    }
  };

  const handleCustomMCPSave = async (customConfig: any): Promise<void> => {
    if (!currentAgentId) {
      throw new Error('Please select an agent first');
    }

    // Create MCP configuration for agent
    const mcpConfig = {
      name: customConfig.name || 'Custom MCP',
      type: customConfig.type || 'sse',
      config: customConfig.config || {},
      enabledTools: customConfig.enabledTools || [],
      oauth_client_id: customConfig.oauth_client_id,
      oauth_client_secret: customConfig.oauth_client_secret,
      custom_headers: customConfig.custom_headers
    };

    // Get current custom MCPs from agent
    const currentCustomMcps = agent?.custom_mcps || [];
    const updatedCustomMcps = [...currentCustomMcps, mcpConfig];

    // Return a promise that resolves/rejects based on the mutation result
    return new Promise((resolve, reject) => {
      updateAgent({
        agentId: currentAgentId,
        custom_mcps: updatedCustomMcps,
        replace_mcps: true  // Use replace mode to ensure proper updates
      }, {
        onSuccess: () => {
          toast.success(`Custom MCP "${customConfig.name}" added successfully`);
          queryClient.invalidateQueries({ queryKey: ['agents', 'detail', currentAgentId] });
          resolve();
        },
        onError: (error: any) => {
          reject(new Error(error.message || 'Failed to add custom MCP'));
        }
      });
    });
  };

  const categories = categoriesData?.categories || [];

  return (
    <div className="h-full w-full overflow-hidden flex">
      <div className="flex-1 h-full overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex-shrink-0 border-b p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-xl font-semibold">
                  {mode === 'profile-only' ? 'Connect New App' : 'Connectors'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {mode === 'profile-only'
                    ? 'Create a connection profile for your favorite apps'
                    : `Connect your favorite apps with ${currentAgentId ? 'this Worker' : 'your Worker'}`
                  }
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="flex items-center gap-3">
                  {/* Agent Selector Placeholder */}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search apps..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
                {mode !== 'profile-only' && currentAgentId && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCustomMCPDialog(true)}
                    className="flex items-center gap-2 whitespace-nowrap h-10"
                  >
                    <Server className="h-4 w-4" />
                    Add Custom MCP
                  </Button>
                )}
              </div>

              {selectedCategory && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Filtered by:</span>
                  <Badge variant="outline" className="gap-1 bg-muted-foreground/20 text-muted-foreground">
                    <span>{CATEGORY_EMOJIS[selectedCategory] || '📁'}</span>
                    <span>{categories.find(c => c.id === selectedCategory)?.name}</span>
                    <button
                      onClick={() => setSelectedCategory('')}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {currentAgentId && (
                  <div className="space-y-4">
                    {/* Connected Composio Apps */}
                    <Collapsible open={showConnectedApps} onOpenChange={setShowConnectedApps}>
                      <CollapsibleTrigger asChild>
                        <div className="w-full hover:underline flex items-center justify-between p-0 h-auto cursor-pointer">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-medium">Standard Connectors</h3>
                            {isLoadingConnectedApps ? (
                              <Skeleton className="w-6 h-5 rounded ml-2" />
                            ) : connectedApps.length > 0 && (
                              <Badge variant="outline" className="ml-2">
                                {connectedApps.length}
                              </Badge>
                            )}
                          </div>
                          {showConnectedApps ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4">
                        {isLoadingConnectedApps ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <ConnectedAppSkeleton key={i} />
                            ))}
                          </div>
                        ) : connectedApps.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground border border-dashed rounded-lg">
                            <h4 className="text-sm font-medium">No standard apps connected</h4>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4">
                            {connectedApps.map((connectedApp) => (
                              <ConnectedAppCard
                                key={connectedApp.profile.profile_id}
                                connectedApp={connectedApp}
                                onToggleTools={handleToggleTools}
                                onConfigure={handleConfigure}
                                onManageTools={handleManageTools}
                                isUpdating={isUpdatingAgent}
                              />
                            ))}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Custom MCP Servers */}
                    {customMCPs.length > 0 && (
                      <Collapsible open={showCustomMCPs} onOpenChange={setShowCustomMCPs}>
                        <CollapsibleTrigger asChild>
                          <div className="w-full hover:underline flex items-center justify-between p-0 h-auto cursor-pointer mt-6">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-medium">Custom MCP Servers</h3>
                              <Badge variant="outline" className="ml-2 bg-orange-500/10 text-orange-600 border-orange-500/20">
                                {customMCPs.length}
                              </Badge>
                            </div>
                            {showCustomMCPs ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {customMCPs.map((mcp: any, i: number) => (
                              <CustomMCPCard
                                key={i}
                                mcpConfig={mcp}
                                onRemove={() => { }}
                              />
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  <h3 className="text-lg font-medium mb-4">
                    {currentAgentId ? 'Available Apps' : 'Browse Apps'}
                  </h3>

                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <AppCardSkeleton key={i} />
                      ))}
                    </div>
                  ) : filteredToolkits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                        <Search className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No apps found</h3>
                      <p className="text-muted-foreground">
                        {search ? `No apps match "${search}"` : 'No apps available in this category'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredToolkits.map((app) => (
                          <AppCard
                            key={app.slug}
                            app={app}
                            profiles={profilesByToolkit[app.slug] || []}
                            onConnect={() => handleConnect(app)}
                            onConfigure={(profile) => handleConfigure(app, profile)}
                            isConnectedToAgent={isAppConnectedToAgent(agent, app.slug, profiles || [])}
                            currentAgentId={currentAgentId}
                            mode={mode}
                            isBlocked={isBlocked}
                            onBlockedClick={onBlockedClick}
                          />
                        ))}
                      </div>
                      {hasNextPage && (
                        <div className="flex justify-center pt-4">
                          <Button
                            variant="outline"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}

                          >
                            {isFetchingNextPage ? (
                              <>
                                <Loader2 className="animate-spin h-4 w-4 " />
                                Loading more...
                              </>
                            ) : (
                              'Load More Apps'
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
      {selectedApp && (
        <ComposioConnector
          app={selectedApp}
          agentId={currentAgentId}
          open={showConnector}
          onOpenChange={setShowConnector}
          onComplete={handleConnectionComplete}
          mode={mode}
        />
      )}

      {selectedConnectedApp && currentAgentId && (
        <ComposioToolsManager
          agentId={currentAgentId}
          open={showToolsManager}
          onOpenChange={setShowToolsManager}
          profileId={selectedConnectedApp.profile.profile_id}
          profileInfo={{
            profile_id: selectedConnectedApp.profile.profile_id,
            profile_name: selectedConnectedApp.profile.profile_name,
            toolkit_name: selectedConnectedApp.toolkit.name,
            toolkit_slug: selectedConnectedApp.toolkit.slug,
          }}
          appLogo={selectedConnectedApp.toolkit.logo}
          onToolsUpdate={(tools?: string[]) => {
            queryClient.invalidateQueries({ queryKey: ['agents', 'detail', currentAgentId] });

            if (onToolsSelected && tools && tools.length > 0 && selectedConnectedApp) {
              onToolsSelected(
                selectedConnectedApp.profile.profile_id,
                tools,
                selectedConnectedApp.toolkit.name,
                selectedConnectedApp.toolkit.slug,
                selectedConnectedApp.toolkit.logo
              );
            }
          }}
        />
      )}
      <CustomMCPDialog
        open={showCustomMCPDialog}
        onOpenChange={setShowCustomMCPDialog}
        onSave={handleCustomMCPSave}
      />
    </div>
  );
}; 