'use client';

import { createMutationHook, createQueryHook } from '@/hooks/use-query';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { notificationKeys } from './keys';
import { useEffect, useState } from 'react';

// Types
export type Notification = {
  id: string;
  account_id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  thread_id?: string;
  agent_run_id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  sender_type?: 'system' | 'agent' | 'user';
  sender_id?: string;
  is_global: boolean;
  created_by?: string;
  metadata?: Record<string, any>;
  email_sent: boolean;
  email_sent_at?: string;
  email_error?: string;
  push_sent: boolean;
  push_sent_at?: string;
  push_error?: string;
  retry_count: number;
  last_retry_at?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
};

export type NotificationListResponse = {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  unread_count?: number;
};

export type NotificationPreferences = {
  user_id: string;
  account_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  email_categories: Record<string, boolean>;
  push_categories: Record<string, boolean>;
  push_token?: string | null;
  push_token_updated_at?: string | null;
  created_at: string;
  updated_at: string;
};

// Fetch functions
const fetchNotifications = async (params?: {
  page?: number;
  page_size?: number;
  is_read?: boolean;
  category?: string;
  notification_type?: string;
}): Promise<NotificationListResponse> => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('Not authenticated');
  }

  const page = params?.page || 1;
  const pageSize = params?.page_size || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Base query
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  // Apply filters
  if (params?.is_read !== undefined) {
    query = query.eq('is_read', params.is_read);
  }
  if (params?.category) {
    query = query.eq('category', params.category);
  }
  if (params?.notification_type) {
    query = query.eq('type', params.notification_type);
  }

  // Apply pagination
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }

  // Get unread count separately
  const { count: unreadCount, error: unreadError } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('is_read', false);

  if (unreadError) {
    console.error('Error fetching unread count:', unreadError);
  }

  const total = count || 0;
  const pages = Math.ceil(total / pageSize);

  return {
    notifications: (data as Notification[]) || [],
    pagination: {
      page,
      limit: pageSize,
      total,
      pages,
    },
    unread_count: unreadCount || 0,
  };
};

const fetchPreferences = async (): Promise<NotificationPreferences | null> => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) return null;

  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found, return default
      return {
        user_id: session.user.id,
        account_id: '',
        email_enabled: true,
        push_enabled: true,
        email_categories: {},
        push_categories: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    console.error('Error fetching preferences:', error);
    return null;
  }

  return data as NotificationPreferences;
};

// Hooks
export const useNotifications = (
  params?: {
    page?: number;
    page_size?: number;
    is_read?: boolean;
    category?: string;
    notification_type?: string;
  }
) => {
  return createQueryHook(
    notificationKeys.list(params),
    () => fetchNotifications(params),
    {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      refetchInterval: 60 * 1000,
      enabled: typeof window !== 'undefined',
    }
  )();
};

export const useNotificationPreferences = () => {
  return createQueryHook(
    notificationKeys.preferences(),
    fetchPreferences,
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      enabled: typeof window !== 'undefined',
    }
  )();
};

export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return createMutationHook(
    async ({ notificationIds, isRead = true }: { notificationIds: string[]; isRead?: boolean }) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: isRead,
          read_at: isRead ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .in('id', notificationIds)
        .eq('user_id', session.user.id);

      if (error) throw error;
      return { success: true };
    },
    {
      onMutate: async ({ notificationIds, isRead = true }) => {
        await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
        const previousData = queryClient.getQueryData(notificationKeys.lists());

        queryClient.setQueryData(notificationKeys.lists(), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            notifications: old.notifications.map((n: Notification) =>
              notificationIds.includes(n.id) ? { ...n, is_read: isRead } : n
            ),
            unread_count: isRead
              ? Math.max(0, (old.unread_count || 0) - notificationIds.length)
              : (old.unread_count || 0) + notificationIds.length
          };
        });

        return { previousData };
      },
      onError: (err, newTodo, context) => {
        queryClient.setQueryData(notificationKeys.lists(), context?.previousData);
        toast.error('Failed to update notification status');
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      },
    }
  )();
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return createMutationHook(
    async (notificationIds: string[]) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', notificationIds)
        .eq('user_id', session.user.id);

      if (error) throw error;
      return { success: true };
    },
    {
      onMutate: async (notificationIds) => {
        await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
        const previousData = queryClient.getQueryData(notificationKeys.lists());

        queryClient.setQueryData(notificationKeys.lists(), (old: any) => {
          if (!old) return old;
          const deletedCount = old.notifications.filter((n: Notification) =>
            notificationIds.includes(n.id) && !n.is_read
          ).length;

          return {
            ...old,
            notifications: old.notifications.filter((n: Notification) => !notificationIds.includes(n.id)),
            unread_count: Math.max(0, (old.unread_count || 0) - deletedCount)
          };
        });

        return { previousData };
      },
      onError: (err, newTodo, context) => {
        queryClient.setQueryData(notificationKeys.lists(), context?.previousData);
        toast.error('Failed to delete notification');
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      },
      onSuccess: () => {
        toast.success('Notification deleted');
      }
    }
  )();
};

export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();

  return createMutationHook(
    async (preferences: Partial<NotificationPreferences>) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) throw new Error('Not authenticated');

      // Check if exists first
      const { data: existing } = await supabase
        .from('user_notification_preferences')
        .select('user_id')
        .eq('user_id', session.user.id)
        .single();

      let error;
      if (existing) {
        const { error: updateError } = await supabase
          .from('user_notification_preferences')
          .update({
            ...preferences,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', session.user.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_notification_preferences')
          .insert({
            user_id: session.user.id,
            ...preferences,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        error = insertError;
      }

      if (error) throw error;
      return preferences;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
        toast.success('Notification preferences updated');
      },
      onError: (error) => {
        console.error('Error updating preferences:', error);
        toast.error('Failed to update preferences');
      },
    }
  )();
};

export const useRegisterPushToken = () => {
  return createMutationHook(
    async (pushToken: string) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) throw new Error('Not authenticated');

      // Check if exists
      const { data: existing } = await supabase
        .from('user_notification_preferences')
        .select('user_id')
        .eq('user_id', session.user.id)
        .single();

      const now = new Date().toISOString();
      let error;

      if (existing) {
        const { error: updateError } = await supabase
          .from('user_notification_preferences')
          .update({
            push_token: pushToken,
            push_token_updated_at: now,
            updated_at: now,
          })
          .eq('user_id', session.user.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_notification_preferences')
          .insert({
            user_id: session.user.id,
            push_token: pushToken,
            push_token_updated_at: now,
            email_enabled: true,
            push_enabled: true,
            email_categories: {},
            push_categories: {},
            created_at: now,
            updated_at: now,
          });
        error = insertError;
      }

      if (error) throw error;
      return { success: true };
    },
    {
      onSuccess: () => {
        // Invalidate preferences to refresh push token status
      },
      onError: (error) => {
        console.error('Error registering push token:', error);
      },
    }
  )();
};
