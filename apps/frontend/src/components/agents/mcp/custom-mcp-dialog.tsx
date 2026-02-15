import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Zap, ChevronRight, Sparkles, Server, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { KortixLoader } from '@/components/ui/kortix-loader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema?: any;
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
  const [customHeaders, setCustomHeaders] = useState<{key: string, value: string}[]>([{ key: '', value: '' }]);

  const handleAddHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  const handleHeaderChange = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...customHeaders];
    newHeaders[index][field] = value;
    setCustomHeaders(newHeaders);
  };

  const validateAndDiscoverTools = async () => {
    setIsValidating(true);
    setValidationError(null);
    setDiscoveredTools([]);
    
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

      // Add Advanced Configs
      if (oauthClientId.trim()) parsedConfig.oauth_client_id = oauthClientId.trim();
      if (oauthClientSecret.trim()) parsedConfig.oauth_client_secret = oauthClientSecret.trim();
      
      const headerObj: Record<string, string> = {};
      customHeaders.forEach(h => {
        if (h.key.trim() && h.value.trim()) {
          headerObj[h.key.trim()] = h.value.trim();
        }
      });
      if (Object.keys(headerObj).length > 0) {
        parsedConfig.custom_headers = headerObj;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to discover tools');
      }

      const response = await fetch(`${API_URL}/mcp/discover-custom-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: serverType,
          config: parsedConfig
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to connect to the MCP server. Please check your configuration.');
      }

      const data = await response.json();
      
      // Handle requires_auth (OAuth flow needed)
      if (data.requires_auth) {
         // Auto-save logic will be handled here or by allowing partial save
         // For now, we allow saving even with 0 tools if auth is required
         if (!data.tools || data.tools.length === 0) {
             setDiscoveredTools([]);
             // We can proceed to save directly if auth is required
             setProcessedConfig({ ...parsedConfig, requires_auth: true });
             
             // Directly save and close to trigger "Configure" state in list
             onSave({
                name: manualServerName.trim(),
                type: serverType,
                config: { ...parsedConfig, requires_auth: true },
                enabledTools: [],
                selectedProfileId: undefined
             });
             onOpenChange(false);
             return;
         }
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
      // Re-construct config to ensure we capture latest state
      const configToSave: any = { url: configText.trim() };
      
      if (oauthClientId.trim()) configToSave.oauth_client_id = oauthClientId.trim();
      if (oauthClientSecret.trim()) configToSave.oauth_client_secret = oauthClientSecret.trim();
      
      const headerObj: Record<string, string> = {};
      customHeaders.forEach(h => {
        if (h.key.trim() && h.value.trim()) {
          headerObj[h.key.trim()] = h.value.trim();
        }
      });
      if (Object.keys(headerObj).length > 0) {
        configToSave.custom_headers = headerObj;
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
    setOauthClientId('');
    setOauthClientSecret('');
    setCustomHeaders([{ key: '', value: '' }]);
    setIsAdvancedOpen(false);
    
    setValidationError(null);
    setStep('setup');
    setIsSaving(false);
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

                <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen} className="border rounded-lg p-4 bg-muted/20">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer w-full">
                      <Label className="text-sm font-medium cursor-pointer">Advanced Settings (OAuth & Headers)</Label>
                      {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientId" className="text-xs font-medium">OAuth Client ID</Label>
                      <Input
                        id="clientId"
                        value={oauthClientId}
                        onChange={(e) => setOauthClientId(e.target.value)}
                        placeholder="Optional: Client ID for OAuth flow"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientSecret" className="text-xs font-medium">OAuth Client Secret</Label>
                      <Input
                        id="clientSecret"
                        type="password"
                        value={oauthClientSecret}
                        onChange={(e) => setOauthClientSecret(e.target.value)}
                        placeholder="Optional: Client Secret for OAuth flow"
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Custom Headers (e.g. API Keys)</Label>
                      <div className="space-y-2">
                        {customHeaders.map((header, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              placeholder="Key (e.g. X-API-Key)"
                              value={header.key}
                              onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                              className="h-8 text-sm flex-1"
                            />
                            <Input
                              placeholder="Value"
                              value={header.value}
                              onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                              className="h-8 text-sm flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveHeader(index)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddHeader}
                          className="w-full h-8 text-xs gap-1"
                          type="button"
                        >
                          <Plus className="h-3 w-3" /> Add Header
                        </Button>
                      </div>
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
                    <KortixLoader customSize={16} className="mr-1" />
                    Adding MCP Server...
                  </>
                ) : (
                  `Add MCP Server (${selectedTools.size} tools)`
                )}
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
                    <KortixLoader customSize={20} className="mr-1" />
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