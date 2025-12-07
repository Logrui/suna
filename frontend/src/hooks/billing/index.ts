
'use client';

/**
 * Billing Hooks Index
 *
 * UNIFIED APPROACH: All billing state comes from useAccountState
 * This provides a single source of truth and optimizes API calls.
 */

// from use-account-state
export {
  useAccountState,
  useAccountStateWithStreaming,
  accountStateKeys,
  invalidateAccountState,
  useCreateCheckoutSession,
  useCreatePortalSession,
  useCancelSubscription,
  useReactivateSubscription,
  usePurchaseCredits,
  useDeductTokenUsage,
  useScheduleDowngrade,
  useCancelScheduledChange,
  useSyncSubscription,
  useStartTrial,
  useCancelTrial,
  useUsageHistory,
  useTrialStatus,
  accountStateSelectors,
} from './use-account-state';

// from use-subscription
export {
  useSubscription,
  useSubscriptionWithStreaming,
  useCreditBalance,
  useBillingStatus,
  useSubscriptionCommitment,
  useTriggerTestRenewal,
  useScheduledChanges,
  isPlan,
  billingKeys,
  subscriptionKeys,
} from './use-subscription';

// from use-transactions
export {
  useTransactions,
  type CreditTransaction,
  type TransactionsResponse,
  type TransactionsSummary,
  useTransactionsSummary,
} from './use-transactions';

export { useThreadBilling } from './use-thread-billing';
export { useBillingModal } from './use-billing-modal';
export { useDownloadRestriction } from './use-download-restriction';
export { useCreditUsage } from './use-credit-usage';

export {
  useTierConfigurations,
  getTierByKey,
  type TierConfiguration,
  type TierConfigurationsResponse,
} from './use-tier-configurations';

export {
  useUserBillingSummary,
  useAdminUserTransactions,
  useAdjustCredits,
  useProcessRefund,
} from './use-admin-billing';

export type { AccountState } from '@/lib/api/billing';
