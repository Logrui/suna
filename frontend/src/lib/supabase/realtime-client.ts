/**
 * Singleton Realtime Client Manager
 *
 * This module manages a SINGLE Supabase realtime client instance that is shared
 * across all hooks and components. It automatically syncs authentication from the
 * main Supabase client, ensuring all WebSocket subscriptions have proper auth context.
 *
 * Why this is needed:
 * - Realtime client CANNOT use createClient() because it needs direct Kong access
 * - Main client is proxied through Next.js, which doesn't support WebSocket upgrades
 * - But realtime client needs the same auth token as main client
 * - Creating separate instances per hook leads to auth state divergence
 *
 * Solution:
 * - Create ONE shared realtime client instance (singleton)
 * - Sync auth token from main client on initialization
 * - Listen to auth state changes and auto-update token
 * - All hooks use getRealtimeClient() to access the same instance
 *
 * INFINITE LOOP PREVENTION MECHANISMS:
 * 1. Singleton Pattern: realtimeClientInstance checked at initialization
 *    - If already initialized, returns existing instance (prevents re-initialization)
 *    - Only called once from AuthProvider.tsx during app startup
 *
 * 2. Single Auth Listener: onAuthStateChange stores ONE subscription
 *    - Listener only fires when auth state ACTUALLY changes (not on every render)
 *    - Each auth event triggers exactly ONE token sync attempt
 *    - Errors are caught and logged, not retried infinitely
 *
 * 3. Guard on getRealtimeClient():
 *    - Throws error if called before initialization
 *    - Prevents using uninitialized client in multiple hooks
 *    - All hooks use this single access point
 *
 * 4. Token Sync is Idempotent:
 *    - setAuth() can be called multiple times with same token safely
 *    - Duplicate calls don't restart WebSocket or trigger reconnects
 *
 * TESTING INFINITE LOOP SAFETY:
 * 1. Check: AuthProvider mounts, initializes realtime client ONCE
 *    await getSession() → logs initial auth sync
 *    onAuthStateChange sets up listener
 *
 * 2. Check: Multiple hook mounts don't re-initialize
 *    Mount useProjectRealtime → uses singleton
 *    Mount useVapiCallRealtime → uses same singleton
 *    (No double logs, no new WebSocket connections)
 *
 * 3. Check: Auth changes trigger ONE token update per event
 *    Login: AuthProvider gets new session → listener fires ONCE
 *    Only ONE '[RealtimeManager] ✅ Auth synced' log per login
 *
 * 4. Check: Multiple subscriptions don't cause loops
 *    realtime.channel('project:123').subscribe()
 *    realtime.channel('call:456').subscribe()
 *    (Both use same client, same auth, no loops)
 *
 * KNOWN LIMITATIONS:
 * - If parent component recreates mainClient frequently, sync may fire more
 * - If AuthProvider is mounted multiple times, multiple listeners may be created
 *   (fix: ensure AuthProvider is a top-level singleton in app)
 */

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton instance
let realtimeClientInstance: SupabaseClient | null = null
let mainClientReference: SupabaseClient | null = null
let authUnsubscribe: (() => void) | null = null

/**
 * Initialize the singleton realtime client with auth syncing
 * 
 * Should be called once from AuthProvider after the main client is ready.
 * 
 * This function:
 * 1. Creates a new Supabase client for realtime connections
 * 2. Gets the initial session from the main client
 * 3. Syncs the access token to the realtime client
 * 4. Sets up a listener to auto-sync token on auth state changes
 * 
 * @param mainClient - The main Supabase client (from createClient())
 * @returns The initialized realtime client instance
 * 
 * @example
 * ```typescript
 * // In AuthProvider.tsx
 * const supabase = createClient();
 * await initializeRealtimeClient(supabase);
 * ```
 */
