import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backendApi } from '@/lib/api-client';
import { agentKeys } from './keys';

export interface CustomMCPTool {
  name: string;
  description?: string;
  enabled: boolean;
}

export interface CustomMCPToolsResponse {
  tools: CustomMCPTool[];
  has_mcp_config: boolean;
  from_cache?: boolean;
  refresh_error?: string;
}

export const useCustomMCPToolsData = (agentId: string, mcpConfig: any) => {
  const queryClient = useQueryClient();

  const buildHeaders = () => {
    const url = mcpConfig.url || mcpConfig.config?.url;
    const type = mcpConfig.customType || mcpConfig.type || 'sse';
    return {
      'X-MCP-URL': url,
      'X-MCP-Type': type,
      ...(mcpConfig.headers || mcpConfig.config?.headers ? {
        'X-MCP-Headers': JSON.stringify(mcpConfig.headers || mcpConfig.config?.headers)
      } : {})
    };
  };

  const { data, isLoading, error, refetch } = useQuery<CustomMCPToolsResponse>({
    queryKey: ['custom-mcp-tools', agentId, mcpConfig?.url || mcpConfig?.config?.url],
    queryFn: async () => {
      const response = await backendApi.get(`/agents/${agentId}/custom-mcp-tools`, {
        headers: buildHeaders()
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch custom MCP tools');
      }
      return response.data;
    },
    enabled: !!agentId && !!(mcpConfig?.url || mcpConfig?.config?.url),
    staleTime: 5 * 60 * 1000,
  });

  // Force a live server refresh (bypasses cache)
  const refreshFromServer = async () => {
    const response = await backendApi.get(`/agents/${agentId}/custom-mcp-tools?refresh=true`, {
      headers: buildHeaders()
    });
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to refresh tools from server');
    }
    const result = response.data as CustomMCPToolsResponse;
    // Only update cache if we got actual tools back.
    // If the backend returned empty tools AND no refresh_error, it's a genuine empty server.
    // If the backend fell back to cache (refresh_error set), update cache with that.
    const currentData = queryClient.getQueryData<CustomMCPToolsResponse>(
      ['custom-mcp-tools', agentId, mcpConfig?.url || mcpConfig?.config?.url]
    );
    if (result.tools.length > 0 || !currentData?.tools?.length) {
      queryClient.setQueryData(
        ['custom-mcp-tools', agentId, mcpConfig?.url || mcpConfig?.config?.url],
        result
      );
    } else if (result.refresh_error) {
      // Discovery failed but backend returned cached fallback — use it but propagate error
      queryClient.setQueryData(
        ['custom-mcp-tools', agentId, mcpConfig?.url || mcpConfig?.config?.url],
        result
      );
      throw new Error(`Server refresh failed: ${result.refresh_error}`);
    }
    return result;
  };

  const updateToolsMutation = useMutation({
    mutationFn: async (enabledTools: string[]) => {
      const url = mcpConfig.url || mcpConfig.config?.url;
      const type = mcpConfig.customType || mcpConfig.type || 'sse';

      const response = await backendApi.post(`/agents/${agentId}/custom-mcp-tools`, {
        url: url,
        type: type,
        enabled_tools: enabledTools,
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update custom MCP tools');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-mcp-tools', agentId] });
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(agentId) });
      queryClient.invalidateQueries({ queryKey: ['agent-tools', agentId] });
    },
  });

  return {
    data,
    isLoading,
    error,
    refetch,
    refreshFromServer,
    updateMutation: updateToolsMutation,
    isUpdating: updateToolsMutation.isPending,
  };
};
