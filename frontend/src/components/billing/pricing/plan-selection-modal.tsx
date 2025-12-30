'use client';

// BILLING DISABLED - This modal is disabled for internal use
// All billing/pricing functionality has been removed

interface PlanSelectionModalProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    returnUrl?: string;
    creditsExhausted?: boolean;
    upgradeReason?: string;
}

export function PlanSelectionModal({
    open,
    onOpenChange,
    returnUrl,
    creditsExhausted = false,
    upgradeReason,
}: PlanSelectionModalProps) {
    // Return null - modal is disabled for internal use
    return null;
}
