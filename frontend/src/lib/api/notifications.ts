import { createClient } from '@/lib/supabase/client';
import { handleApiError } from '../error-handler';
import { backendApi } from '../api-client';

// =====================================================
// TYPES
// =====================================================

export type Notification = {
  id: string;
  account_id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'agent_complete';
  category?: string;
  thread_id?: string | null;
  agent_run_id?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  is_global: boolean;
  created_by?: string | null;
  metadata?: Record<string, any>;
  email_sent: boolean;
  email_sent_at?: string | null;
  email_error?: string | null;
  push_sent: boolean;
  push_sent_at?: string | null;
  push_error?: string | null;
  retry_count: number;
  last_retry_at?: string | null;
  is_read: boolean;
  read_at?: string | null;
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

export type GlobalNotificationRequest = {
  title: string;
  message: string;
  notification_type: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  target_user_ids?: string[];
  target_account_ids?: string[];
  metadata?: Record<string, any>;
};

export type GlobalNotificationBatch = {
  id: string;
  created_by: string;
  title: string;
  message: string;
  notification_type: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: 'pending' | 'sending' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  updated_at: string;
};

export type GlobalNotificationBatchDetail = GlobalNotificationBatch & {
  metadata?: Record<string, any>;
  error_message?: string | null;
};

// =====================================================
// USER NOTIFICATIONS
// =====================================================

export const getNotifications = async (params?: {
  page?: number;
  page_size?: number;
  is_read?: boolean;
  category?: string;
  notification_type?: string;
}): Promise<NotificationListResponse> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {
        notifications: [],
        pagination: {
          page: params?.page || 1,
          limit: params?.page_size || 20,
          total: 0,
          pages: 0,
        },
      };
    }

    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.is_read !== undefined) queryParams.append('is_read', params.is_read.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.notification_type) queryParams.append('type', params.notification_type);

    const response = await backendApi.get<NotificationListResponse>(
      `/notifications?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        showErrors: false,
      }
    );

    if (response.error) {
      console.error('Error fetching notifications:', response.error);
      return {
        notifications: [],
        pagination: {
          page: params?.page || 1,
          limit: params?.page_size || 20,
          total: 0,
          pages: 0,
        },
      };
    }

    return response.data || {
      notifications: [],
      pagination: {
        page: params?.page || 1,
        limit: params?.page_size || 20,
        total: 0,
        pages: 0,
      },
    };
  } catch (error) {
    console.error('Failed to get notifications:', error);
    handleApiError(error, { operation: 'load notifications', resource: 'notifications' });
    return {
      notifications: [],
      pagination: {
        page: params?.page || 1,
        limit: params?.page_size || 20,
        total: 0,
        pages: 0,
      },
    };
  }
};

export const markNotificationAsRead = async (
  notificationIds: string[],
  isRead: boolean = true
): Promise<void> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await backendApi.post(
      '/notifications/mark-as-read',
      {
        notification_ids: notificationIds,
        is_read: isRead,
      },
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        showErrors: false,
      }
    );

    if (response.error) {
      throw response.error;
    }
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    handleApiError(error, { operation: 'mark as read', resource: 'notification' });
    throw error;
  }
};

export const getNotificationPreferences = async (): Promise<NotificationPreferences | null> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return null;
    }

    const response = await backendApi.get<NotificationPreferences>(
      '/notifications/preferences',
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        showErrors: false,
      }
    );

    if (response.error) {
      console.error('Error fetching notification preferences:', response.error);
      return null;
    }

    return response.data || null;
  } catch (error) {
    console.error('Failed to get notification preferences:', error);
    handleApiError(error, { operation: 'load preferences', resource: 'notification preferences' });
    return null;
  }
};

export const updateNotificationPreferences = async (
  preferences: Partial<{
    email_enabled: boolean;
    push_enabled: boolean;
    email_categories: Record<string, boolean>;
    push_categories: Record<string, boolean>;
  }>
): Promise<NotificationPreferences | null> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await backendApi.post<NotificationPreferences>(
      '/notifications/preferences',
      preferences,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        showErrors: false,
      }
    );

    if (response.error) {
      throw response.error;
    }

    return response.data || null;
  } catch (error) {
    console.error('Failed to update notification preferences:', error);
    handleApiError(error, { operation: 'update preferences', resource: 'notification preferences' });
    throw error;
  }
};

export const registerPushToken = async (pushToken: string): Promise<void> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await backendApi.post(
      '/notifications/push-token',
      { push_token: pushToken },
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        showErrors: false,
      }
    );

    if (response.error) {
      throw response.error;
    }
  } catch (error) {
    console.error('Failed to register push token:', error);
    handleApiError(error, { operation: 'register push token', resource: 'push token' });
    throw error;
  }
};

// =====================================================
// ADMIN GLOBAL NOTIFICATIONS
// =====================================================

export const sendGlobalNotification = async (
  request: GlobalNotificationRequest
): Promise<GlobalNotificationBatch | null> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await backendApi.post<GlobalNotificationBatch>(
      '/admin/notifications/send',
      request,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        showErrors: false,
      }
    );

    if (response.error) {
      throw response.error;
    }

    return response.data || null;
  } catch (error) {
    console.error('Failed to send global notification:', error);
    handleApiError(error, { operation: 'send notification', resource: 'global notification' });
    throw error;
  }
};

export const listGlobalNotificationBatches = async (params?: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<{
  batches: GlobalNotificationBatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {
        batches: [],
        pagination: {
          page: params?.page || 1,
          limit: params?.page_size || 20,
          total: 0,
          pages: 0,
        },
      };
    }

    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.status) queryParams.append('status', params.status);

    const response = await backendApi.get<{
      batches: GlobalNotificationBatch[];
      pagination: any;
    }>(
      `/admin/notifications/batches?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        showErrors: false,
      }
    );

    if (response.error) {
      console.error('Error fetching notification batches:', response.error);
      return {
        batches: [],
        pagination: {
          page: params?.page || 1,
          limit: params?.page_size || 20,
          total: 0,
          pages: 0,
        },
      };
    }

    return response.data || {
      batches: [],
      pagination: {
        page: params?.page || 1,
        limit: params?.page_size || 20,
        total: 0,
        pages: 0,
      },
    };
  } catch (error) {
    console.error('Failed to list notification batches:', error);
    handleApiError(error, { operation: 'list batches', resource: 'notification batches' });
    return {
      batches: [],
      pagination: {
        page: params?.page || 1,
        limit: params?.page_size || 20,
        total: 0,
        pages: 0,
      },
    };
  }
};

export const getGlobalNotificationBatch = async (
  batchId: string
): Promise<GlobalNotificationBatchDetail | null> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return null;
    }

    const response = await backendApi.get<GlobalNotificationBatchDetail>(
      `/admin/notifications/batches/${batchId}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        showErrors: false,
      }
    );

    if (response.error) {
      console.error('Error fetching notification batch:', response.error);
      return null;
    }

    return response.data || null;
  } catch (error) {
    console.error('Failed to get notification batch:', error);
    handleApiError(error, { operation: 'get batch', resource: 'notification batch' });
    return null;
  }
};

export const cancelGlobalNotificationBatch = async (batchId: string): Promise<void> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await backendApi.post(
      `/admin/notifications/batches/${batchId}/cancel`,
      {},
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        showErrors: false,
      }
    );

    if (response.error) {
      throw response.error;
    }
  } catch (error) {
    console.error('Failed to cancel notification batch:', error);
    handleApiError(error, { operation: 'cancel batch', resource: 'notification batch' });
    throw error;
  }
};
