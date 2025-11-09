'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeClient } from '@/lib/supabase/realtime-client';
import { threadKeys } from '@/hooks/react-query/threads/keys';
import { Project } from '../app/(dashboard)/projects/[projectId]/thread/_types';

/**
 * Hook to subscribe to real-time project updates and invalidate React Query cache
 * This ensures the frontend immediately knows when sandbox data is updated
 */
export function useProjectRealtime(projectId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    let supabase;
    try {
      supabase = getRealtimeClient();
    } catch (err) {
      console.warn('[useProjectRealtime] Realtime client not yet initialized, skipping subscription:', err);
      return;
    }

    // Subscribe to project changes
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'projects',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {

          // Check if sandbox data was updated
          const newData = payload.new as Project;
          const oldData = payload.old as Project;
          if (newData?.sandbox && (!oldData?.sandbox ||
              JSON.stringify(newData.sandbox) !== JSON.stringify(oldData.sandbox))) {

            // Invalidate specific project query
            queryClient.invalidateQueries({
              queryKey: threadKeys.project(projectId)
            });

          }
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
  // FIXED: Removed queryClient from dependencies
  // queryClient is a stable reference from useQueryClient() hook provided by TanStack Query
  // It never changes during component lifetime, so including it causes unnecessary re-subscriptions
  // The queryClient reference in the closure is captured correctly on first render
}
