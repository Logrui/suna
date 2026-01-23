'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useRegisterBrowser } from '@/hooks/browser/use-user-browsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Monitor, Check, X, Loader2, ExternalLink, RefreshCw, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ========== Types ==========

interface ExtensionStatus {
    type: 'KORTIX_EXTENSION_STATUS';
    installed: boolean;
    connected: boolean;
    extensionId: string | null;
}

interface ConnectionResult {
    type: 'KORTIX_EXTENSION_CONNECTED';
    success: boolean;
    error?: string;
}

type PageState = 'checking' | 'not_installed' | 'not_logged_in' | 'ready' | 'connecting' | 'success' | 'already_connected' | 'error';

// ========== Component ==========

export default function ConnectBrowserPage() {
    const { user, isLoading: authLoading } = useAuth();
    const registerBrowser = useRegisterBrowser();
    const router = useRouter();

    const [pageState, setPageState] = useState<PageState>('checking');
    const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [browserName, setBrowserName] = useState<string>('');

    // Listen for extension messages
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Accept messages from same origin OR from content scripts (origin matches page)
            if (event.origin !== window.location.origin) return;

            const data = event.data;
            if (data?.type === 'KORTIX_EXTENSION_STATUS') {
                setExtensionStatus(data);

                if (data.installed) {
                    if (data.connected) {
                        // Extension thinks it's connected, but DB entry may have been deleted
                        // Show "already connected" state with option to reconnect
                        setPageState('already_connected');
                    } else if (user) {
                        setPageState('ready');
                    } else {
                        setPageState('not_logged_in');
                    }
                } else {
                    setPageState('not_installed');
                }
            }

            if (data?.type === 'KORTIX_EXTENSION_CONNECTED') {
                if (data.success) {
                    setPageState('success');
                } else {
                    setPageState('error');
                    setErrorMessage(data.error || 'Connection failed');
                }
            }

            // Handle disconnect confirmation
            if (data?.type === 'KORTIX_EXTENSION_DISCONNECTED') {
                // Extension has been disconnected, show ready state
                setPageState('ready');
            }
        };

        window.addEventListener('message', handleMessage);

        // Fallback timer: if no extension found after 3 seconds
        const fallbackTimer = setTimeout(() => {
            if (!extensionStatus) {
                setPageState('not_installed');
            }
        }, 3000);

        return () => {
            window.removeEventListener('message', handleMessage);
            clearTimeout(fallbackTimer);
        };
    }, [extensionStatus, user]);

    // Initial status request - only runs on mount
    useEffect(() => {
        const requestStatus = () => {
            window.postMessage({ type: 'KORTIX_CHECK_EXTENSION' }, window.location.origin);
        };

        // Request immediately and after 1s to be sure
        requestStatus();
        const timer = setTimeout(requestStatus, 1000);

        return () => clearTimeout(timer);
    }, []);

    // Update state when auth changes
    useEffect(() => {
        if (!authLoading && extensionStatus?.installed) {
            if (user) {
                if (extensionStatus.connected) {
                    setPageState('already_connected');
                } else {
                    setPageState('ready');
                }
            } else {
                setPageState('not_logged_in');
            }
        }
    }, [authLoading, user, extensionStatus]);

    // Handle connect button
    const handleConnect = async () => {
        if (!extensionStatus?.extensionId || !user) return;

        setPageState('connecting');

        try {
            // Register browser with backend and get token
            const result = await registerBrowser.mutateAsync({
                extensionId: extensionStatus.extensionId,
                browserInfo: {
                    browser: navigator.userAgent,
                    os: navigator.platform,
                },
                name: browserName.trim() || undefined,
            });

            // Send token to extension via postMessage
            window.postMessage({
                type: 'KORTIX_BROWSER_TOKEN',
                token: result.token,
                browserInfo: {
                    name: `${navigator.platform} Browser`,
                    browser: navigator.userAgent,
                    os: navigator.platform,
                },
            }, window.location.origin);

        } catch (error) {
            setPageState('error');
            setErrorMessage(error instanceof Error ? error.message : 'Registration failed');
        }
    };

    // Handle reconnect button - tells extension to disconnect and shows ready state
    const handleReconnect = () => {
        // Tell extension to disconnect
        window.postMessage({ type: 'KORTIX_DISCONNECT_EXTENSION' }, window.location.origin);
        // Show ready state immediately (extension may or may not respond)
        setPageState('ready');
        setBrowserName('');
    };

    // Get browser details for display
    const getBrowserDetails = () => {
        const ua = navigator.userAgent;
        let browserName = 'Unknown Browser';
        let osName = navigator.platform;

        if (ua.includes('Chrome')) browserName = 'Chrome';
        else if (ua.includes('Firefox')) browserName = 'Firefox';
        else if (ua.includes('Safari')) browserName = 'Safari';
        else if (ua.includes('Edge')) browserName = 'Edge';

        return { browserName, osName };
    };

    const browserDetails = getBrowserDetails();

    // ========== Render ==========

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Main Card */}
                <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/80 backdrop-blur-sm">
                    {/* Header */}
                    <div className="p-6 pb-4 border-b border-border/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                <Monitor className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-medium tracking-tight">Connect Browser</h1>
                                <p className="text-sm text-muted-foreground">
                                    Link your browser to Kortix
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Checking */}
                        {pageState === 'checking' && (
                            <div className="flex flex-col items-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
                                <p className="text-sm text-muted-foreground">Looking for extension...</p>
                            </div>
                        )}

                        {/* Not Installed */}
                        {pageState === 'not_installed' && (
                            <div className="flex flex-col items-center py-6">
                                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                                    <Monitor className="w-6 h-6 text-amber-500" />
                                </div>
                                <h2 className="font-medium mb-2">Extension Required</h2>
                                <p className="text-sm text-muted-foreground text-center mb-6">
                                    The Kortix Browser Operator is required to connect your personal browser session.
                                </p>

                                {process.env.NEXT_PUBLIC_EXTENSION_DOWNLOAD_URL ? (
                                    <div className="w-full space-y-4">
                                        <Button asChild className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                                            <a
                                                href={process.env.NEXT_PUBLIC_EXTENSION_DOWNLOAD_URL}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="gap-2"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Download Extension (.zip)
                                            </a>
                                        </Button>
                                        <p className="text-[10px] text-center text-muted-foreground px-4">
                                            Download the ZIP, extract it, and go to <code className="bg-muted px-1 rounded">chrome://extensions</code> to load the unpacked extension.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="w-full space-y-4">
                                        <div className="p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
                                            <p className="text-xs font-medium mb-1">Local / Manual Setup</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                No download link configured. Please build the extension from the repository and load it manually.
                                            </p>
                                        </div>
                                        <Button variant="outline" asChild className="w-full">
                                            <a
                                                href="https://github.com/Logrui/suna/tree/main/packages/kortix-chrome-extension#self-hosted-windows--cloudflare-tunnels"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="gap-2"
                                            >
                                                <Info className="w-4 h-4" />
                                                View Setup Guide
                                            </a>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Not Logged In */}
                        {pageState === 'not_logged_in' && (
                            <div className="flex flex-col items-center py-6">
                                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                                    <Monitor className="w-6 h-6 text-blue-500" />
                                </div>
                                <h2 className="font-medium mb-2">Sign In Required</h2>
                                <p className="text-sm text-muted-foreground text-center mb-6">
                                    Please sign in to connect your browser
                                </p>
                                <Button asChild>
                                    <a href="/auth">Sign In</a>
                                </Button>
                            </div>
                        )}

                        {/* Ready to Connect */}
                        {pageState === 'ready' && (
                            <div className="flex flex-col items-center py-6">
                                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                    <Check className="w-6 h-6 text-green-500" />
                                </div>
                                <h2 className="font-medium mb-2">Ready to Connect</h2>
                                <p className="text-sm text-muted-foreground text-center mb-4">
                                    Extension detected! Give your browser a name and connect.
                                </p>

                                {/* Browser details */}
                                <div className="w-full mb-4 p-3 rounded-lg bg-muted/50 border border-border/50">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Info className="w-3 h-3" />
                                        <span>{browserDetails.browserName} on {browserDetails.osName}</span>
                                    </div>
                                    {extensionStatus?.extensionId && (
                                        <div className="text-xs text-muted-foreground/60 mt-1 font-mono truncate">
                                            ID: {extensionStatus.extensionId.slice(0, 16)}...
                                        </div>
                                    )}
                                </div>

                                <div className="w-full space-y-3 mb-6">
                                    <Input
                                        placeholder="e.g., LivingRoom, MainRig, Work Laptop"
                                        value={browserName}
                                        onChange={(e) => setBrowserName(e.target.value)}
                                        className="text-center"
                                    />
                                </div>
                                <Button
                                    onClick={handleConnect}
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                                >
                                    Connect Browser
                                </Button>
                            </div>
                        )}

                        {/* Connecting */}
                        {pageState === 'connecting' && (
                            <div className="flex flex-col items-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
                                <p className="text-sm text-muted-foreground">Connecting...</p>
                            </div>
                        )}

                        {/* Already Connected (extension reports connected but may need reconnect) */}
                        {pageState === 'already_connected' && (
                            <div className="flex flex-col items-center py-6">
                                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                    <Check className="w-6 h-6 text-green-500" />
                                </div>
                                <h2 className="font-medium mb-2">Browser Already Connected</h2>
                                <p className="text-sm text-muted-foreground text-center mb-4">
                                    This browser extension is already linked to Kortix.
                                </p>

                                {/* Browser details */}
                                <div className="w-full mb-6 p-3 rounded-lg bg-muted/50 border border-border/50">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Info className="w-3 h-3" />
                                        <span>{browserDetails.browserName} on {browserDetails.osName}</span>
                                    </div>
                                    {extensionStatus?.extensionId && (
                                        <div className="text-xs text-muted-foreground/60 mt-1 font-mono truncate">
                                            ID: {extensionStatus.extensionId.slice(0, 16)}...
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <Button variant="outline" asChild>
                                        <a href="/dashboard">Go to Dashboard</a>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleReconnect}
                                        className="gap-2"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Reconnect
                                    </Button>
                                </div>

                                <p className="text-xs text-muted-foreground mt-4 text-center">
                                    If your browser was deleted, click Reconnect to register it again.
                                </p>
                            </div>
                        )}

                        {/* Success (newly connected) */}
                        {pageState === 'success' && (
                            <div className="flex flex-col items-center py-6">
                                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                    <Check className="w-6 h-6 text-green-500" />
                                </div>
                                <h2 className="font-medium mb-2">Browser Connected!</h2>
                                <p className="text-sm text-muted-foreground text-center mb-4">
                                    You can now use &quot;My Browser&quot; in your Kortix threads.
                                </p>

                                {/* Browser details */}
                                <div className="w-full mb-6 p-3 rounded-lg bg-muted/50 border border-border/50">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Info className="w-3 h-3" />
                                        <span>{browserDetails.browserName} on {browserDetails.osName}</span>
                                    </div>
                                    {browserName && (
                                        <div className="text-sm font-medium mt-1">
                                            &quot;{browserName}&quot;
                                        </div>
                                    )}
                                </div>

                                <Button variant="outline" asChild>
                                    <a href="/dashboard">Go to Dashboard</a>
                                </Button>
                            </div>
                        )}

                        {/* Error */}
                        {pageState === 'error' && (
                            <div className="flex flex-col items-center py-6">
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                                    <X className="w-6 h-6 text-red-500" />
                                </div>
                                <h2 className="font-medium mb-2">Connection Failed</h2>
                                <p className="text-sm text-muted-foreground text-center mb-6">
                                    {errorMessage || 'An error occurred while connecting'}
                                </p>
                                <Button onClick={() => setPageState('ready')}>
                                    Try Again
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground mt-6">
                    Your browser stays private. Agents only access tabs you approve.
                </p>
            </div>
        </div>
    );
}
