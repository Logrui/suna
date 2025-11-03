import { createBrowserClient } from '@supabase/ssr'

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
 * connects directly to the Supabase backend (localhost:8888 or production Supabase).
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
  // Always connect directly to Supabase backend for WebSocket connections
  const directSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8888'

  return createBrowserClient(
    directSupabaseUrl,
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
}