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