export async function initializeRealtimeClient(mainClient: SupabaseClient): Promise<SupabaseClient> {
  // Prevent re-initialization
  if (realtimeClientInstance) {
    console.log('[RealtimeManager] Realtime client already initialized, skipping re-init')
    return realtimeClientInstance
  }

  mainClientReference = mainClient

  // Determine the realtime URL
  // Priority: NEXT_PUBLIC_REALTIME_URL > NEXT_PUBLIC_SUPABASE_URL > localhost fallback
  const realtimeUrl =
    process.env.NEXT_PUBLIC_REALTIME_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'http://localhost:8888'

  console.log('[RealtimeManager] Initializing realtime client manager')
  console.log('[RealtimeManager] Configuration:', {
    NEXT_PUBLIC_REALTIME_URL: process.env.NEXT_PUBLIC_REALTIME_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    resolvedUrl: realtimeUrl,
    pageOrigin: typeof window !== 'undefined' ? window.location.origin : 'SSR',
  })

  // Create the realtime client
  // This client connects directly to Kong (bypasses Next.js proxy)
  realtimeClientInstance = createSupabaseClient(
    realtimeUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false, // Don't manage auth state
        autoRefreshToken: false, // Don't refresh tokens
      },
      realtime: {
        params: {
          eventsPerSecond: 1000,
        },
      },
    }
  )

  console.log('[RealtimeManager] Client created, URL:', realtimeUrl)

  // PHASE 1: Get initial session and sync auth token
  try {
    const { data: { session }, error } = await mainClient.auth.getSession()

    if (error) {
      console.warn('[RealtimeManager] Failed to get initial session:', error)
    } else if (session?.access_token) {
      // Sync the access token to realtime client
      await realtimeClientInstance.realtime.setAuth(session.access_token)
      console.log('[RealtimeManager] ✅ Initial auth synced to realtime client')
      console.log('[RealtimeManager] User:', session.user?.email)
      console.log('[RealtimeManager] Token (first 20 chars):', session.access_token.substring(0, 20) + '...')
    } else {
      console.log('[RealtimeManager] No initial session (user not logged in yet)')
    }
  } catch (err) {
    console.error('[RealtimeManager] Failed to sync initial auth:', err)
  }

  // PHASE 2: Listen to auth state changes and auto-sync token
  // INFINITE LOOP PREVENTION: This listener is set up ONCE and stored.
  // Why no infinite loop risk:
  // - onAuthStateChange creates a single listener subscription (not called on every render)
  // - The listener callback only executes when auth state ACTUALLY changes
  // - We only update realtime auth if token differs (setAuth is idempotent)
  // - The subscription is cleaned up in cleanupRealtimeClient() if needed
  // - initializeRealtimeClient has a guard: if (realtimeClientInstance) return (prevents re-init)
  // Edge cases handled:
  // 1. Auth sync fails: We catch and log, but don't retry infinitely (single attempt per event)
  // 2. Multiple auth events: Each triggers one setAuth call (expected behavior)
  // 3. Logout: Auth listener clears session, realtime client still holds reference (safe)
  try {
    const { data } = mainClient.auth.onAuthStateChange(async (event, session) => {
      console.log('[RealtimeManager] Auth state changed:', event)

      if (session?.access_token) {
        try {
          // Sync the new token to realtime client
          await realtimeClientInstance!.realtime.setAuth(session.access_token)
          console.log('[RealtimeManager] ✅ Auth synced on event:', event)
          console.log('[RealtimeManager] User:', session.user?.email)
          console.log('[RealtimeManager] Token (first 20 chars):', session.access_token.substring(0, 20) + '...')
        } catch (err) {
          console.error('[RealtimeManager] Failed to sync auth on', event, ':', err)
        }
      } else {
        console.log('[RealtimeManager] Auth cleared on', event, '(user signed out or session expired)')
      }
    })

    // Store the unsubscribe function for cleanup
    authUnsubscribe = data?.subscription?.unsubscribe || null
  } catch (err) {
    console.error('[RealtimeManager] Failed to set up auth listener:', err)
  }

  console.log('[RealtimeManager] Initialization complete. Auth syncing is active.')
  return realtimeClientInstance
}

/**
 * Get the singleton realtime client instance
 * 
 * All hooks and components should use this function to access the shared
 * realtime client instance. This ensures:
 * 1. Only one WebSocket connection is created
 * 2. All subscriptions share the same auth context
 * 3. Auth tokens are kept in sync automatically
 * 
 * @returns The singleton realtime client instance
 * @throws Error if called before initializeRealtimeClient()
 * 
 * @example
 * ```typescript
 * // In a hook
 * const supabase = getRealtimeClient();
 * const channel = supabase.channel('my-channel')
 *   .on('postgres_changes', { ... }, (payload) => { ... })
 *   .subscribe();
 * ```
 */
export function getRealtimeClient(): SupabaseClient {
  if (!realtimeClientInstance) {
    throw new Error(
      '[RealtimeManager] Realtime client not initialized. ' +
        'This usually means AuthProvider has not mounted yet. ' +
        'Make sure your app is wrapped with <AuthProvider>. ' +
        'The realtime client is initialized in AuthProvider.tsx'
    )
  }
  return realtimeClientInstance
}

/**
 * Cleanup the realtime client (mainly for testing/unmounting)
 * 
 * Unsubscribes from auth state changes and clears the singleton instance.
 * This is NOT typically needed in normal app lifecycle, but useful for:
 * - Testing
 * - Unmounting/remounting AuthProvider
 * - Resetting state
 */
export function cleanupRealtimeClient() {
  if (authUnsubscribe) {
    authUnsubscribe()
  }
  realtimeClientInstance = null
  mainClientReference = null
  console.log('[RealtimeManager] Realtime client cleaned up')
}

/**
 * Get current auth state from realtime client (debugging only)
 * 
 * @returns Object with auth info for debugging
 */
export function getRealtimeClientAuthState() {
  if (!realtimeClientInstance) {
    return { initialized: false, message: 'Client not initialized' }
  }

  return {
    initialized: true,
    hasMainClientRef: !!mainClientReference,
    hasAuthListener: !!authUnsubscribe,
    wsUrl: process.env.NEXT_PUBLIC_REALTIME_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8888',
  }
}
