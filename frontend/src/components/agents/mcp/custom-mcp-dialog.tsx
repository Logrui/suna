import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, Zap, ChevronRight, ChevronDown, Sparkles, Server, Settings, Plus, Trash2, Key, Link } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface CustomMCPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: CustomMCPConfiguration) => void;
  agentId?: string;
}

interface CustomMCPConfiguration {
  name: string;
  type: 'http';
  config: any;
  enabledTools: string[];
  selectedProfileId?: string;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema?: any;
}

interface CustomHeader {
  key: string;
  value: string;
}

export const CustomMCPDialog: React.FC<CustomMCPDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  agentId,
}) => {
  const [step, setStep] = useState<'setup' | 'tools' | 'oauth'>('setup');
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

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>([]);
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');

  // OAuth state
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [oauthMetadata, setOauthMetadata] = useState<any>(null);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const oauthPollRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (oauthPollRef.current) {
        clearInterval(oauthPollRef.current);
      }
    };
  }, []);

  const getCustomHeadersObject = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    customHeaders.forEach(h => {
      if (h.key.trim()) {
        headers[h.key.trim()] = h.value;
      }
    });
    return headers;
  }, [customHeaders]);

  const validateAndDiscoverTools = async () => {
    setIsValidating(true);
    setValidationError(null);
    setDiscoveredTools([]);
    setRequiresAuth(false);
    setOauthMetadata(null);

    try {
      let parsedConfig: any;

      if (serverType === 'http') {
        const url = configText.trim();
        if (!url) {
          throw new Error('Please enter the MCP server URL.');
        }
        if (!manualServerName.trim()) {
          throw new Error('Please enter a name for this MCP server.');
        }

        parsedConfig = { url };
        setServerName(manualServerName.trim());
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to discover tools');
      }

      // Build request with custom headers and OAuth config
      const headersObj = getCustomHeadersObject();
      const requestBody: any = {
        type: serverType,
        config: parsedConfig,
      };
      if (Object.keys(headersObj).length > 0) {
        requestBody.custom_headers = headersObj;
      }
      if (oauthClientId.trim()) {
        requestBody.oauth_client_id = oauthClientId.trim();
      }
      if (oauthClientSecret.trim()) {
        requestBody.oauth_client_secret = oauthClientSecret.trim();
      }

      const response = await fetch(`${API_URL}/mcp/discover-custom-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to connect to the MCP server. Please check your configuration.');
      }

      const data = await response.json();

      // Check if OAuth is required
      if (data.requires_auth && (!data.tools || data.tools.length === 0)) {
        setRequiresAuth(true);
        setOauthMetadata(data.oauth_metadata);
        setStep('oauth');
        return;
      }

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
      setValidationError(error.message);
    } finally {
      setIsValidating(false);
    }
  };

  const startOAuthFlow = async () => {
    setOauthConnecting(true);
    setValidationError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in');
      }

      const url = configText.trim();
      const params = new URLSearchParams({
        mcp_url: url,
        user_id: session.user.id,
        agent_id: agentId || '',
      });
      if (oauthClientId.trim()) {
        params.set('oauth_client_id', oauthClientId.trim());
      }
      if (oauthClientSecret.trim()) {
        params.set('oauth_client_secret', oauthClientSecret.trim());
      }

      const authUrl = `${API_URL}/mcp/auth/start?${params.toString()}`;

      // Open popup
      const popup = window.open(authUrl, 'mcp_oauth', 'width=800,height=600,scrollbars=yes');

      // Poll for completion
      oauthPollRef.current = setInterval(async () => {
        // Check if popup was closed
        if (popup && popup.closed) {
          if (oauthPollRef.current) {
            clearInterval(oauthPollRef.current);
            oauthPollRef.current = null;
          }

          // Check if OAuth completed
          try {
            const statusResp = await fetch(
              `${API_URL}/mcp/auth/status?mcp_url=${encodeURIComponent(url)}`,
              {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                },
              }
            );
            const statusData = await statusResp.json();

            if (statusData.status === 'completed') {
              setOauthConnecting(false);
              setRequiresAuth(false);
              // Re-run discovery with stored token
              setStep('setup');
              await validateAndDiscoverTools();
            } else {
              setOauthConnecting(false);
              setValidationError('OAuth flow was not completed. Please try again.');
            }
          } catch {
            setOauthConnecting(false);
            setValidationError('Failed to verify OAuth status.');
          }
          return;
        }

        // Poll status while popup is open
        try {
          const statusResp = await fetch(
            `${API_URL}/mcp/auth/status?mcp_url=${encodeURIComponent(url)}`,
            {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            }
          );
          const statusData = await statusResp.json();

          if (statusData.status === 'completed') {
            if (oauthPollRef.current) {
              clearInterval(oauthPollRef.current);
              oauthPollRef.current = null;
            }
            if (popup && !popup.closed) {
              popup.close();
            }
            setOauthConnecting(false);
            setRequiresAuth(false);
            // Re-run discovery with stored token
            setStep('setup');
            await validateAndDiscoverTools();
          }
        } catch {
          // Ignore polling errors
        }
      }, 2000);

    } catch (error: any) {
      setOauthConnecting(false);
      setValidationError(error.message);
    }
  };

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
      const headersObj = getCustomHeadersObject();
      const configToSave: any = {
        url: configText.trim(),
      };

      if (Object.keys(headersObj).length > 0) {
        configToSave.headers = headersObj;
      }
      if (oauthClientId.trim()) {
        configToSave.oauth_client_id = oauthClientId.trim();
      }
      if (oauthClientSecret.trim()) {
        configToSave.oauth_client_secret = oauthClientSecret.trim();
      }
      if (requiresAuth) {
        configToSave.requires_auth = true;
        configToSave.oauth_connected = true;
      }

      onSave({
        name: serverName,
        type: serverType,
        config: configToSave,
        enabledTools: Array.from(selectedTools),
        selectedProfileId: undefined
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
    if (step === 'tools' || step === 'oauth') {
      setStep('setup');
      setRequiresAuth(false);
      setOauthConnecting(false);
      if (oauthPollRef.current) {
        clearInterval(oauthPollRef.current);
        oauthPollRef.current = null;
      }
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
    setShowAdvanced(false);
    setCustomHeaders([]);
    setOauthClientId('');
    setOauthClientSecret('');
    setRequiresAuth(false);
    setOauthMetadata(null);
    setOauthConnecting(false);
    if (oauthPollRef.current) {
      clearInterval(oauthPollRef.current);
      oauthPollRef.current = null;
    }
  };

  const addCustomHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const updateCustomHeader = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...customHeaders];
    updated[index] = { ...updated[index], [field]: val };
    setCustomHeaders(updated);
  };

  const removeCustomHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
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
              : step === 'oauth'
              ? 'This server requires OAuth authentication. Authorize access to continue.'
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
              step === 'oauth' ? "text-primary" : "text-muted-foreground"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                step === 'oauth' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                <Key className="h-3 w-3" />
              </div>
              Authorize
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
              </div>

              {/* Advanced Settings */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-4 py-3 h-auto text-sm font-medium text-muted-foreground hover:text-foreground" type="button">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Advanced Settings
                    </div>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-5 pt-2 pl-1 pr-1 pb-1">
                    {/* Custom Headers */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Custom Headers</Label>
                      <p className="text-xs text-muted-foreground">
                        Add custom HTTP headers sent with every request to this MCP server.
                      </p>
                      {customHeaders.map((header, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            placeholder="Header Name (e.g. X-Api-Key)"
                            value={header.key}
                            onChange={(e) => updateCustomHeader(index, 'key', e.target.value)}
                            className="flex-1 font-mono text-sm"
                          />
                          <Input
                            placeholder="Header Value"
                            value={header.value}
                            onChange={(e) => updateCustomHeader(index, 'value', e.target.value)}
                            className="flex-1 font-mono text-sm"
                            type="password"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive flex-shrink-0"
                            onClick={() => removeCustomHeader(index)}
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addCustomHeader}
                        type="button"
                        className="text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Custom Header
                      </Button>
                    </div>

                    {/* OAuth Configuration */}
                    <div className="space-y-3 border-t pt-4">
                      <Label className="text-sm font-medium">OAuth Configuration (Optional)</Label>
                      <p className="text-xs text-muted-foreground">
                        Only needed if the server requires OAuth and you have pre-registered client credentials. Leave empty for servers that support Dynamic Client Registration.
                      </p>
                      <div className="space-y-2">
                        <Input
                          placeholder="OAuth Client ID"
                          value={oauthClientId}
                          onChange={(e) => setOauthClientId(e.target.value)}
                          className="font-mono text-sm"
                        />
                        <Input
                          placeholder="OAuth Client Secret"
                          value={oauthClientSecret}
                          onChange={(e) => setOauthClientSecret(e.target.value)}
                          className="font-mono text-sm"
                          type="password"
                        />
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : step === 'oauth' ? (
            <div className="space-y-6 p-1 flex-1">
              <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                <Key className="h-5 w-5 text-amber-600" />
                <div className="ml-2">
                  <h3 className="font-medium text-amber-900 mb-1">
                    OAuth Authentication Required
                  </h3>
                  <p className="text-sm text-amber-700">
                    The server at <strong>{configText.trim()}</strong> requires OAuth authentication. Click the button below to authorize Kortix to access this server on your behalf.
                  </p>
                </div>
              </Alert>

              {oauthMetadata && (
                <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded-lg">
                  <p><strong>Authorization Endpoint:</strong> {oauthMetadata.authorization_endpoint}</p>
                  <p><strong>Token Endpoint:</strong> {oauthMetadata.token_endpoint}</p>
                  {oauthMetadata.registration_endpoint && (
                    <p><strong>Registration:</strong> Dynamic Client Registration supported</p>
                  )}
                </div>
              )}

              <div className="flex justify-center pt-4">
                <Button
                  onClick={startOAuthFlow}
                  disabled={oauthConnecting}
                  size="lg"
                  className="gap-2"
                  type="button"
                >
                  {oauthConnecting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Waiting for authorization...
                    </>
                  ) : (
                    <>
                      <Link className="h-5 w-5" />
                      Authorize with OAuth
                    </>
                  )}
                </Button>
              </div>

              {oauthConnecting && (
                <p className="text-xs text-center text-muted-foreground">
                  A popup window has opened. Complete the authorization there, then return here.
                </p>
              )}

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
          ) : step === 'oauth' ? (
            <>
              <Button variant="outline" onClick={handleBack} disabled={oauthConnecting} type="button">
                Back
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={oauthConnecting} type="button">
                Cancel
              </Button>
            </>
          ) : (
            <>
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
                    Connecting to MCP server...
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
