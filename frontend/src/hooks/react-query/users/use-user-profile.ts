import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
    id: string;
    avatar_url?: string;
    name?: string;
}

/**
 * Hook to fetch minimal user profile data by user ID
 * Used by notification system to display user avatars
 * Only fetches avatar_url and name for privacy
 */
export function useUserProfile(userId?: string) {
    return useQuery({
        queryKey: ['user-profile', userId],
        queryFn: async (): Promise<UserProfile | null> => {
            if (!userId) return null;

            const supabase = createClient();
            const { data: session } = await supabase.auth.getSession();

            if (!session?.session) {
                throw new Error('Not authenticated');
            }

            const response = await fetch(
                `/api/users/${userId}/profile`,
                {
                    headers: {
                        'Authorization': `Bearer ${session.session.access_token}`,
                    },
                }
            );

            if (!response.ok) {
                if (response.status === 404) {
                    // User not found, return null to show fallback
                    return null;
                }
                throw new Error('Failed to fetch user profile');
            }

            return response.json();
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: 1, // Only retry once on failure
    });
}
