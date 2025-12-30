'use client';

// BILLING DISABLED - This component is disabled for internal use

interface PricingSectionProps {
    returnUrl?: string;
    onSubscriptionUpdate?: () => void;
    creditsExhausted?: boolean;
    showTitleAndTabs?: boolean;
    insideDialog?: boolean;
    noPadding?: boolean;
}

export function PricingSection({
    returnUrl,
    onSubscriptionUpdate,
    creditsExhausted = false,
    showTitleAndTabs = true,
    insideDialog = false,
    noPadding = false,
}: PricingSectionProps) {
    // Return null - pricing is disabled for internal use
    return null;
}
