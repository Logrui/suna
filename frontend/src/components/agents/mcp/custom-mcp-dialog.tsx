import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Zap, Plus, Trash2, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CustomMCPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: any) => void;
  agentId?: string;
  initialData?: any;
  identifier?: string;
}

import { backendApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface CustomMCPConfiguration {
  name: string;
  type: 'http' | 'sse';
  config: any;
  enabledTools: string[];
  selectedProfileId?: string;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  custom_headers?: Record<string, string>;
}

interface CustomHeader {
  id: string;
  key: string;
  value: string;
}

export const CustomMCPDialog: React.FC<CustomMCPDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  agentId,
  initialData,
  identifier
}) => {
  const isEditing = !!identifier || !!initialData;
  const [serverType, setServerType] = useState<'http' | 'sse'>('http');
  const [configText, setConfigText] = useState(initialData?.config?.url || '');
  const [manualServerName, setManualServerName] = useState(initialData?.name || '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Re-sync if initialData changes
  React.useEffect(() => {
    if (initialData) {
      setConfigText(initialData.config?.url || '');
      setManualServerName(initialData.name || '');
      if (initialData.config?.oauth_client_id) {
        setOauthClientId(initialData.config.oauth_client_id);
      }
      // Parse custom headers if they exist
      if (initialData.config?.custom_headers) {
        const headers = Object.entries(initialData.config.custom_headers).map(([key, value]) => ({
          id: crypto.randomUUID(),
          key,
          value: value as string
        }));
        setCustomHeaders(headers);
      }
    } else {
      setConfigText('');
      setManualServerName('');
      setOauthClientId('');
      setCustomHeaders([]);
    }
  }, [initialData, open]);

  // Advanced Settings State
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [oauthClientId, setOauthClientId] = useState('');
  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>([]);

  const addCustomHeader = () => {
    setCustomHeaders([...customHeaders, { id: crypto.randomUUID(), key: '', value: '' }]);
  };

  const removeCustomHeader = (id: string) => {
    setCustomHeaders(customHeaders.filter(h => h.id !== id));
  };

  const updateCustomHeader = (id: string, field: 'key' | 'value', newValue: string) => {
    setCustomHeaders(customHeaders.map(h =>
      h.id === id ? { ...h, [field]: newValue } : h
    ));
  };

  const handleSave = async () => {
    if (!configText.trim()) {
      setValidationError('Please enter the MCP server URL.');
      return;
    }
    if (!manualServerName.trim()) {
      setValidationError('Please enter a name for this MCP server.');
      return;
    }

    setIsSaving(true);
    setValidationError(null);

    try {
      const headersDict: Record<string, string> = {};
      customHeaders.forEach(h => {
        if (h.key.trim() && h.value.trim()) {
          headersDict[h.key.trim()] = h.value.trim();
        }
      });

      const configPayload = {
        url: configText.trim(),
        custom_headers: Object.keys(headersDict).length > 0 ? headersDict : undefined,
        oauth_client_id: oauthClientId.trim() || undefined,
      };

      // Proactive discovery to see if auth is even needed
      let requiresConfig = false;
      let discoveredTools: string[] = [];
      let serverTypeDetected: 'http' | 'sse' = serverType;

      const discoveryResponse = await backendApi.post('/mcp/discover-custom-tools', {
        type: 'sse', // Try SSE first
        config: configPayload
      }, { showErrors: false });

      if (discoveryResponse.success && discoveryResponse.data?.success) {
        const discovery = discoveryResponse.data;
        requiresConfig = discovery.requires_auth || false;
        discoveredTools = discovery.tools?.map((t: any) => t.name) || [];
        serverTypeDetected = 'sse';
      } else {
        // Fallback to HTTP probe
        const httpDiscovery = await backendApi.post('/mcp/discover-custom-tools', {
          type: 'http',
          config: configPayload
        }, { showErrors: false });

        if (httpDiscovery.success && httpDiscovery.data?.success) {
          const discovery = httpDiscovery.data;
          requiresConfig = discovery.requires_auth || false;
          discoveredTools = discovery.tools?.map((t: any) => t.name) || [];
          serverTypeDetected = 'http';
        }
      }

      const configToSave: any = {
        ...configPayload,
        requires_config: requiresConfig
      };

      onSave({
        name: manualServerName.trim(),
        type: serverTypeDetected,
        config: configToSave,
        enabledTools: discoveredTools,
        oauth_client_id: oauthClientId.trim() || undefined,
        custom_headers: Object.keys(headersDict).length > 0 ? headersDict : undefined,
        isCustom: true
      });

      if (!requiresConfig) {
        toast.success(`Connected to ${manualServerName.trim()}! ${discoveredTools.length} tools discovered.`);
      }

      handleReset();
      onOpenChange(false);
    } catch (error: any) {
      setValidationError(error.message || 'Failed to save MCP configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfigText('');
    setManualServerName('');
    setValidationError(null);
    setIsSaving(false);
    setOauthClientId('');
    setCustomHeaders([]);
    setIsAdvancedOpen(false);
  };

  const exampleConfigs = {
    http: `https://server.example.com/mcp`
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) handleReset();
    }}>
      <DialogContent className="max-w-xl h-[85vh] overflow-hidden flex flex-col p-6 gap-6 rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl tracking-tight font-semibold">
                {isEditing ? 'Configure Custom MCP Connector' : 'Register MCP Server'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {isEditing
                  ? 'Update your Model Context Protocol server settings.'
                  : 'Add a Model Context Protocol server. Tools and authentication will be configured after registration.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto thin-scrollbar p-8 pt-4 space-y-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="serverName" className="text-sm font-medium ml-1">
                Server Name
              </Label>
              <Input
                id="serverName"
                placeholder="e.g., Google Search Tools"
                value={manualServerName}
                onChange={(e) => setManualServerName(e.target.value)}
                className="h-12 px-4 rounded-2xl border-border/50 bg-muted/30 focus:bg-background transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="config" className="text-sm font-medium ml-1">
                Endpoint URL
              </Label>
              <Input
                id="config"
                type="url"
                placeholder={exampleConfigs.http}
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                className="h-12 px-4 font-mono text-sm rounded-2xl border-border/50 bg-muted/30 focus:bg-background transition-colors"
              />
            </div>

            {/* Advanced Settings */}
            <Collapsible
              open={isAdvancedOpen}
              onOpenChange={setIsAdvancedOpen}
              className="border border-border/50 rounded-2xl bg-muted/10 overflow-hidden transition-all"
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 font-medium hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span>Advanced Configuration</span>
                </div>
                {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 pt-0 space-y-6 animate-enter fade-in slide-in-from-top-1 duration-200">
                <div className="pt-2"></div>

                {/* OAuth Settings */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">OAuth Discovery</h4>
                  <div className="space-y-2">
                    <Label htmlFor="clientId" className="text-xs ml-1">Client ID (optional)</Label>
                    <Input
                      id="clientId"
                      placeholder="Backend will attempt discovery if blank"
                      value={oauthClientId}
                      onChange={e => setOauthClientId(e.target.value)}
                      className="h-10 rounded-xl bg-background/50 border-border/50 text-sm"
                    />
                  </div>
                </div>

                {/* Custom Headers */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">Secure Headers</h4>
                    <Button variant="ghost" size="sm" onClick={addCustomHeader} type="button" className="h-7 text-xs px-2 hover:bg-primary/5 text-primary">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Header
                    </Button>
                  </div>

                  {customHeaders.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/60 italic text-center py-6 border border-dashed border-border/60 rounded-xl bg-background/20">
                      No custom headers defined
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {customHeaders.map(header => (
                        <div key={header.id} className="flex gap-2 items-center">
                          <Input
                            placeholder="Key"
                            value={header.key}
                            onChange={e => updateCustomHeader(header.id, 'key', e.target.value)}
                            className="flex-1 font-mono text-xs rounded-xl h-9 bg-background/50 border-border/50"
                          />
                          <Input
                            placeholder="Value"
                            value={header.value}
                            onChange={e => updateCustomHeader(header.id, 'value', e.target.value)}
                            className="flex-1 font-mono text-xs rounded-xl h-9 bg-background/50 border-border/50"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCustomHeader(header.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {validationError && (
            <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/5 animate-enter fade-in zoom-in-95 duration-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{validationError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex items-center gap-3 pt-4 border-t border-border/50">
          <Button variant="ghost" onClick={() => onOpenChange(false)} type="button" className="rounded-xl flex-1 h-11 hover:bg-muted/50">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!configText.trim() || !manualServerName.trim() || isSaving}
            className="rounded-xl flex-[2] h-11 shadow-lg shadow-primary/20"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditing ? 'Updating...' : 'Registering...'}
              </>
            ) : (
              <>
                {isEditing ? 'Update Connector' : 'Register MCP Server'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
};