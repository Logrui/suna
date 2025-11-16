import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  // Use window.location.origin for browser requests so all Supabase API calls (auth, REST)
  // are proxied through Next.js rewrites at /auth/v1/*, /rest/v1/*
  // This ensures:
  // 1. OAuth flows use same origin (no HTTPS auto-upgrade issues)
  // 2. All requests route through Kong via Next.js (handles protocol translation)
  // 3. Works on both localhost:3000 and https://kortix.syhc.dev
  // 4. Avoids Kong's self-signed certificate validation errors
  //
  // NOTE: WebSocket connections for Realtime CANNOT be proxied through Next.js rewrites.
  // Use createRealtimeClient() for realtime subscriptions instead.
  const supabaseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8888'

  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: true,
    }
  )
}

/**
 * Create a separate Supabase client for Realtime subscriptions.
 * 
 * WebSocket connections cannot be proxied through Next.js rewrites, so this client
 * needs special handling:
 * 
 * - Browser (via Cloudflare Tunnel): Must connect to Kong directly via a separate URL
 * - Docker internal: Can use http://kong.kortix.syhc.dev (same as regular client)
 * - Local dev: Uses localhost:8888
 * 
 * Set NEXT_PUBLIC_REALTIME_URL to your Kong endpoint accessible from the browser:
 * - For Cloudflare Tunnel: https://kong-kortix.syhc.dev (or similar direct Kong route)
 * - For local: http://localhost:8888
 * 
 * Usage:
 * ```typescript
 * const realtimeClient = createRealtimeClient()
 * const channel = realtimeClient.channel('my-channel')
 *   .on('broadcast', { event: 'cursor' }, (payload) => {
 *     console.log(payload)
 *   })
 *   .subscribe()
 * ```
 * 
 * For auth-required channels, manually sync the access token:
 * ```typescript
 * const mainClient = createClient()
 * const { data: { session } } = await mainClient.auth.getSession()
 * const realtimeClient = createRealtimeClient()
 * 
 * // Set the access token from main client
 * if (session) {
 *   await realtimeClient.realtime.setAuth(session.access_token)
 * }
 * ```
 */
export function createRealtimeClient() {
  // For realtime, we need a URL that supports WebSocket upgrades from the browser
  // Option 1: NEXT_PUBLIC_REALTIME_URL (direct Kong URL accessible from browser)
  // Option 2: NEXT_PUBLIC_SUPABASE_URL (fallback, works for Docker internal)
  // Option 3: localhost:8888 (local dev default)
  const realtimeUrl = 
    process.env.NEXT_PUBLIC_REALTIME_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    'http://localhost:8888'

  // console.log('[createRealtimeClient] Configuration:', {
  //   NEXT_PUBLIC_REALTIME_URL: process.env.NEXT_PUBLIC_REALTIME_URL,
  //   NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  //   realtimeUrl,
  //   windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'SSR',
  //   note: 'WebSocket will attempt to upgrade at: ' + realtimeUrl + '/realtime/v1/websocket',
  // })

  // Use createSupabaseClient (from @supabase/supabase-js) instead of createBrowserClient
  // This gives us full control over the URL and doesn't override it with window.location.origin
  const client = createSupabaseClient(
    realtimeUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,    // Don't manage auth state - use main client for that
        autoRefreshToken: false,  // Don't refresh tokens - use main client's session
      },
      realtime: {
        params: {
          eventsPerSecond: 1000,
        },
      },
    }
  )

  // Add comprehensive WebSocket debugging
  if (typeof window !== 'undefined') {
    const wsUrl = realtimeUrl.replace(/^http/, 'ws') + '/realtime/v1/websocket'
    const wsProtocol = realtimeUrl.startsWith('https') ? 'wss://' : 'ws://'
    const expectedWsUrl = wsUrl.replace(/^ws:\/\//, wsProtocol).replace(/^wss:\/\//, wsProtocol)
    
    // console.log('[createRealtimeClient] WebSocket configuration:', {
    //   realtimeUrl,
    //   constructedWsUrl: wsUrl,
    //   expectedProtocol: wsProtocol,
    //   expectedFullUrl: expectedWsUrl,
    //   pageProtocol: window.location.protocol,
    //   shouldBeSecure: window.location.protocol === 'https:',
    // })

    // Hook into connection state changes via the connection state
    const checkConnection = () => {
      const state = (client.realtime as any).connection?.getState?.() || 'unknown';
      // console.log('[createRealtimeClient] Current connection state:', state);
      return state;
    };

    // Log initial state after a brief delay
    setTimeout(() => {
      const state = checkConnection();
      // console.log('[createRealtimeClient] Initial WebSocket state after creation:', state);
    }, 100);

    // Monitor for connection attempts by checking the internal connection object
    try {
      const realtime = client.realtime as any;
      
      // Try to access the underlying WebSocket connection for debugging
      if (realtime.conn) {
        // console.log('[createRealtimeClient] WebSocket connection object detected:', {
        //   hasConn: !!realtime.conn,
        //   connState: realtime.conn.readyState,
        // });
      }

      // Hook into the connection via channel subscriptions for state tracking
      const originalChannel = client.channel.bind(client);
      client.channel = (name: string, opts?: any) => {
        // console.log('[createRealtimeClient]  Creating channel:', name, opts);
        const channel = originalChannel(name, opts);
        
        // Override subscribe to log connection attempts
        const originalSubscribe = channel.subscribe.bind(channel);
        channel.subscribe = (callback?: any, timeout?: number) => {
          // console.log('[createRealtimeClient]  Subscribing to channel:', name);
          // console.log('[createRealtimeClient] WebSocket state before subscribe:', checkConnection());
          
          const result = originalSubscribe(callback, timeout);
          
          // Log state after subscribe attempt
          setTimeout(() => {
            // console.log('[createRealtimeClient] WebSocket state after subscribe:', checkConnection());
          }, 500);
          
          return result;
        };

        // Track channel state changes
        channel.on('system' as any, {} as any, (payload: any) => {
          // console.log('[createRealtimeClient] Channel system event:', { channel: name, payload });
        });

        return channel;
      };
    } catch (err) {
      console.warn('[createRealtimeClient] Could not attach advanced debug hooks:', err);
    }
  }

  // console.log('[createRealtimeClient] Client created, WebSocket will connect to:', realtimeUrl)

  return client
}
