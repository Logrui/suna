import { useQuery } from '@tanstack/react-query';
import { TriggerProvider } from '@/components/agents/triggers/types';
import { createClient } from '@/lib/supabase/client';
import { getApiUrl } from '@/lib/get-api-url';

const API_URL = getApiUrl();

const fetchTriggerProviders = async (): Promise<TriggerProvider[]> => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('You must be logged in to create a trigger');
  }
  const response = await fetch(`${API_URL}/triggers/providers`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch trigger providers');
  }
  return response.json();
};

export const useTriggerProviders = () => {
  return useQuery({
    queryKey: ['trigger-providers'],
    queryFn: fetchTriggerProviders,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}; 