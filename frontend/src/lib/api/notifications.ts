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

// Migrated to use-notifications.ts
// export type Notification = ...
// export type NotificationListResponse = ...
// export type NotificationPreferences = ...

// ============================================================================
// TYPES
// ============================================================================

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

// Migrated functions removed.


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

// ============================================================================
// SYSTEM NOTIFICATIONS - Admin Restriction
// ============================================================================

export type AdminRestrictionNotificationResult = {
  success: boolean;
  notification_id?: string;
  channels_used: string[];
  email_sent: boolean;
  push_sent: boolean;
  error?: string;
};

export const triggerAdminRestrictionNotification = async (
  modelId: string
): Promise<AdminRestrictionNotificationResult> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new NoAccessTokenAvailableError();
    }

    const response = await backendApi.post('/notifications/trigger/admin-restriction', {
      model_id: modelId,
    });

    if (response.error) {
      throw new Error(`Failed to trigger admin restriction notification: ${response.error.message}`);
    }

    return response.data;
  } catch (error) {
    console.error('Failed to trigger admin restriction notification:', error);
    handleApiError(error, { operation: 'trigger admin restriction notification', resource: 'notifications' });
    throw error;
  }
};
