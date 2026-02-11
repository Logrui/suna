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
}

export const useCustomMCPToolsData = (agentId: string, mcpConfig: any) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<CustomMCPToolsResponse>({
    queryKey: ['custom-mcp-tools', agentId, mcpConfig?.url || mcpConfig?.config?.url],
    queryFn: async () => {
      const url = mcpConfig.url || mcpConfig.config?.url;
      const type = mcpConfig.customType || mcpConfig.type || 'sse';

      const response = await backendApi.get(`/agents/${agentId}/custom-mcp-tools`, {
        headers: {
          'X-MCP-URL': url,
          'X-MCP-Type': type,
          ...(mcpConfig.headers || mcpConfig.config?.headers ? {
            'X-MCP-Headers': JSON.stringify(mcpConfig.headers || mcpConfig.config?.headers)
          } : {})
        }
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch custom MCP tools');
      }
      return response.data;
    },
    enabled: !!agentId && !!(mcpConfig?.url || mcpConfig?.config?.url),
    staleTime: 5 * 60 * 1000,
  });

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
    updateMutation: updateToolsMutation,
    isUpdating: updateToolsMutation.isPending,
  };
}; 