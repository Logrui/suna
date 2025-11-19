import { createClient } from '@/lib/supabase/client';
import { handleApiError } from '../error-handler';
import { backendApi } from '../api-client';

// Use existing error class from main API
class NoAccessTokenAvailableError extends Error {
  constructor(message?: string, options?: { cause?: Error }) {
    super(message || 'No access token available', options);
  }
  name = 'NoAccessTokenAvailableError';
}

// ============================================================================
// TYPES
// ============================================================================

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

export type GlobalNotificationRequest = {
  title: string;
  message: string;
  notification_type: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  target_user_ids?: string[];
  target_account_ids?: string[];
  send_email?: boolean;
  send_push?: boolean;
  metadata?: Record<string, any>;
};

export type GlobalNotificationBatch = {
  id: string;
  batch_id?: string; // Alias for id
  created_by: string;
  title: string;
  message: string;
  notification_type: 'info' | 'success' | 'warning' | 'error';
  type?: 'info' | 'success' | 'warning' | 'error'; // Alias for notification_type
  category?: string;
  total_recipients: number;
  total_count?: number; // Alias for total_recipients
  sent_count: number;
  failed_count: number;
  emails_sent_count?: number;
  pushes_sent_count?: number;
  status: 'pending' | 'sending' | 'completed' | 'failed' | 'cancelled';
  started_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type GlobalNotificationBatchDetail = GlobalNotificationBatch & {
  metadata?: Record<string, any>;
  error_message?: string | null;
  send_email?: boolean;
  send_push?: boolean;
  emails_sent?: number;
  pushes_sent?: number;
  completed_at?: string | null;
  cancelled_at?: string | null;
  notifications?: Array<{
    id: string;
    status: string;
    [key: string]: any;
  }>;
};

export type GlobalNotificationBatchListResponse = {
  batches: GlobalNotificationBatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

export const getNotifications = async (
  params?: {
    page?: number;
    page_size?: number;
    is_read?: boolean;
    category?: string;
    notification_type?: string;
  }
): Promise<NotificationListResponse> => {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new NoAccessTokenAvailableError();
    }

    const { page = 1, page_size = 10, is_read, category, notification_type } = params;
    const queryParams = new URLSearchParams({ page: page.toString(), page_size: page_size.toString() });

    if (is_read !== undefined) queryParams.set('is_read', is_read.toString());
    if (category) queryParams.set('category', category);
    if (notification_type) queryParams.set('notification_type', notification_type);

    const response = await backendApi.get<NotificationListResponse>(`/notifications/?${queryParams}`);
    if (!response.success) {
      throw new Error(`Failed to fetch notifications: ${response.error?.message || 'Unknown error'}`);
    }
    return response.data!;
  } catch (error) {
    console.error('Failed to get notifications:', error);
    handleApiError(error, { operation: 'get notifications', resource: 'notifications' });
    throw error;
  }
};

export const markNotificationAsRead = async (
  notificationIds: string[],
  isRead: boolean = true
): Promise<{ success: boolean; message: string }> => {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new NoAccessTokenAvailableError();
    }

    const response = await backendApi.post('/notifications/mark-as-read', {
      notification_ids: notificationIds,
      is_read: isRead
    });

    if (response.error) {
      throw new Error(`Failed to mark notifications as read: ${response.error.message}`);
    }

    return response.data || { success: true, message: 'Notifications marked as read' };
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    handleApiError(error, { operation: 'mark notification as read', resource: 'notifications' });
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

    const response = await backendApi.get('/notifications/preferences');

    if (response.error) {
      return null;
    }

    return response.data;
  } catch (error) {
    console.error('Failed to get notification preferences:', error);
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

    const response = await backendApi.post('/notifications/preferences', preferences);

    if (response.error) {
      throw new Error(`Failed to update notification preferences: ${response.error.message}`);
    }

    return response.data;
  } catch (error) {
    console.error('Failed to update notification preferences:', error);
    handleApiError(error, { operation: 'update notification preferences', resource: 'notifications' });
    throw error;
  }
};

export const registerPushToken = async (pushToken: string): Promise<{ success: boolean }> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await backendApi.post('/notifications/push-token', { push_token: pushToken });

    if (response.error) {
      throw new Error(`Failed to register push token: ${response.error.message}`);
    }

    return response.data || { success: true };
  } catch (error) {
    console.error('Failed to register push token:', error);
    handleApiError(error, { operation: 'register push token', resource: 'notifications' });
    throw error;
  }
};

// ============================================================================
// ADMIN NOTIFICATION FUNCTIONS
// ============================================================================

export const sendGlobalNotification = async (
  request: GlobalNotificationRequest
): Promise<GlobalNotificationBatch | null> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await backendApi.post('/admin/notifications/send', request);

    if (response.error) {
      throw new Error(`Failed to send global notification: ${response.error.message}`);
    }

    return response.data;
  } catch (error) {
    console.error('Failed to send global notification:', error);
    handleApiError(error, { operation: 'send global notification', resource: 'admin notifications' });
    throw error;
  }
};

export const listGlobalNotificationBatches = async (
  params?: {
    page?: number;
    page_size?: number;
    status?: string;
  }
): Promise<GlobalNotificationBatchListResponse> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.status) queryParams.append('status', params.status);

    const response = await backendApi.get(`/admin/notifications/batches?${queryParams.toString()}`);

    if (response.error) {
      throw new Error(`Failed to list notification batches: ${response.error.message}`);
    }

    return response.data;
  } catch (error) {
    console.error('Failed to list global notification batches:', error);
    handleApiError(error, { operation: 'list notification batches', resource: 'admin notifications' });
    throw error;
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

    const response = await backendApi.get(`/admin/notifications/batches/${batchId}`);

    if (response.error) {
      return null;
    }

    return response.data;
  } catch (error) {
    console.error('Failed to get global notification batch:', error);
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

    const response = await backendApi.post(`/admin/notifications/batches/${batchId}/cancel`);

    if (response.error) {
      throw new Error(`Failed to cancel notification batch: ${response.error.message}`);
    }
  } catch (error) {
    console.error('Failed to cancel global notification batch:', error);
    handleApiError(error, { operation: 'cancel notification batch', resource: 'admin notifications' });
    throw error;
  }
};
