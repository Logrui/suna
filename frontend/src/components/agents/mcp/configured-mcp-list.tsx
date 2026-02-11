import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { Settings, X, Sparkles, Key, AlertTriangle, Trash2, Link } from 'lucide-react';
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

import { useComposioToolkits } from '@/hooks/composio/use-composio';

interface ConfiguredMcpListProps {
  configuredMCPs: MCPConfiguration[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onConfigureTools?: (index: number) => void;
  onConnect?: (mcp: MCPConfiguration) => void;
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
  onConnect?: (mcp: MCPConfiguration) => void;
}> = ({ mcp, index, onEdit, onRemove, onConfigureTools, onConnect }) => {
  const qualifiedNameForLookup = (mcp.customType === 'composio' || mcp.isComposio)
    ? mcp.mcp_qualified_name || mcp.config?.mcp_qualified_name || mcp.qualifiedName
    : mcp.qualifiedName;
  const { data: profiles = [] } = useCredentialProfilesForMcp(qualifiedNameForLookup);
  const profileId = mcp.selectedProfileId || mcp.config?.profile_id;
  const selectedProfile = profiles.find(p => p.profile_id === profileId);

  const hasCredentialProfile = !!profileId && !!selectedProfile;

  // Check if this custom MCP requires OAuth and isn't connected yet
  const requiresOAuth = mcp.config?.requires_auth === true && !mcp.config?.oauth_connected;

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
              {requiresOAuth && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                  Auth Required
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
              {mcp.config?.oauth_connected && (
                <div className="flex items-center gap-1">
                  <Link className="h-3 w-3 text-green-600" />
                  <span className="text-green-600 font-medium">OAuth Connected</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {requiresOAuth && onConnect && (
            <Button
              variant="outline"
              size="sm"
              className="bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
              onClick={() => onConnect(mcp)}
              type="button"
            >
              <Link className="h-4 w-4 mr-1" />
              Connect
            </Button>
          )}
          {onConfigureTools && (
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
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 bg-card border border-border hover:bg-muted text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(index)}
            title="Remove connector"
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
  onConnect,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [mcpToDelete, setMcpToDelete] = React.useState<{ mcp: MCPConfiguration; index: number } | null>(null);

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
            onConnect={onConnect}
          />
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Connector</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the &quot;{mcpToDelete?.mcp.name}&quot; connector? This will disconnect all associated tools and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Remove Connector
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
