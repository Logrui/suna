'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';
import { clearUserLocalStorage } from '@/lib/utils/clear-local-storage';
import { initializeRealtimeClient } from '@/lib/supabase/realtime-client';
import { getApiUrl } from '@/lib/get-api-url';

type AuthContextType = {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {

    const ensureAccountInitialized = async (currentSession: Session) => {
      if (!currentSession?.user?.id) return;

      const storageKey = `suna_init_checked_${currentSession.user.id}`;
      if (localStorage.getItem(storageKey)) {
        return; // Already checked for this user
      }

      try {
        //console.log('[AuthProvider] Ensuring account initialized...');
        const response = await fetch(`${getApiUrl()}/setup/initialize`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          localStorage.setItem(storageKey, 'true');
          //console.log('[AuthProvider] Account initialization check passed');
        } else {
          console.warn('[AuthProvider] Account initialization check failed:', await response.text());
        }
      } catch (error) {
        console.warn('[AuthProvider] Error checking account initialization:', error);
      }
    };

    const getInitialSession = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // feature-start: daytona-preview-bypass
        // Sync auth token to cookie for backend proxy access
        if (currentSession?.access_token) {
          document.cookie = `suna-auth-token=${currentSession.access_token}; path=/; max-age=${currentSession.expires_in}; SameSite=Lax; Secure`;
          // feature-end: daytona-preview-bypass

          // Ensure account is initialized (idempotent check)
          ensureAccountInitialized(currentSession);
        }

        // Initialize realtime client with auth syncing
        try {
          await initializeRealtimeClient(supabase);
          //console.log('[AuthProvider] Realtime client initialized with auth syncing');
        } catch (err) {
          //console.error('[AuthProvider] Failed to initialize realtime client:', err);
        }

      } catch (error) {
        console.error('❌ Error getting initial session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // feature-start: daytona-preview-bypass
        // Sync auth token to cookie for backend proxy access (e.g. Daytona previews)
        if (newSession?.access_token) {
          document.cookie = `suna-auth-token=${newSession.access_token}; path=/; max-age=${newSession.expires_in}; SameSite=Lax; Secure`;
          ensureAccountInitialized(newSession);
        } else if (event === 'SIGNED_OUT') {
          document.cookie = 'suna-auth-token=; path=/; max-age=0; SameSite=Lax; Secure';
        }
        // feature-end: daytona-preview-bypass

        if (isLoading) setIsLoading(false);
        switch (event) {
          case 'SIGNED_IN':
            break;
          case 'SIGNED_OUT':
            clearUserLocalStorage();
            break;
          case 'TOKEN_REFRESHED':
            break;
          case 'MFA_CHALLENGE_VERIFIED':
            break;
          default:
        }
      },
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]); // Removed isLoading from dependencies to prevent infinite loops

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      // Clear local storage after successful sign out
      clearUserLocalStorage();
    } catch (error) {
      console.error('❌ Error signing out:', error);
    }
  };

  const value = {
    supabase,
    session,
    user,
    isLoading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
