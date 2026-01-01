'use client';

import { useAuth } from '@/components/AuthProvider';
import { NovuProvider } from '@novu/nextjs';
import React from 'react';

export function NovuProviderWrapper({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const applicationIdentifier = process.env.NEXT_PUBLIC_NOVU_APP_IDENTIFIER;

    // We only initialize the provider if we have both the user ID and app identifier
    if (applicationIdentifier && user?.id) {
        return (
            <NovuProvider
                subscriberId={user.id}
                applicationIdentifier={applicationIdentifier}
            >
                {children}
            </NovuProvider>
        );
    }

    return <>{children}</>;
}
