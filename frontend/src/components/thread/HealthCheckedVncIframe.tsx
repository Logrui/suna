'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useVncPreloader } from '@/hooks/files';
import { getVncLiteUrl, getVncWebSocketUrl } from '@/lib/daytona/preview-client';

interface HealthCheckedVncIframeProps {
  sandbox: {
    id: string;
    vnc_preview: string;
    pass: string;
    token?: string;
  };
  className?: string;
}

export function HealthCheckedVncIframe({ sandbox, className }: HealthCheckedVncIframeProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  console.log('[VNC Component] Rendering with sandbox:', {
    id: sandbox.id,
    vnc_preview: sandbox.vnc_preview,
    has_pass: !!sandbox.pass,
    has_token: !!sandbox.token
  });

  // Use the enhanced VNC preloader hook
  const { status, retryCount, retry, isPreloaded, accessToken } = useVncPreloader(sandbox, {
    maxRetries: 5,
    initialDelay: 1000,
    timeoutMs: 5000
  });

  console.log('[VNC Component] Hook status:', {
    status,
    retryCount,
    isPreloaded,
    has_accessToken: !!accessToken
  });

  // VNC URL received but preloading in progress
  if (status === 'loading') {
    return (
      <div className={`overflow-hidden m-2 sm:m-4 relative ${className || ''}`}>
        <Card className="p-0 overflow-hidden border">
          <div className='relative w-full aspect-[4/3] sm:aspect-[5/3] md:aspect-[16/11] overflow-hidden bg-amber-50 dark:bg-amber-950/30 flex flex-col items-center justify-center'>
            <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-3" />
            <p className="text-sm font-medium text-center mb-2">Connecting to browser...</p>
            <p className="text-xs text-muted-foreground mb-2 text-center">
              Testing VNC connection
            </p>
            {retryCount > 0 && (
              <p className="text-xs text-amber-600 text-center">
                🔄 Attempt {retryCount + 1}/5
              </p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // VNC preload failed after retries
  if (status === 'error') {
    return (
      <div className={`overflow-hidden m-2 sm:m-4 relative ${className || ''}`}>
        <Card className="p-0 overflow-hidden border">
          <div className='relative w-full aspect-[4/3] sm:aspect-[5/3] md:aspect-[16/11] overflow-hidden bg-destructive/10 flex flex-col items-center justify-center'>
            <AlertCircle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm font-medium text-center mb-2">Connection Failed</p>
            <p className="text-xs text-muted-foreground mb-4 text-center">
              Unable to connect to VNC server after 5 attempts
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isPreloaded) {
    console.log('[VNC Component] Rendering iframe (preload complete)');

    return (
      <div className={`overflow-hidden m-2 sm:m-4 relative ${className || ''}`}>
        <Card className="p-0 overflow-hidden border">
          <div className='relative w-full aspect-[4/3] sm:aspect-[5/3] md:aspect-[16/11] overflow-hidden bg-gray-100 dark:bg-gray-800'>
            {iframeError && (
              <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs p-2 z-10">
                ⚠️ iframe error: {iframeError}
              </div>
            )}
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700 z-5">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-600 mb-2 mx-auto" />
                  <p className="text-xs text-gray-600">Loading VNC client...</p>
                </div>
              </div>
            )}
            <iframe
              key={iframeKey}
              onLoad={() => {
                console.log('[VNC Component] ✅ iframe onLoad event fired');
                setIframeLoaded(true);
                setIframeError(null);
              }}
              onError={(e) => {
                console.error('[VNC Component] ❌ iframe onError event fired:', e);
                setIframeError('Failed to load VNC client');
                setIframeLoaded(false);
              }}
              src={(() => {
                // Use direct Daytona connection (bypasses Next.js rewrites)
                // Pattern: Same as realtime-client.ts for Supabase WebSocket connections
                // Connects directly to: https://6080-{sandbox-id}.proxy.daytona.works/

                const vncUrl = getVncLiteUrl(sandbox);
                const wsUrl = getVncWebSocketUrl(sandbox);

                console.log('[VNC Component] 🚀 Using direct Daytona connection');
                console.log('[VNC Component] VNC URL:', vncUrl);
                console.log('[VNC Component] WebSocket will connect to:', wsUrl);
                console.log('[VNC Component] Bypassing Next.js rewrites ✅');

                return vncUrl;
              })()}
              title="Browser preview"
              className="absolute inset-0 w-full h-full border-0 md:w-[102%] md:h-[130%] md:-translate-y-[4.4rem] lg:-translate-y-[4.7rem] xl:-translate-y-[5.4rem] md:left-0 md:-translate-x-2"
              allow="fullscreen"
              sandbox="allow-same-origin allow-scripts allow-forms allow-modals"
            />
          </div>
        </Card>
      </div>
    );
  }

  // Should not reach here
  return null;
}
