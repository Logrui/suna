'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, ExternalLink, Maximize2, Minimize2, AlertCircle, RefreshCw, CheckCircle2, GitBranch, Circle, Database, Save, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { KortixLoader } from '@/components/ui/kortix-loader';
import type { WorkflowStatus, WorkflowMode } from '@/hooks/workflows';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    useAdvancedWorkflowsBridgeStore,
    ADVANCED_WORKFLOWS_MESSAGE_TYPES,
    type AdvancedWorkflowsMessage,
} from '@/stores/workflows';
import { ComposioConnectionsSection } from '@/components/agents/composio/composio-connections-section';

// Backend API URL - NEXT_PUBLIC_BACKEND_URL includes /v1 suffix
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface AdvancedWorkflowEditorProps {
    agentId: string;
    workflowId: string;
    workflowName?: string;
    workflowStatus?: WorkflowStatus;
    workflowMode?: WorkflowMode;
    onWorkflowNameChange?: (name: string) => void;
    onSave?: () => void;
    isSaving?: boolean;
    hasUnsavedChanges?: boolean;
}

interface AdvancedWorkflowsSession {
    access_token: string;
    refresh_token?: string;
    advanced_workflows_url: string;
    flow_url: string;  // Direct URL to the flow editor
    project_id: string;  // Langflow project ID (same as Suna agent ID)
    flow_id: string;  // Langflow flow ID (same as Suna workflow ID)
    project_created: boolean;  // True if project was newly created
    flow_created: boolean;  // True if flow was newly created
    expires_in: number;
}

// Helper functions for status and mode badges
function getStatusBadgeVariant(status?: WorkflowStatus): { className: string; label: string } {
    switch (status) {
        case 'active':
            return {
                className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
                label: 'Active'
            };
        case 'draft':
            return {
                className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
                label: 'Draft'
            };
        case 'paused':
            return {
                className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
                label: 'Paused'
            };
        case 'archived':
            return {
                className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
                label: 'Archived'
            };
        default:
            return {
                className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
                label: 'Unknown'
            };
    }
}

function getModeBadgeVariant(mode?: WorkflowMode): { className: string; label: string } {
    switch (mode) {
        case 'simple':
            return {
                className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                label: 'Simple'
            };
        case 'advanced':
            return {
                className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                label: 'Advanced'
            };
        case 'advanced-legacy':
            return {
                className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
                label: 'Advanced (Legacy)'
            };
        default:
            return {
                className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
                label: 'Unknown'
            };
    }
}

/**
 * AdvancedWorkflowEditor - Advanced Workflows iframe integration
 * 
 * This component embeds the Advanced Workflows editor inside Suna via iframe.
 * Authentication is handled via a token bridge where Suna's backend:
 * 1. Verifies the user's JWT
 * 2. Exchanges it for an Advanced Workflows session
 * 3. Ensures project (agent) and flow (workflow) exist with 1:1 ID mapping
 * 4. Returns token and direct flow URL for iframe
 */
