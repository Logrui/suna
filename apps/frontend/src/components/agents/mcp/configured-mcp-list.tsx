import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { Settings, X, Sparkles, Key, AlertTriangle, Trash2 } from 'lucide-react';
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
import { MCPConfiguration } from './types';
import { useCredentialProfilesForMcp } from '@/hooks/mcp/use-credential-profiles';
import { CustomMCPAuthConfirmation } from './custom-mcp-auth-confirmation';

import { useComposioToolkits } from '@/hooks/composio/use-composio';

interface ConfiguredMcpListProps {
  configuredMCPs: MCPConfiguration[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onConfigureTools?: (index: number) => void;
  agentId?: string;
}

const extractAppSlug = (mcp: MCPConfiguration): { type: 'composio', slug: string } | null => {
  if (mcp.customType === 'composio' || mcp.isComposio) {
    const slug = mcp.toolkitSlug || (mcp as any).toolkit_slug || mcp.config?.toolkit_slug;
    if (slug) {
      return { type: 'composio', slug };
    }

    const qualifiedName = mcp.mcp_qualified_name || mcp.qualifiedName;
    if (qualifiedName && qualifiedName.startsWith('composio.')) {
      const extractedSlug = qualifiedName.substring(9);
      if (extractedSlug) {
        return { type: 'composio', slug: extractedSlug };
      }
    }
  }

  return null;
};

const MCPLogo: React.FC<{ mcp: MCPConfiguration }> = ({ mcp }) => {
  const appInfo = extractAppSlug(mcp);

  const { data: composioToolkits } = useComposioToolkits(
    appInfo?.type === 'composio' ? appInfo.slug : undefined,
    undefined
  );

  let logoUrl: string | undefined;
  if (appInfo?.type === 'composio' && composioToolkits?.toolkits?.[0]) {
    logoUrl = composioToolkits.toolkits[0].logo;
  }

  const firstLetter = mcp.name.charAt(0).toUpperCase();

  return (
    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={mcp.name}
          className="w-full h-full object-cover rounded"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <div className={logoUrl ? "hidden" : "flex w-full h-full items-center justify-center bg-muted rounded-md text-sm font-medium text-muted-foreground"}>
        {firstLetter}
      </div>
    </div>
  );
};

const MCPConfigurationItem: React.FC<{
  mcp: MCPConfiguration;
  index: number;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onConfigureTools?: (index: number) => void;
  onAuthRequest: (mcp: MCPConfiguration) => void;
  agentId?: string;
}> = ({ mcp, index, onEdit, onRemove, onConfigureTools, onAuthRequest, agentId }) => {
  const qualifiedNameForLookup = (mcp.customType === 'composio' || mcp.isComposio)
    ? mcp.mcp_qualified_name || mcp.config?.mcp_qualified_name || mcp.qualifiedName
    : mcp.qualifiedName;
  const { data: profiles = [] } = useCredentialProfilesForMcp(qualifiedNameForLookup);
  const profileId = mcp.selectedProfileId || mcp.config?.profile_id;
  const selectedProfile = profiles.find(p => p.profile_id === profileId);

  const hasCredentialProfile = !!profileId && !!selectedProfile;
  
  // Detect if OAuth/Auth is needed
  // Condition: Explicit requires_auth flag OR (custom HTTP/SSE without access_token but with client_id)
  const isAuthRequired = mcp.config?.requires_auth === true || 
    (mcp.isCustom && 
     !mcp.config?.access_token && 
     (mcp.config?.oauth_client_id || mcp.config?.custom_headers)) ||
    (mcp.isCustom && (!mcp.enabledTools || mcp.enabledTools.length === 0));
     
  const handleConnect = () => {
    onAuthRequest(mcp);
  };

  return (
    <SpotlightCard className="bg-card border border-border">
      <div className="flex items-center justify-between p-5">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-card border border-border/50">
            <MCPLogo mcp={mcp} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium text-foreground truncate">{mcp.name}</h4>
              {isAuthRequired && (
                <Badge variant="secondary" className="text-[10px] h-5 bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                  Needs Auth
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{mcp.enabledTools?.length || 0} tools enabled</span>
              {hasCredentialProfile && (
                <div className="flex items-center gap-1">
                  <Key className="h-3 w-3 text-green-600" />
                  <span className="text-green-600 font-medium truncate max-w-24">
                    {selectedProfile.profile_name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {isAuthRequired ? (
             <Button 
               size="sm" 
               className="bg-primary text-primary-foreground hover:bg-primary/90"
               onClick={handleConnect}
             >
               Connect
             </Button>
          ) : (
            onConfigureTools && (
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 bg-card border border-border hover:bg-muted"
                onClick={() => onConfigureTools(index)}
                title="Configure tools"
                type="button"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 bg-card border border-border hover:bg-muted text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(index)}
            title="Remove integration"
            type="button"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </SpotlightCard>
  );
};

export const ConfiguredMcpList: React.FC<ConfiguredMcpListProps> = ({
  configuredMCPs,
  onEdit,
  onRemove,
  onConfigureTools,
  agentId,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [mcpToDelete, setMcpToDelete] = React.useState<{ mcp: MCPConfiguration; index: number } | null>(null);
  
  // Auth Confirmation State
  const [authConfirmationOpen, setAuthConfirmationOpen] = React.useState(false);
  const [mcpToAuth, setMcpToAuth] = React.useState<MCPConfiguration | null>(null);

  const handleDeleteClick = (mcp: MCPConfiguration, index: number) => {
    setMcpToDelete({ mcp, index });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (mcpToDelete) {
      onRemove(mcpToDelete.index);
      setMcpToDelete(null);
      setDeleteDialogOpen(false);
    }
  };
  
  const handleAuthRequest = (mcp: MCPConfiguration) => {
    setMcpToAuth(mcp);
    setAuthConfirmationOpen(true);
  };
  
  const confirmAuth = () => {
    if (!mcpToAuth) return;
    
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    const mcpUrl = mcpToAuth.config?.url;
    
    if (!mcpUrl) {
      console.error("Missing MCP URL for connection");
      return;
    }
    
    // Construct the OAuth start URL
    // Endpoint: /v1/mcp/auth/start?url=...&return_url=...&agent_id=...&name=...
    const returnUrl = window.location.href;
    const authStartUrl = `${backendUrl}/mcp/auth/start?url=${encodeURIComponent(mcpUrl)}&return_url=${encodeURIComponent(returnUrl)}&agent_id=${agentId || ''}&name=${encodeURIComponent(mcpToAuth.name)}`;
    
    // Redirect to backend auth start
    window.location.href = authStartUrl;
    setAuthConfirmationOpen(false);
  };

  if (configuredMCPs.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        {configuredMCPs.map((mcp, index) => (
          <MCPConfigurationItem
            key={index}
            mcp={mcp}
            index={index}
            onEdit={onEdit}
            onRemove={(idx) => handleDeleteClick(mcp, idx)}
            onConfigureTools={onConfigureTools}
            onAuthRequest={handleAuthRequest}
            agentId={agentId}
          />
        ))}
      </div>
      
      {mcpToAuth && (
        <CustomMCPAuthConfirmation
          open={authConfirmationOpen}
          onOpenChange={setAuthConfirmationOpen}
          onConfirm={confirmAuth}
          serverName={mcpToAuth.name}
          serverUrl={mcpToAuth.config?.url || ''}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Integration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the "{mcpToDelete?.mcp.name}" integration? This will disconnect all associated tools and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Remove Integration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};