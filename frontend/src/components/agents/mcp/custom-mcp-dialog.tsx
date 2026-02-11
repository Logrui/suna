import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, Zap, ChevronRight, Sparkles, Server, Plus, Trash2, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface CustomMCPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: CustomMCPConfiguration) => void;
}

interface CustomMCPConfiguration {
  name: string;
  type: 'http';
  config: any;
  enabledTools: string[];
  selectedProfileId?: string;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  custom_headers?: Record<string, string>;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema?: any;
}

interface CustomHeader {
  id: string;
  key: string;
  value: string;
}

export const CustomMCPDialog: React.FC<CustomMCPDialogProps> = ({
  open,
  onOpenChange,
  onSave
}) => {
  const [step, setStep] = useState<'setup' | 'tools'>('setup');
  const [serverType, setServerType] = useState<'http'>('http');
  const [configText, setConfigText] = useState('');
  const [serverName, setServerName] = useState('');
  const [manualServerName, setManualServerName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [discoveredTools, setDiscoveredTools] = useState<MCPTool[]>([]);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [processedConfig, setProcessedConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Advanced Settings State
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
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

  const validateAndDiscoverTools = async () => {
    setIsValidating(true);
    setValidationError(null);
    setDiscoveredTools([]);

    try {
      let parsedConfig: any;
      let headersDict: Record<string, string> = {};

      if (serverType === 'http') {
        const url = configText.trim();
        if (!url) {
          throw new Error('Please enter the MCP server URL.');
        }
        if (!manualServerName.trim()) {
          throw new Error('Please enter a name for this MCP server.');
        }

        // Validate headers
        customHeaders.forEach(h => {
          if (h.key.trim() && h.value.trim()) {
            headersDict[h.key.trim()] = h.value.trim();
          }
        });

        parsedConfig = {
          url,
          // We pass these here so the backend discovery can blindly use them if needed for probing
          custom_headers: Object.keys(headersDict).length > 0 ? headersDict : undefined
        };

        setServerName(manualServerName.trim());
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to discover tools');
      }

      // Check if this looks like an OAuth flow might be needed (or if we explicitly want to try auth first)
      // For now, we hit discovery. If discovery fails with 401 or returns a special "auth_required" payload (future), we handle it.
      // But we also support the user explicitly clicking "Connect" which in the new design might be triggered if discovery fails?
      // Actually, per the plan, we might want to initiate auth *during* discovery?
      // Let's stick to the current flow: Try discover. 

      const payload: any = {
        type: serverType,
        config: parsedConfig
      };

      // Add Optional OAuth fields to the payload for discovery context (if backend needs them to probe DCR)
      if (oauthClientId.trim()) payload.oauth_client_id = oauthClientId.trim();
      if (oauthClientSecret.trim()) payload.oauth_client_secret = oauthClientSecret.trim();
      if (headersDict && Object.keys(headersDict).length > 0) payload.custom_headers = headersDict;

      const response = await fetch(`${API_URL}/mcp/discover-custom-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();

        // Smart Auth Detection:
        // If the server returns 401, or explicitly mentions "authentication required", 
        // we automatically try to initiate the OAuth flow.
        if (response.status === 401 || (error.message && error.message.toLowerCase().includes('authentication required'))) {
          console.log("Discovery failed with Auth error, attempting OAuth flow...");
          await handleInitiateOAuth();
          return;
        }

        throw new Error(error.message || 'Failed to connect to the MCP server. Please check your configuration.');
      }

      const data = await response.json();

      // Check for redirect indication in response (if we updated backend to support hybrid)
      // Currently backend `discover` returns tools.

      if (!data.tools || data.tools.length === 0) {
        throw new Error('No tools found. Please check your configuration.');
      }

      if (data.serverName) {
        setServerName(data.serverName);
      }

      if (data.processedConfig) {
        setProcessedConfig(data.processedConfig);
      }

      setDiscoveredTools(data.tools);
      setSelectedTools(new Set(data.tools.map((tool: MCPTool) => tool.name)));
      setStep('tools');

    } catch (error: any) {
      // If the error was not handled by auto-auth above, show it
      setValidationError(error.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleInitiateOAuth = async () => {
    // This is the new "Connect" flow for OAuth servers
    setIsValidating(true);
    setValidationError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) throw new Error('You must be logged in.');

      const url = configText.trim();
      if (!url) throw new Error('URL required');

      const returnUrl = window.location.href; // Using current page as return URL
      const encodedReturn = encodeURIComponent(returnUrl);
      const encodedUrl = encodeURIComponent(url);

      // Call start endpoint
      const response = await fetch(`${API_URL}/mcp/auth/start?url=${encodedUrl}&return_url=${encodedReturn}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const err = await response.json();
        // If even the OAuth start fails, we must show the error
        throw new Error(err.detail || 'Failed to initiate OAuth flow. The server might not support it.');
      }

      const data = await response.json();
      if (data.redirect_url) {
        // Redirect the user to the OAuth provider
        window.location.href = data.redirect_url;
        // We return here to prevent setting isValidating=false too early, 
        // although the page will navigate away shortly.
        return;
      } else {
        throw new Error('No redirect URL returned by the backend.');
      }

    } catch (e: any) {
      setValidationError(e.message);
      setIsValidating(false);
    }
  }

  const handleToolsNext = async () => {
    if (selectedTools.size === 0) {
      setValidationError('Please select at least one tool to continue.');
      return;
    }
    setValidationError(null);
    await handleSave();
  };

  const handleSave = async () => {
    if (discoveredTools.length === 0 || selectedTools.size === 0) {
      setValidationError('Please select at least one tool to continue.');
      return;
    }

    if (!serverName.trim()) {
      setValidationError('Please provide a name for this MCP server.');
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

      const configToSave: any = {
        url: configText.trim(),
        custom_headers: Object.keys(headersDict).length > 0 ? headersDict : undefined,
        oauth_client_id: oauthClientId.trim() || undefined,
        oauth_client_secret: oauthClientSecret.trim() || undefined
      };

      onSave({
        name: serverName,
        type: serverType,
        config: configToSave,
        enabledTools: Array.from(selectedTools),
        selectedProfileId: undefined,
        // Pass these up so main handler can store them safely if needed, though usually they go in config/credentials
        oauth_client_id: oauthClientId.trim() || undefined,
        oauth_client_secret: oauthClientSecret.trim() || undefined,
        custom_headers: Object.keys(headersDict).length > 0 ? headersDict : undefined
      });

      handleReset();
      onOpenChange(false);
    } catch (error: any) {
      setValidationError(error.message || 'Failed to save MCP configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToolToggle = (toolName: string) => {
    const newTools = new Set(selectedTools);
    if (newTools.has(toolName)) {
      newTools.delete(toolName);
    } else {
      newTools.add(toolName);
    }
    setSelectedTools(newTools);
  };

  const handleBack = () => {
    if (step === 'tools') {
      setStep('setup');
    }
    setValidationError(null);
  };

  const handleReset = () => {
    setConfigText('');
    setManualServerName('');
    setDiscoveredTools([]);
    setSelectedTools(new Set());
    setServerName('');
    setProcessedConfig(null);

    setValidationError(null);
    setStep('setup');
    setIsSaving(false);

    setOauthClientId('');
    setOauthClientSecret('');
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle>Add MCP Server</DialogTitle>
          </div>
          <DialogDescription>
            {step === 'setup'
              ? 'Connect to a Model Context Protocol (MCP) server to expand your agent\'s capabilities with new tools and integrations.'
              : 'Choose which tools you\'d like to enable from this MCP server.'
            }
          </DialogDescription>
          <div className="flex items-center gap-2 pt-2">
            <div className={cn(
              "flex items-center gap-2 text-sm font-medium",
              step === 'setup' ? "text-primary" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                step === 'setup' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                1
              </div>
              Setup MCP Server
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className={cn(
              "flex items-center gap-2 text-sm font-medium",
              step === 'tools' ? "text-primary" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                step === 'tools' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                2
              </div>
              Select Tools
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto max-h-[60vh] flex flex-col">
          {step === 'setup' ? (
            <div className="space-y-6 p-1 flex-1">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-base font-medium">Connection Type</Label>
                  <div className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border bg-primary/5",
                    "border-primary"
                  )}>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" />
                        <Label className="text-base font-medium">
                          Streamable HTTP MCP Server
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Connect to any Model Context Protocol server via HTTP. MCP provides a standardized way for AI applications to securely connect to external tools and data sources.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serverName" className="text-base font-medium">
                    MCP Server Name
                  </Label>
                  <input
                    id="serverName"
                    type="text"
                    placeholder="e.g., Gmail MCP Server, Slack Integration, File System Tools"
                    value={manualServerName}
                    onChange={(e) => setManualServerName(e.target.value)}
                    className="w-full px-4 py-3 border border-input bg-background rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                  <p className="text-sm text-muted-foreground">
                    Give this MCP server a memorable name
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="config" className="text-base font-medium">
                    MCP Server URL
                  </Label>
                  <Input
                    id="config"
                    type="url"
                    placeholder={exampleConfigs.http}
                    value={configText}
                    onChange={(e) => setConfigText(e.target.value)}
                    className="w-full px-4 py-3 border border-input bg-muted rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent font-mono"
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter the complete URL to your MCP server endpoint
                  </p>
                </div>

                {/* Advanced Settings */}
                <Collapsible
                  open={isAdvancedOpen}
                  onOpenChange={setIsAdvancedOpen}
                  className="border rounded-lg bg-card"
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 font-medium hover:bg-muted/50 transition-colors rounded-lg">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <span>Advanced Settings</span>
                    </div>
                    {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-4 pt-0 space-y-6 animate-accordion-down">
                    <div className="pt-2"></div>

                    {/* OAuth Config */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold tracking-tight">OAuth Configuration (Optional)</h4>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="clientId">Client ID</Label>
                          <Input
                            id="clientId"
                            placeholder="Optional Client ID for manual configuration"
                            value={oauthClientId}
                            onChange={e => setOauthClientId(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="clientSecret">Client Secret</Label>
                          <Input
                            id="clientSecret"
                            type="password"
                            placeholder="Optional Client Secret"
                            value={oauthClientSecret}
                            onChange={e => setOauthClientSecret(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Custom Headers */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold tracking-tight">Custom Headers</h4>
                        <Button variant="outline" size="sm" onClick={addCustomHeader} type="button">
                          <Plus className="h-3 w-3 mr-1" />
                          Add Header
                        </Button>
                      </div>

                      {customHeaders.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic text-center py-2 border border-dashed rounded-md">
                          No custom headers added
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {customHeaders.map(header => (
                            <div key={header.id} className="flex gap-2 items-center">
                              <Input
                                placeholder="Key (e.g. X-Api-Token)"
                                value={header.key}
                                onChange={e => updateCustomHeader(header.id, 'key', e.target.value)}
                                className="flex-1 font-mono text-sm"
                              />
                              <Input
                                placeholder="Value"
                                value={header.value}
                                onChange={e => updateCustomHeader(header.id, 'value', e.target.value)}
                                className="flex-1 font-mono text-sm"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCustomHeader(header.id)}
                                className="h-9 w-9 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
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
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : step === 'tools' ? (
            <div className="space-y-6 p-1 flex-1 flex flex-col">
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="ml-2">
                  <h3 className="font-medium text-green-900 mb-1">
                    MCP Server Connected!
                  </h3>
                  <p className="text-sm text-green-700">
                    Found {discoveredTools.length} available tools from <strong>{serverName}</strong> MCP server
                  </p>
                </div>
              </Alert>

              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-medium">Available Tools</h3>
                    <p className="text-sm text-muted-foreground">
                      Select the tools you want to enable
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedTools.size === discoveredTools.length) {
                        setSelectedTools(new Set());
                      } else {
                        setSelectedTools(new Set(discoveredTools.map(t => t.name)));
                      }
                    }}
                  >
                    {selectedTools.size === discoveredTools.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-[400px] border border-border rounded-lg">
                    <div className="space-y-3 p-4">
                      {discoveredTools.map((tool) => (
                        <div
                          key={tool.name}
                          className={cn(
                            "flex items-start space-x-3 p-4 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                            selectedTools.has(tool.name)
                              ? "border-primary bg-primary/5"
                              : "border-border"
                          )}
                          onClick={() => handleToolToggle(tool.name)}
                        >
                          <Checkbox
                            id={tool.name}
                            checked={selectedTools.has(tool.name)}
                            onCheckedChange={() => handleToolToggle(tool.name)}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-2 min-w-0">
                            <Label
                              htmlFor={tool.name}
                              className="text-base font-medium cursor-pointer block"
                            >
                              {tool.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Label>
                            {tool.description && (
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {tool.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-shrink-0 pt-4">
          {step === 'tools' ? (
            <>
              <Button variant="outline" onClick={handleBack} disabled={isSaving} type="button">
                Back
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving} type="button">
                Cancel
              </Button>
              <Button
                onClick={handleToolsNext}
                disabled={selectedTools.size === 0 || isSaving}
                type="button"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding MCP Server...
                  </>
                ) : (
                  `Add MCP Server (${selectedTools.size} tools)`
                )}
              </Button>
            </>
          ) : (
            <>
              {/* New OAuth Connect Button */}
              {configText && (configText.includes('oauth') || isAdvancedOpen) && (
                <Button variant="secondary" onClick={handleInitiateOAuth} disabled={!configText.trim() || isValidating} type="button" className="mr-auto hidden">
                  <Lock className="h-3 w-3 mr-2" />
                  Connect with OAuth (Legacy)
                </Button>
              )}

              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
                Cancel
              </Button>
              <Button
                onClick={validateAndDiscoverTools}
                disabled={!configText.trim() || !manualServerName.trim() || isValidating}
                type="button"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Connect to MCP Server
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};