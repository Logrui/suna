'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

export default function MCPSuccessPage() {
    const [messageSent, setMessageSent] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'syncing' | 'done' | 'no-opener'>('syncing');

    const sendMessage = useCallback(() => {
        try {
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage(
                    { type: 'mcp-oauth-success', timestamp: Date.now() },
                    window.location.origin
                );
                setMessageSent(true);
                console.log('[MCP Success] postMessage sent to parent window');
                return true;
            } else {
                console.warn('[MCP Success] No opener window found — parent may not update automatically');
                setSyncStatus('no-opener');
                return false;
            }
        } catch (err) {
            console.warn('[MCP Success] Could not send postMessage to opener:', err);
            setSyncStatus('no-opener');
            return false;
        }
    }, []);

    useEffect(() => {
        // 1. Notify parent window that OAuth completed successfully
        //    The parent (mcp-configuration-new.tsx) listens for this message
        //    to auto-refresh the MCP card state from "Configure" → "Connected"
        const sent = sendMessage();

        // 2. Retry sending after a brief delay — the parent listener may not
        //    be ready if the modal was in the background during the OAuth redirect
        const retryTimer = setTimeout(() => {
            sendMessage();
        }, 500);

        // 3. Mark done and auto-close after giving time for sync
        const doneTimer = setTimeout(() => {
            if (sent) setSyncStatus('done');
        }, 2000);

        const closeTimer = setTimeout(() => {
            window.close();
        }, 3500);

        return () => {
            clearTimeout(retryTimer);
            clearTimeout(doneTimer);
            clearTimeout(closeTimer);
        };
    }, [sendMessage]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
            <div className="relative">
                {/* Premium Glow Effect */}
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />

                <div className="relative flex flex-col items-center text-center space-y-6 max-w-sm">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xl animate-enter">
                        <CheckCircle2 className="h-10 w-10 text-primary" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-balance">
                            Authentication Successful!
                        </h1>
                        <p className="text-muted-foreground leading-relaxed italic">
                            Your MCP server has been successfully connected.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                        {syncStatus === 'done' ? (
                            <CheckCircle2 className="h-4 w-4" />
                        ) : (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        <span className="text-sm font-medium">
                            {syncStatus === 'done'
                                ? 'Synced! Closing...'
                                : syncStatus === 'no-opener'
                                    ? 'Please refresh the parent page'
                                    : 'Syncing with parent window...'}
                        </span>
                    </div>

                    {syncStatus === 'no-opener' && (
                        <p className="text-xs text-muted-foreground max-w-[280px]">
                            The parent window couldn&apos;t be reached. Please close this popup and refresh the integrations page to see your connected server.
                        </p>
                    )}

                    <button
                        onClick={() => window.close()}
                        className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors pt-4"
                    >
                        Close now
                    </button>
                </div>
            </div>
        </div>
    );
}
