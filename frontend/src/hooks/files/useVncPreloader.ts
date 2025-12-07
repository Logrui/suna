import { useEffect, useRef, useCallback, useState } from 'react';
import { Project } from '@/lib/api/projects';
import { getVncLiteUrl } from '@/lib/daytona/preview-client';

export type VncStatus = 'idle' | 'loading' | 'ready' | 'error';

interface VncPreloaderOptions {
  maxRetries?: number;
  initialDelay?: number;
  timeoutMs?: number;
}

interface VncPreloaderResult {
  status: VncStatus;
  retryCount: number;
  retry: () => void;
  isPreloaded: boolean;
  preloadedIframe: HTMLIFrameElement | null;
  accessToken: string | null;
}

export function useVncPreloader(
  sandbox: { id?: string; vnc_preview?: string; pass?: string; token?: string } | null,
  options: VncPreloaderOptions = {}
): VncPreloaderResult {
  const { maxRetries = 5, initialDelay = 1000, timeoutMs = 5000 } = options;

  const [status, setStatus] = useState<VncStatus>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const preloadedIframeRef = useRef<HTMLIFrameElement | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRetryingRef = useRef(false);

  const startPreloading = useCallback((vncUrl: string) => {
    // Prevent multiple simultaneous preload attempts
    if (isRetryingRef.current || status === 'ready') {
      console.log('[VNC Preloader] Skipping preload:', { isRetrying: isRetryingRef.current, status });
      return;
    }

    console.log('[VNC Preloader] Starting preload:', {
      url: vncUrl,
      retryCount,
      maxRetries,
      timeoutMs
    });

    setStatus('loading');
    isRetryingRef.current = true;

    // Create hidden iframe for preloading
    const iframe = document.createElement('iframe');
    iframe.src = vncUrl;
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '1440px';
    iframe.style.height = '900px';
    iframe.style.border = '0';
    iframe.title = 'VNC Preloader';

    // Set a timeout to detect if iframe fails to load (for 502 errors)
    const loadTimeout = setTimeout(() => {
      console.log('[VNC Preloader] Load timeout reached after', timeoutMs, 'ms');

      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }

      // Retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        isRetryingRef.current = false;

        // Exponential backoff: 2s, 3s, 4.5s, 6.75s, etc. (max 10s)
        const delay = Math.min(2000 * Math.pow(1.5, retryCount), 10000);
        console.log(`🔄 VNC preload failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);

        retryTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          startPreloading(vncUrl);
        }, delay);
      } else {
        console.error(`❌ VNC preload failed after ${maxRetries} attempts`);
        setStatus('error');
        isRetryingRef.current = false;
      }
    }, timeoutMs);

    // Handle successful iframe load
    iframe.onload = () => {
      clearTimeout(loadTimeout);
      console.log('✅ VNC preloaded successfully');
      setStatus('ready');
      setRetryCount(0);
      isRetryingRef.current = false;
      preloadedIframeRef.current = iframe;
    };

    // Handle iframe load errors
    iframe.onerror = (event) => {
      clearTimeout(loadTimeout);
      console.error('[VNC Preloader] iframe.onerror triggered:', event);

      // Clean up current iframe
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }

      // Retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        isRetryingRef.current = false;

        const delay = Math.min(2000 * Math.pow(1.5, retryCount), 10000);
        console.log(`🔄 VNC preload error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);

        retryTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          startPreloading(vncUrl);
        }, delay);
      } else {
        console.error(`❌ VNC preload failed after ${maxRetries} attempts (onerror)`);
        setStatus('error');
        isRetryingRef.current = false;
      }
    };

    // Add to DOM to start loading
    console.log('[VNC Preloader] Adding iframe to DOM');
    document.body.appendChild(iframe);
  }, [status, retryCount, maxRetries, timeoutMs]);

  const retry = useCallback(() => {
    if (sandbox?.id && sandbox?.pass) {
      // Use direct Daytona connection (bypasses Next.js rewrites)
      const vncUrl = getVncLiteUrl(sandbox as { id: string; pass: string; token?: string });
      console.log('[VNC Preloader] Using direct Daytona connection for retry');
      setRetryCount(0);
      setStatus('idle');
      startPreloading(vncUrl);
    }
  }, [sandbox?.id, sandbox?.pass, sandbox?.token, startPreloading]);

  useEffect(() => {
    console.log('[VNC Preloader] Effect triggered with sandbox:', {
      has_id: !!sandbox?.id,
      sandbox_id: sandbox?.id,
      has_pass: !!sandbox?.pass,
      has_token: !!sandbox?.token,
      current_status: status
    });

    // Reset status when sandbox changes
    if (!sandbox?.id || !sandbox?.pass) {
      console.log('[VNC Preloader] Missing sandbox id or pass, resetting to idle');
      setStatus('idle');
      setRetryCount(0);
      return;
    }

    // Don't restart if already in progress or ready
    if (status === 'loading' || status === 'ready') {
      console.log('[VNC Preloader] Already loading or ready, skipping');
      return;
    }

    // Use direct Daytona connection (bypasses Next.js rewrites)
    const vncUrl = getVncLiteUrl(sandbox as { id: string; pass: string; token?: string });
    console.log('[VNC Preloader] Constructed preload URL (direct Daytona):', vncUrl);
    console.log('[VNC Preloader] Using direct connection, bypassing Next.js rewrites ✅');

    // Reset retry counter for new sandbox
    setRetryCount(0);
    isRetryingRef.current = false;

    // Start the preloading process with a small delay to let the sandbox initialize
    const initialDelayTimeout = setTimeout(() => {
      startPreloading(vncUrl);
    }, initialDelay);

    // Cleanup function
    return () => {
      clearTimeout(initialDelayTimeout);

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (preloadedIframeRef.current && preloadedIframeRef.current.parentNode) {
        preloadedIframeRef.current.parentNode.removeChild(preloadedIframeRef.current);
        preloadedIframeRef.current = null;
      }

      isRetryingRef.current = false;
    };
  }, [sandbox?.id, sandbox?.pass, sandbox?.token, startPreloading, initialDelay, status]);

  // Fetch auth token for private project access
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        console.log('[VNC Preloader] Fetching auth token...');
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          console.log('[VNC Preloader] ✅ Got auth token');
          setAccessToken(session.access_token);
        } else {
          console.log('[VNC Preloader] No auth session found (public access mode)');
        }
      } catch (err) {
        console.error('[VNC Preloader] Failed to fetch auth token:', err);
      }
    };

    fetchToken();
  }, []);

  return {
    status,
    retryCount,
    retry,
    isPreloaded: status === 'ready',
    preloadedIframe: preloadedIframeRef.current,
    accessToken
  };
}