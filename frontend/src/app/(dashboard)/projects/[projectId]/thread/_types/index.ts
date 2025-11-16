// Re-export types from the main thread types file
export type { ApiMessageType } from '@/components/thread/types';

export interface BillingData {
  balance: number;
  tier: string;
  can_run: boolean;
  message: string;
  currentUsage: number;
  limit: number;
  accountId: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  sandbox?: Record<string, any>;
}
