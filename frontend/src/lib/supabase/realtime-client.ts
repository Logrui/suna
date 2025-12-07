import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Realtime Client Manager
 * 
 * Maintains a SINGLETON realtime client instance that:
 * 1. Connects directly to Kong (bypasses Next.js HTTP proxy)
 * 2. Auto-syncs auth token from main Supabase client
 * 3. Handles token refresh automatically
 * 4. Used by all realtime subscription hooks
 */

let realtimeClientInstance: SupabaseClient | null = null;
let mainClientReference: SupabaseClient | null = null;
let authUnsubscribe: (() => void) | null = null;

/**
 * Initialize realtime client with auth syncing
 * Called once from AuthProvider after main client is ready
 */
export async function initializeRealtimeClient(mainClient: SupabaseClient): Promise<SupabaseClient> {
    if (realtimeClientInstance) {
        //console.log('[RealtimeManager] Realtime client already initialized');
        return realtimeClientInstance;
    }

    mainClientReference = mainClient;

    // Create realtime client pointing directly to Kong
    const realtimeUrl =
        process.env.NEXT_PUBLIC_REALTIME_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        'http://localhost:8888';

    //console.log('[RealtimeManager] Initializing with URL:', realtimeUrl);

    realtimeClientInstance = createSupabaseClient(
        realtimeUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
            realtime: {
                params: {
                    eventsPerSecond: 1000,
                },
            },
        }
    );

    // PHASE 1: Sync initial auth
    try {
        const { data: { session }, error } = await mainClient.auth.getSession();
        if (error) {
            //console.warn('[RealtimeManager] Failed to get initial session:', error);
        } else if (session?.access_token) {
            await realtimeClientInstance.realtime.setAuth(session.access_token);
            //console.log('[RealtimeManager] ✅ Initial auth synced');
            //console.log('[RealtimeManager] User:', session.user?.email, 'Token:', session.access_token.substring(0, 20) + '...');
        } else {
            console.log('[RealtimeManager] No initial session (user not logged in yet)');
        }
    } catch (err) {
        console.error('[RealtimeManager] Failed to sync initial auth:', err);
    }

    // PHASE 2: Listen to all auth changes and sync token
    authUnsubscribe = mainClient.auth.onAuthStateChange(async (event, session) => {
        //console.log('[RealtimeManager] Auth state changed:', event);

        if (session?.access_token) {
            try {
                await realtimeClientInstance!.realtime.setAuth(session.access_token);
                //console.log('[RealtimeManager] ✅ Auth synced on', event);
                //console.log('[RealtimeManager] User:', session.user?.email, 'Token:', session.access_token.substring(0, 20) + '...');
            } catch (err) {
                console.error('[RealtimeManager] Failed to sync auth:', err);
            }
        } else {
            //console.log('[RealtimeManager] Auth cleared on', event, '(user signed out or session expired)');
        }
    }).data.subscription.unsubscribe;

    //console.log('[RealtimeManager] Initialization complete. Auth syncing active.');
    return realtimeClientInstance;
}

/**
 * Get the singleton realtime client instance
 * Ensures all hooks use the same authenticated connection
 */
export function getRealtimeClient(): SupabaseClient {
    if (!realtimeClientInstance) {
        throw new Error(
            '[RealtimeManager] Realtime client not initialized. ' +
            'This usually means AuthProvider has not mounted yet. ' +
            'Ensure your components are wrapped with AuthProvider.'
        );
    }
    return realtimeClientInstance;
}

/**
 * Cleanup (for testing/unmount)
 */
export function cleanupRealtimeClient() {
    if (authUnsubscribe) {
        authUnsubscribe();
    }
    realtimeClientInstance = null;
    mainClientReference = null;
}