export function AdvancedWorkflowEditor({
    agentId,
    workflowId,
    workflowName,
    workflowStatus,
    workflowMode,
    onWorkflowNameChange,
    onSave,
    isSaving = false,
    hasUnsavedChanges = false
}: AdvancedWorkflowEditorProps) {

    // Advanced Workflows integration state
    const [sessionData, setSessionData] = useState<AdvancedWorkflowsSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Initializing...');
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [iframeStatus, setIframeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [retryCount, setRetryCount] = useState(0);
    const [isEditingName, setIsEditingName] = useState(false);
    const [localName, setLocalName] = useState(workflowName || 'Untitled Advanced Workflow');
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const { session } = useAuth();

    // Sync local name with prop
    useEffect(() => {
        setLocalName(workflowName || 'Untitled Advanced Workflow');
    }, [workflowName]);

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1500; // 1.5s delay between retries

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Fetch session (with project/flow sync) on mount
    const fetchSession = useCallback(async (isManualRetry: boolean = false) => {
        let attempts = 0;
        const totalAttempts = isManualRetry ? 1 : MAX_RETRIES;

        console.log('[Advanced Workflows] Starting session fetch...', {
            agentId,
            workflowId,
            hasAccessToken: !!session?.access_token,
            isManualRetry
        });

        if (!session?.access_token) {
            console.error('[Advanced Workflows] Not authenticated - no access token');
            setLoadingMessage('Not authenticated');
            setError('Not authenticated');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        while (attempts < totalAttempts) {
            attempts++;
            setRetryCount(attempts);

            try {
                setLoadingMessage(`Connecting to Advanced Workflows...`);

                // Use the new /session endpoint with agent_id and workflow_id
                const params = new URLSearchParams({
                    agent_id: agentId,
                    workflow_id: workflowId,
                });

                const requestUrl = `${API_URL}/advanced-workflows/session?${params}`;
                console.log(`[Advanced Workflows] Fetch attempt ${attempts} from:`, requestUrl);

                setLoadingMessage(`Authenticating...`);
                const response = await fetch(requestUrl, {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                });

                console.log(`[Advanced Workflows] Attempt ${attempts} status:`, response.status);

                if (response.ok) {
                    setLoadingMessage('Syncing project and workflow...');
                    const data: AdvancedWorkflowsSession = await response.json();

                    console.log('[Advanced Workflows] Session data received:', {
                        flow_url: data.flow_url,
                        project_id: data.project_id,
                        flow_id: data.flow_id,
                    });

                    setSessionData(data);
                    setLoadingMessage('Loading Advanced Workflows editor...');
                    setLoading(false);
                    return; // Success!
                }

                // If the endpoint doesn't exist yet, don't keep retrying
                if (response.status === 404) {
                    setError('404 Response. Advanced Workflows integration may not be configured correctly. Backend session bridge required.');
                    break;
                }

                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Failed to get session (Status: ${response.status})`);

            } catch (err) {
                console.error(`[Advanced Workflows] Attempt ${attempts} failed:`, err);

                if (attempts < totalAttempts) {
                    setLoadingMessage(`Connection attempt failed. Retrying in ${RETRY_DELAY / 1000}s...`);
                    await sleep(RETRY_DELAY);
                } else {
                    // All retries exhausted or fatal error
                    if (err instanceof TypeError && err.message.includes('fetch')) {
                        setError('Network Error. Advanced Workflows Host unreachable. Failed to fetch session. Backend session bridge required.');
                    } else {
                        setError(err instanceof Error ? err.message : 'Unknown error');
                    }
                }
            }
        }

        setLoading(false);
    }, [session?.access_token, agentId, workflowId]);

    useEffect(() => {
        fetchSession();
    }, [fetchSession]);

    // ═══════════════════════════════════════════════════════════════════════
    // Advanced Workflows Bridge Store Integration
    // ═══════════════════════════════════════════════════════════════════════
    const {
        profileModalConfig,
        openProfileModal,
        closeProfileModal,
        setIframeRef: setBridgeIframeRef,
    } = useAdvancedWorkflowsBridgeStore();

    // Set iframe ref in bridge store for postMessage communication
    useEffect(() => {
        setBridgeIframeRef(iframeRef as React.RefObject<HTMLIFrameElement>);
    }, [setBridgeIframeRef]);

    // Listen for messages from iframe indicating iframe status AND bridge messages
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data as AdvancedWorkflowsMessage | { type: string;[key: string]: any };

            if (!message?.type) return;

            // ─────────────────────────────────────────────────────────────────
            // Bridge Messages (from Advanced Workflows iframe)
            // ─────────────────────────────────────────────────────────────────
            if (message.type === ADVANCED_WORKFLOWS_MESSAGE_TYPES.OPEN_PROFILE_MODAL) {
                console.log('[AdvancedWorkflowEditor] Received OPEN_PROFILE_MODAL from iframe', message.payload);
                openProfileModal(
                    (message as AdvancedWorkflowsMessage).payload?.toolkit,
                    (message as AdvancedWorkflowsMessage).payload?.source as string | undefined
                );
                return;
            }

            // ─────────────────────────────────────────────────────────────────
            // Legacy iframe status messages
            // ─────────────────────────────────────────────────────────────────
            // In production, we should validate origin against ADVANCED_WORKFLOWS_FRONTEND_URL
            if (message.type === 'advanced-workflows:ready') {
                console.log('Advanced Workflows iframe ready');
                setIframeStatus('ready');
            }
            if (message.type === 'advanced-workflows:error') {
                console.error('Advanced Workflows error:', event.data.error);
                setIframeStatus('error');
            }
            if (message.type === 'advanced-workflows:flowSaved') {
                console.log('Flow saved:', event.data.flowId);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [openProfileModal]);

    // Fullscreen handling
    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!isFullscreen) {
            containerRef.current.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Handle iframe load events
    const handleIframeLoad = () => {
        console.log('Advanced Workflows iframe DOM loaded, waiting for application ready signal...');
        // Set a fallback timeout to dismiss the loader if the 'ready' message is not received
        // This handles the case where the Advanced Workflows frontend doesn't have postMessage integration
        setTimeout(() => {
            setIframeStatus(prev => {
                if (prev === 'loading') {
                    console.log('Advanced Workflows iframe ready (fallback timeout)');
                    return 'ready';
                }
                return prev;
            });
        }, 3500); // 3.5s fallback delay
    };

    const handleIframeError = () => {
        setIframeStatus('error');
    };

    // Build iframe URL using the direct flow_url with token
    // This takes the user directly to their specific flow (1:1 mapping)
    // suna_token is passed separately to allow Langflow to call Suna's API directly (e.g., for Composio profiles)
    const iframeSrc = sessionData
        ? `${sessionData.flow_url}?token=${encodeURIComponent(sessionData.access_token)}${sessionData.refresh_token ? `&refresh_token=${encodeURIComponent(sessionData.refresh_token)}` : ''}${session?.access_token ? `&suna_token=${encodeURIComponent(session.access_token)}` : ''}`
        : null;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">{loadingMessage}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-background">
                <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
                    <AlertCircle className="h-12 w-12 text-orange-500" />
                    <h2 className="text-xl font-semibold">Advanced Workflows Editor Connection Failed - Please try again</h2>
                    <p className="text-muted-foreground">{error}</p>
                    <div className="mt-4 p-4 bg-muted rounded-lg text-left w-full">
                        <p className="text-sm font-medium mb-2">For Server Admins: To enable the new Advanced Workflows Editor:</p>
                        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                            <li>Deploy Advanced Workflows service</li>
                            <li>Configure ADVANCED_WORKFLOWS_BACKEND_URL in Kortix Backend .env.local</li>
                            <li>Configure ADVANCED_WORKFLOWS_FRONTEND_URL in Kortix Backend .env.local</li>
                            <li>Configure ADVANCED_WORKFLOWS_INTEGRATION_SECRET in Kortix Backend .env.local</li>
                            <li>Restart Kortix Server</li>
                        </ol>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Button onClick={() => fetchSession(true)} variant="outline" size="sm">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry Connection
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                        Use the "Advanced (Legacy)" tab to access the legacy workflow editor.
                    </p>
                </div>
            </div>
        );
    }

    const statusBadge = getStatusBadgeVariant(workflowStatus);
    const modeBadge = getModeBadgeVariant(workflowMode);

    return (
        <div className="flex flex-col h-full max-h-full">
            {/* Header Controls */}
            <div className="flex items-center justify-between border-b px-6 py-2 bg-background/50 backdrop-blur-sm">
                {/* Left section - Badge and status */}
                <div className="flex items-center gap-4 flex-1">
                    <Badge variant="outline" className="border-white/50 text-white dark:text-white">
                        Kortix Advanced Workflows
                    </Badge>
                    {iframeStatus === 'loading' && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading editor...
                        </div>
                    )}
                    {iframeStatus === 'ready' && (
                        <span className="text-xs text-green-600 dark:text-green-400">● Connected</span>
                    )}
                    {iframeStatus === 'error' && (
                        <span className="text-xs text-red-500">● Connection Error</span>
                    )}
                </div>

                {/* Center section - Editable workflow name */}
                <div className="flex items-center justify-center flex-1">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <GitBranch className="h-4 w-4 text-primary" />
                        </div>
                        {isEditingName ? (
                            <Input
                                ref={nameInputRef}
                                value={localName}
                                onChange={(e) => setLocalName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsEditingName(false);
                                        onWorkflowNameChange?.(localName);
                                    }
                                    if (e.key === 'Escape') {
                                        setIsEditingName(false);
                                        setLocalName(workflowName || 'Untitled Advanced Workflow');
                                    }
                                }}
                                onBlur={() => {
                                    setIsEditingName(false);
                                    onWorkflowNameChange?.(localName);
                                }}
                                className="h-8 text-lg font-semibold bg-transparent border-primary/30 focus:border-primary w-64 text-center"
                                autoFocus
                            />
                        ) : (
                            <h1
                                className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
                                onClick={() => {
                                    setIsEditingName(true);
                                    // Focus input after state update
                                    setTimeout(() => nameInputRef.current?.focus(), 0);
                                }}
                                title="Click to edit workflow name"
                            >
                                {localName}
                            </h1>
                        )}
                    </div>
                </div>

                {/* Right section - Action buttons */}
                <div className="flex items-center gap-2 flex-1 justify-end">
                    {/* Save Workflow button - matches simple workflow */}
                    {onSave && (
                        <Button
                            onClick={onSave}
                            disabled={isSaving}
                            size="sm"
                            className={cn(
                                "h-8 relative",
                                hasUnsavedChanges && !isSaving && "bg-orange-500 hover:bg-orange-600 text-white"
                            )}
                        >
                            {isSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="h-3.5 w-3.5" />
                            )}
                            {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Save Workflow'}
                            {/* Unsaved indicator dot */}
                            {hasUnsavedChanges && !isSaving && (
                                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-yellow-400 border-2 border-background animate-pulse" />
                            )}
                        </Button>
                    )}

                    {/* Refresh button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setIframeStatus('loading');
                            iframeRef.current?.contentWindow?.location.reload();
                        }}
                        title="Refresh editor"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>

                    {/* Open in new tab button */}
                    {iframeSrc && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(iframeSrc, '_blank')}
                            title="Open in new tab"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    )}

                    {/* Fullscreen toggle */}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleFullscreen}
                        className="bg-background/80 backdrop-blur-sm"
                        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="h-4 w-4" />
                        ) : (
                            <Maximize2 className="h-4 w-4" />
                        )}
                    </Button>

                    {/* Toggle Sidebar Button */}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowSidebar(!showSidebar)}
                        title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                    >
                        {showSidebar ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </Button>
                </div>
            </div>

            {/* Advanced Workflows iframe - replaces WorkflowCanvas, NodePalette, PropertiesPanel */}
            <div ref={containerRef} className="flex-1 overflow-hidden relative flex">
                <div className={cn(
                    "flex-1 transition-all duration-200 relative",
                    showSidebar ? "mr-80" : ""
                )}>
                    {iframeStatus === 'loading' && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
                            <div className="flex flex-col items-center gap-4">
                                <KortixLoader size="large" />
                                <p className="text-sm text-muted-foreground animate-pulse font-medium">{loadingMessage}</p>
                            </div>
                        </div>
                    )}
                    {iframeSrc ? (
                        <iframe
                            ref={iframeRef}
                            src={iframeSrc}
                            className="w-full h-full border-0"
                            allow="clipboard-write; clipboard-read"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                            title="Advanced Workflows Editor"
                            onLoad={handleIframeLoad}
                            onError={handleIframeError}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-muted-foreground">No Kortix Advanced Workflows Server ConnectionURL configured</p>
                        </div>
                    )}
                </div>

                {/* Enhanced Sidebar for workflow metadata */}
                {showSidebar && (
                    <div className="absolute right-0 top-0 bottom-0 w-80 border-l border-border bg-card overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-border">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                Workflow Info
                            </h3>
                        </div>
                        <div className="p-4 text-sm space-y-5 overflow-auto flex-1">
                            {/* Database Information Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    <Circle className="h-2 w-2 fill-current" />
                                    Database State
                                </div>

                                {/* Workflow Name */}
                                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                                    <label className="text-xs text-muted-foreground">Workflow Name</label>
                                    <p className="font-medium">{workflowName || 'Untitled Workflow'}</p>
                                </div>

                                {/* Status */}
                                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                                    <label className="text-xs text-muted-foreground">Status</label>
                                    <div>
                                        <Badge
                                            variant="outline"
                                            className={cn("font-medium", statusBadge.className)}
                                        >
                                            {statusBadge.label}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Mode */}
                                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                                    <label className="text-xs text-muted-foreground">Workflow Mode</label>
                                    <div>
                                        <Badge
                                            variant="outline"
                                            className={cn("font-medium", modeBadge.className)}
                                        >
                                            {modeBadge.label}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Technical IDs Section */}
                            <div className="space-y-4 pt-2 border-t border-border/50">
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    <Circle className="h-2 w-2 fill-current" />
                                    Technical Details
                                </div>

                                <div>
                                    <label className="text-xs text-muted-foreground">Workflow ID</label>
                                    <p className="font-mono text-xs bg-muted/50 p-1.5 rounded mt-1 break-all">{workflowId}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Agent ID</label>
                                    <p className="font-mono text-xs bg-muted/50 p-1.5 rounded mt-1 break-all">{agentId}</p>
                                </div>
                            </div>

                            {/* Session Status Section */}
                            {sessionData && (
                                <div className="space-y-4 pt-2 border-t border-border/50">
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        <Circle className="h-2 w-2 fill-current" />
                                        Session Details
                                    </div>

                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="text-xs">
                                            {sessionData.project_created ? '✨ New Project' : '📁 Existing Project'}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="text-xs">
                                            {sessionData.flow_created ? '✨ New Flow' : '📄 Existing Flow'}
                                        </Badge>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                Composio Profile Management Modal
                Triggered via postMessage from Advanced Workflows iframe
            ═══════════════════════════════════════════════════════════════════ */}
            <Dialog
                open={profileModalConfig.open}
                onOpenChange={(open) => {
                    if (!open) {
                        closeProfileModal();
                    }
                }}
            >
                <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col pb-6 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Manage Composio Connections
                        </DialogTitle>
                        <DialogDescription>
                            {profileModalConfig.toolkit
                                ? `Manage your ${profileModalConfig.toolkit} connection profiles`
                                : 'Manage your Composio integration profiles and connections'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto -mx-6 px-6 py-2">
                        <ComposioConnectionsSection toolkit={profileModalConfig.toolkit ?? undefined} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
