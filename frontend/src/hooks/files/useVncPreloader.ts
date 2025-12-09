import { useEffect, useRef, useCallback, useState } from 'react';
// feature-start: daytona-preview-bypass
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
  sandbox: { id: string; pass: string; token?: string; vnc_preview?: string } | null,
  options: VncPreloaderOptions = {}
): VncPreloaderResult {
  const { maxRetries = 5, initialDelay = 1000, timeoutMs = 5000 } = options;

  const [status, setStatus] = useState<VncStatus>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const preloadedIframeRef = useRef<HTMLIFrameElement | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRetryingRef = useRef(false);

  const startPreloading = useCallback((vncUrl: string) => {
    // Prevent multiple simultaneous preload attempts
    if (isRetryingRef.current || status === 'ready') {
      return;
    }

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
        console.log(`❌ VNC preload failed after ${maxRetries} attempts`);
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
    iframe.onerror = () => {
      clearTimeout(loadTimeout);

      // Clean up current iframe
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }

      // Retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        isRetryingRef.current = false;

        const delay = Math.min(2000 * Math.pow(1.5, retryCount), 10000);

        retryTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          startPreloading(vncUrl);
        }, delay);
      } else {
        setStatus('error');
        isRetryingRef.current = false;
      }
    };

    // Add to DOM to start loading
    document.body.appendChild(iframe);
  }, [status, retryCount, maxRetries, timeoutMs]);

  const retry = useCallback(() => {
    if (sandbox?.id && sandbox?.pass) {
      const vncUrl = getVncLiteUrl(sandbox);
      setRetryCount(0);
      setStatus('idle');
      startPreloading(vncUrl);
    }
  }, [sandbox?.id, sandbox?.pass, sandbox?.token, startPreloading]);

  useEffect(() => {
    if (!sandbox?.id || !sandbox?.pass) {
      setStatus('idle');
      setRetryCount(0);
      return;
    }

    // Don't restart if already in progress or ready
    if (status === 'loading' || status === 'ready') {
      return;
    }

    const vncUrl = getVncLiteUrl(sandbox);
    // console.log('[VNC Preloader] Constructed preload URL:', vncUrl);
    // console.log('[VNC Preloader] Using direct Daytona connection');

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
  }, [sandbox?.id, sandbox?.pass, startPreloading, initialDelay, status]);

  // Unused proxy auth logic removed
  const accessToken = null;

  return {
    status,
    retryCount,
    retry,
    isPreloaded: status === 'ready',
    preloadedIframe: preloadedIframeRef.current,
    accessToken
  };
}

// feature-end: daytona-preview-bypass