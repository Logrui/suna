import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Server, Store, Settings, Lock, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MCPConfigurationProps, MCPConfiguration as MCPConfigurationType } from './types';
import { ConfiguredMcpList } from './configured-mcp-list';
import { CustomMCPDialog } from './custom-mcp-dialog';
import { CustomMCPAuthConfirmation } from './custom-mcp-auth-confirmation';
import { ComposioRegistry } from '../composio/composio-registry';
import { ComposioToolsManager } from '../composio/composio-tools-manager';
import { CustomMCPToolsManager } from './custom-mcp-tools-manager';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAccountState } from '@/hooks/billing';
import { usePricingModalStore } from '@/stores/pricing-modal-store';
import { isLocalMode } from '@/lib/config';
import { backendApi } from '@/lib/api-client';

export const MCPConfigurationNew: React.FC<MCPConfigurationProps> = ({
  configuredMCPs,
  onConfigurationChange,
  agentId,
  versionData,
  saveMode = 'direct',
  versionId,
  isLoading = false
}) => {
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [showRegistryDialog, setShowRegistryDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showComposioToolsManager, setShowComposioToolsManager] = useState(false);
  const [showCustomToolsManager, setShowCustomToolsManager] = useState(false);
  const [selectedMCPForTools, setSelectedMCPForTools] = useState<MCPConfigurationType | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(agentId);
  const queryClient = useQueryClient();

  // Phase 7.2: Track which MCP index is currently going through OAuth
  const configuringMCPIndexRef = useRef<number | null>(null);
  // Phase 7.3: Auth confirmation dialog state
  const [showAuthConfirmation, setShowAuthConfirmation] = useState(false);
  const [pendingAuthMCP, setPendingAuthMCP] = useState<{ index: number; name: string; url: string } | null>(null);

  const [isRefreshingConnectors, setIsRefreshingConnectors] = useState(false);

  const { data: accountState } = useAccountState();
  const { openPricingModal } = usePricingModalStore();

  // Refresh the connectors list by invalidating agent data from the server
  const handleRefreshConnectors = useCallback(async () => {
    if (!agentId) return;
    setIsRefreshingConnectors(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['agents', 'detail', agentId] });
      toast.success('Integrations refreshed');
    } catch {
      toast.error('Failed to refresh integrations');
    } finally {
      // Small delay so the spinner is visible even on fast refreshes
      setTimeout(() => setIsRefreshingConnectors(false), 600);
    }
  }, [agentId, queryClient]);

  // ──────────────────────────────────────────────
  // Phase 7.2: Listen for postMessage from OAuth popup
  // When /mcp-success sends { type: 'mcp-oauth-success' },
  // we re-probe the server to discover tools and flip state.
  // ──────────────────────────────────────────────
  const handleOAuthSuccess = useCallback(async () => {
    const index = configuringMCPIndexRef.current;
    if (index === null || index < 0 || index >= configuredMCPs.length) {
      console.warn('[MCP OAuth] Received success but no MCP index tracked');
      // Even without a tracked index, invalidate agent data so a manual refresh isn't needed
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ['agents', 'detail', agentId] });
      }
      return;
    }

    const mcp = configuredMCPs[index];
    const url = mcp.config?.url;
    if (!url) return;

    toast.loading('OAuth complete — discovering tools...', { id: 'mcp-oauth-refresh' });

    try {
      const discoveryResponse = await backendApi.post('/mcp/discover-custom-tools', {
        type: mcp.customType || 'sse',
        config: mcp.config
      }, { showErrors: false });

      if (discoveryResponse.success && discoveryResponse.data?.success) {
        const discovery = discoveryResponse.data;
        const toolNames = discovery.tools?.map((t: any) => t.name) || [];
        const toolObjects = discovery.tools?.map((t: any) => ({ name: t.name, description: t.description })) || [];

        const updatedMCPs = [...configuredMCPs];
        updatedMCPs[index] = {
          ...updatedMCPs[index],
          config: {
            ...updatedMCPs[index].config,
            requires_config: false,
            oauth_metadata: discovery.oauth_metadata || undefined,
          },
          enabledTools: toolNames.length > 0 ? toolNames : updatedMCPs[index].enabledTools,
          // Cache full tool objects so Manage Tools modal works without live server calls
          tools: toolObjects,
        };
        onConfigurationChange(updatedMCPs);
        toast.success(`${mcp.name} connected! ${toolNames.length} tools ready.`, { id: 'mcp-oauth-refresh' });
      } else {
        // Discovery after OAuth may still fail if backend needs time
        // Mark as connected optimistically since OAuth itself succeeded
        const updatedMCPs = [...configuredMCPs];
        updatedMCPs[index] = {
          ...updatedMCPs[index],
          config: {
            ...updatedMCPs[index].config,
            requires_config: false,
          },
        };
        onConfigurationChange(updatedMCPs);
        toast.success(`${mcp.name} authenticated! Tools will be available shortly.`, { id: 'mcp-oauth-refresh' });
      }
    } catch (err) {
      console.error('[MCP OAuth] Post-OAuth re-probe failed:', err);
      // Still mark as connected — OAuth succeeded, tools may load later
      const updatedMCPs = [...configuredMCPs];
      updatedMCPs[index] = {
        ...updatedMCPs[index],
        config: {
          ...updatedMCPs[index].config,
          requires_config: false,
        },
      };
      onConfigurationChange(updatedMCPs);
      toast.success(`${mcp.name} authenticated successfully.`, { id: 'mcp-oauth-refresh' });
    } finally {
      configuringMCPIndexRef.current = null;
      // Invalidate agent queries so the parent form data reloads with fresh server state
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ['agents', 'detail', agentId] });
      }
    }
  }, [configuredMCPs, onConfigurationChange, agentId, queryClient]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Only accept messages from our own origin
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'mcp-oauth-success') {
        console.log('[MCP OAuth] Received success postMessage from popup');
        handleOAuthSuccess();
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleOAuthSuccess]);

  const isFreeTier = accountState && (
    accountState.subscription?.tier_key === 'free' ||
    accountState.tier?.name === 'free'
  ) && !isLocalMode();

  const handleAgentChange = (newAgentId: string | undefined) => {
    setSelectedAgentId(newAgentId);
  };

  const handleEditMCP = (index: number) => {
    const mcp = configuredMCPs[index];
    setEditingIndex(index);
    setShowCustomDialog(true);
  };

  const handleConfigureTools = (index: number) => {
    const mcp = configuredMCPs[index];
    setSelectedMCPForTools(mcp);
    if (mcp.customType === 'composio') {
      const profileId = mcp.selectedProfileId || mcp.config?.profile_id;
      if (profileId) {
        setShowComposioToolsManager(true);
      } else {
        console.warn('Composio MCP has no profile_id:', mcp);
        toast.error('Composio integration not fully configured');
      }
    } else {
      setShowCustomToolsManager(true);
    }
  };

  const handleRemoveMCP = (index: number) => {
    const newMCPs = configuredMCPs.filter((_, i) => i !== index);
    onConfigurationChange(newMCPs);
  };

  const handleConfigureMCP = async (index: number) => {
    const mcp = configuredMCPs[index];
    if (mcp.isCustom && mcp.customType !== 'composio') {
      try {
        const url = mcp.config?.url;
        if (!url) {
          toast.error('MCP server URL is missing');
          return;
        }

        // 1. Proactive discovery — does the server even need auth?
        toast.loading('Probing MCP server identity...', { id: 'mcp-configure' });

        const discoveryResponse = await backendApi.post('/mcp/discover-custom-tools', {
          type: mcp.customType || 'sse',
          config: mcp.config
        }, { showErrors: false });

        if (discoveryResponse.success && discoveryResponse.data?.success) {
          const discovery = discoveryResponse.data;

          if (discovery && !discovery.requires_auth) {
            // Server is connected and doesn't need auth!
            toast.success(`Connected to ${mcp.name} successfully!`, { id: 'mcp-configure' });

            const updatedMCPs = [...configuredMCPs];
            updatedMCPs[index] = {
              ...updatedMCPs[index],
              config: {
                ...updatedMCPs[index].config,
                requires_config: false,
                oauth_metadata: discovery.oauth_metadata || undefined,
              },
              enabledTools: discovery.tools?.map((t: any) => t.name) || []
            };
            onConfigurationChange(updatedMCPs);
            return;
          }
        }

        // 2. Auth required — show confirmation dialog (Phase 7.3)
        toast.dismiss('mcp-configure');
        setPendingAuthMCP({ index, name: mcp.name, url });
        setShowAuthConfirmation(true);

      } catch (error: any) {
        console.error('OAuth initiation failed:', error);
        toast.error('Failed to initiate OAuth flow');
        toast.dismiss('mcp-configure');
      }
    } else {
      handleEditMCP(index);
    }
  };

  // Phase 7.3: Called when user confirms the auth dialog
  const handleAuthConfirmed = async () => {
    setShowAuthConfirmation(false);
    if (!pendingAuthMCP) return;

    const { index, name, url } = pendingAuthMCP;
    setPendingAuthMCP(null);

    // Track which index is being OAuth'd so the postMessage handler knows
    configuringMCPIndexRef.current = index;

    try {
      const returnUrl = window.location.origin + '/mcp-success';
      const params = new URLSearchParams({
        url,
        return_url: returnUrl,
        agent_id: agentId || '',
        name,
      });

      const response = await backendApi.get<{ redirect_url: string }>(`/mcp/auth/start?${params.toString()}`);

      if (response.success && response.data?.redirect_url) {
        window.open(response.data.redirect_url, '_blank', 'width=600,height=700,resizable=yes,scrollbars=yes');
      } else {
        toast.error('Failed to initiate OAuth flow');
        configuringMCPIndexRef.current = null;
      }
    } catch (error: any) {
      console.error('OAuth initiation failed:', error);
      toast.error('Failed to initiate OAuth flow');
      configuringMCPIndexRef.current = null;
    }
  };

  const handleSaveCustomMCP = (customConfig: any) => {
    // If we're editing, update the existing entry
    if (editingIndex !== null) {
      const updatedMCPs = [...configuredMCPs];
      updatedMCPs[editingIndex] = {
        ...updatedMCPs[editingIndex],
        name: customConfig.name,
        config: customConfig.config,
        customType: customConfig.type as 'http' | 'sse',
        // Persist detected transport from discovery (sse, streamable-http)
        ...(customConfig.detectedTransport ? { detectedTransport: customConfig.detectedTransport } : {}),
      };
      onConfigurationChange(updatedMCPs);
      setEditingIndex(null);
      return;
    }

    // Use backend-provided qualifiedName when available; fallback to deterministic name-based format
    const fallbackQualifiedName = `custom_mcp_${customConfig.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)}`;
    const mcpConfig: MCPConfigurationType = {
      name: customConfig.name,
      qualifiedName: customConfig.qualifiedName || fallbackQualifiedName,
      config: customConfig.config,
      enabledTools: customConfig.enabledTools || [],
      selectedProfileId: customConfig.selectedProfileId,
      isCustom: true,
      customType: customConfig.type as 'http' | 'sse',
      // Persist detected transport from discovery (sse, streamable-http)
      // so runtime can dispatch directly without fallback overhead
      ...(customConfig.detectedTransport ? { detectedTransport: customConfig.detectedTransport } : {}),
    };
    onConfigurationChange([...configuredMCPs, mcpConfig]);
  };

  const handleToolsSelected = (profileId: string, selectedTools: string[], appName: string, appSlug: string) => {
    setShowRegistryDialog(false);
    if (selectedAgentId) {
      queryClient.invalidateQueries({ queryKey: ['agents', 'detail', selectedAgentId] });
    }
    queryClient.invalidateQueries({ queryKey: ['composio', 'profiles'] });
    toast.success(`Connected ${appName} integration!`);
  };

  const handleCustomToolsUpdate = (enabledTools: string[]) => {
    if (!selectedMCPForTools) return;

    const updatedMCPs = configuredMCPs.map(mcp =>
      mcp === selectedMCPForTools
        ? { ...mcp, enabledTools }
        : mcp
    );
    onConfigurationChange(updatedMCPs);
    setShowCustomToolsManager(false);
    setSelectedMCPForTools(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            onClick={() => setShowRegistryDialog(true)}
            size="sm"
            variant={isFreeTier ? "outline" : "default"}
            className={isFreeTier ? "gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground" : "gap-2"}
            type="button"
          >
            {isFreeTier ? <Lock className="h-4 w-4" /> : <Store className="h-4 w-4" />}
            Browse Apps
          </Button>
          <Button onClick={() => {
            setEditingIndex(null);
            setShowCustomDialog(true);
          }} size="sm" variant="outline" className="gap-2" type="button">
            <Server className="h-4 w-4" />
            Custom MCP
          </Button>
        </div>
        {configuredMCPs.length > 0 && (
          <Button
            onClick={handleRefreshConnectors}
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground hover:text-primary"
            disabled={isRefreshingConnectors}
            type="button"
            title="Refresh integration status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingConnectors ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      {configuredMCPs.length === 0 && (
        <div className="text-center py-12 px-6 ">
          <div className="mx-auto w-12 h-12">
            <Server className="h-6 w-6 text-muted-foreground" />
          </div>
          <h4 className="text-sm font-semibold text-foreground mb-2">
            No integrations configured
          </h4>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Browse the app registry to connect your apps or add custom MCP servers
          </p>
        </div>
      )}

      {configuredMCPs.length > 0 && (
        <div className="space-y-4">
          <ConfiguredMcpList
            configuredMCPs={configuredMCPs}
            onEdit={handleEditMCP}
            onRemove={handleRemoveMCP}
            onConfigure={handleConfigureMCP}
            onConfigureTools={handleConfigureTools}
            agentId={agentId}
          />
        </div>
      )}

      <Dialog open={showRegistryDialog} onOpenChange={setShowRegistryDialog}>
        <DialogContent className="p-0 max-w-6xl h-[90vh] overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Select Integration</DialogTitle>
          </DialogHeader>
          <ComposioRegistry
            showAgentSelector={false}
            selectedAgentId={selectedAgentId}
            onAgentChange={handleAgentChange}
            onToolsSelected={handleToolsSelected}
            onClose={() => {
              setShowRegistryDialog(false);
              if (selectedAgentId) {
                queryClient.invalidateQueries({ queryKey: ['agents', 'detail', selectedAgentId] });
              }
            }}
            isBlocked={isFreeTier}
            onBlockedClick={() => openPricingModal()}
          />
        </DialogContent>
      </Dialog>
      <CustomMCPDialog
        open={showCustomDialog}
        onOpenChange={setShowCustomDialog}
        onSave={handleSaveCustomMCP}
        agentId={agentId}
        initialData={editingIndex !== null ? configuredMCPs[editingIndex] : undefined}
        identifier={editingIndex !== null ? editingIndex.toString() : undefined}
      />
      {selectedMCPForTools && selectedMCPForTools.customType === 'composio' && (selectedMCPForTools.selectedProfileId || selectedMCPForTools.config?.profile_id) && (
        <ComposioToolsManager
          agentId={selectedAgentId || ''}
          open={showComposioToolsManager}
          onOpenChange={setShowComposioToolsManager}
          profileId={selectedMCPForTools.selectedProfileId || selectedMCPForTools.config?.profile_id}
          onToolsUpdate={() => {
            setShowComposioToolsManager(false);
            setSelectedMCPForTools(null);
          }}
        />
      )}
      {selectedMCPForTools && selectedMCPForTools.customType !== 'composio' && agentId && (
        <CustomMCPToolsManager
          agentId={agentId}
          mcpConfig={selectedMCPForTools}
          mcpName={selectedMCPForTools.name}
          open={showCustomToolsManager}
          onOpenChange={setShowCustomToolsManager}
          onToolsUpdate={handleCustomToolsUpdate}
        />
      )}

      {/* Phase 7.3: OAuth Confirmation Dialog */}
      <CustomMCPAuthConfirmation
        open={showAuthConfirmation}
        onOpenChange={setShowAuthConfirmation}
        onConfirm={handleAuthConfirmed}
        serverName={pendingAuthMCP?.name || ''}
        serverUrl={pendingAuthMCP?.url || ''}
      />
    </div>
  );
};