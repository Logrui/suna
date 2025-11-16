'use client';

import React from 'react';
import { useCreditBalance, useSubscription, billingKeys } from '@/hooks/billing';
import { useAuth } from '@/components/AuthProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { isLocalMode } from '@/lib/config';
import { getPlanName } from '@/components/billing/plan-utils';
import { TierBadge } from '@/components/billing/tier-badge';
import { formatCredits } from '@/lib/utils/credit-formatter';

export function CreditsDisplay() {
  const { user } = useAuth();
  const { data: balance, isLoading: balanceLoading } = useCreditBalance(!!user);
  const { data: subscriptionData, isLoading: subscriptionLoading } = useSubscription({ enabled: !!user });
  const isLocal = isLocalMode();
  const isLoading = balanceLoading || subscriptionLoading;
  
  // Get plan name from subscription data
  const planName = getPlanName(subscriptionData, isLocal);

  // Debug logging - disabled in local mode
  React.useEffect(() => {
    if (isLocal) return;
    if (balance) {
      console.log('[CreditsDisplay] Balance data:', balance);
    }
    if (subscriptionData) {
      console.log('[CreditsDisplay] Subscription data:', subscriptionData);
      console.log('[CreditsDisplay] Computed plan name:', planName);
      console.log('[CreditsDisplay] Tier key:', subscriptionData.tier_key);
      console.log('[CreditsDisplay] Tier name:', subscriptionData.tier?.name);
    }
  }, [balance, subscriptionData, planName, isLocal]);

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 border-[1.5px] border-border/60 dark:border-border rounded-full px-3.5 py-2 h-[41px] bg-background">
        <Skeleton className="h-4 w-24 bg-muted/50 dark:bg-muted" />
      </div>
    );
  }

  const credits = balance?.balance || 0;
  const formattedCredits = isLocal ? '∞' : formatCredits(credits);

  return (
    <div className="flex items-center gap-2 border-[1.5px] border-border/60 dark:border-border rounded-full px-3.5 py-2 h-[41px] bg-background">
      {/* Tier Badge - Left side */}
      <TierBadge 
        planName={planName} 
        variant="default" 
        size="md" 
        isLocal={isLocal} 
      />

      {/* Credits amount */}
      <div className="flex items-baseline gap-1.5 min-w-0 flex-shrink-0">
        <span className="text-[15px] font-medium text-foreground dark:text-foreground leading-none tabular-nums">
          {formattedCredits}
        </span>
        <span className="text-[13px] font-medium text-muted-foreground dark:text-muted-foreground/60 leading-none whitespace-nowrap">
          Credits
        </span>
      </div>
    </div>
  );
}

