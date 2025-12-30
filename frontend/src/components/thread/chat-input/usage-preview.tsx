import React from 'react';

// BILLING DISABLED - This component is disabled for internal use

export interface UsagePreviewProps {
    type: 'tokens' | 'upgrade';
    subscriptionData?: any;
    onClose?: () => void;
    onOpenUpgrade?: () => void;
    hasMultiple?: boolean;
    showIndicators?: boolean;
    currentIndex?: number;
    totalCount?: number;
    onIndicatorClick?: (index: number) => void;
}

export const UsagePreview: React.FC<UsagePreviewProps> = () => {
    // Return null - billing/upgrade is disabled for internal use
    return null;
};
