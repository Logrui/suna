'use client';

import React from 'react';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useUserProfile } from '@/hooks/react-query/users/use-user-profile';

interface SenderIconProps {
    senderType?: 'system' | 'agent' | 'user';
    senderId?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeMap = {
    sm: 24,
    md: 32,
    lg: 40
};

// Helper function to get user initials
function getInitials(name: string): string {
    return name
        .split(' ')
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

export function SenderIcon({
    senderType = 'system',
    senderId,
    size = 'md',
    className
}: SenderIconProps) {
    const { theme } = useTheme();
    const pixelSize = sizeMap[size];

    // Fetch user data when sender type is 'user'
    const { data: userData } = useUserProfile(
        senderType === 'user' ? senderId : undefined
    );

    // System notifications - use favicon (theme-aware)
    if (senderType === 'system' || !senderId) {
        const faviconSrc = theme === 'dark' ? '/favicon-light.png' : '/favicon.png';

        return (
            <div className={cn(
                'rounded-full bg-muted flex items-center justify-center flex-shrink-0',
                className
            )}
                style={{ width: pixelSize, height: pixelSize }}
            >
                <Image
                    src={faviconSrc}
                    alt="System"
                    width={pixelSize * 0.6}
                    height={pixelSize * 0.6}
                    className="object-contain"
                />
            </div>
        );
    }

    // Agent notifications - use AgentAvatar
    if (senderType === 'agent' && senderId) {
        return (
            <AgentAvatar
                agentId={senderId}
                size={pixelSize}
                className={className}
            />
        );
    }

    // User notifications - use Avatar component with user data
    if (senderType === 'user' && senderId) {
        const avatarUrl = userData?.avatar_url;
        const userName = userData?.name || 'User';
        const initials = getInitials(userName);

        return (
            <Avatar
                className={cn('flex-shrink-0', className)}
                style={{ width: pixelSize, height: pixelSize }}
            >
                <AvatarImage src={avatarUrl} alt={userName} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                    {initials}
                </AvatarFallback>
            </Avatar>
        );
    }

    return null;
}
