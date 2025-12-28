'use client';

import React from 'react';
import { type LucideIcon, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToolIconProps {
    /** Lucide icon component to render */
    icon?: LucideIcon;
    /** URL of an image icon (e.g., Composio toolkit logo) */
    iconUrl?: string;
    /** Gradient color classes for the icon container */
    color?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Additional className for the container */
    className?: string;
}

/**
 * ToolIcon - A flexible icon component that supports both Lucide icons and image URLs.
 * 
 * Used in the workflow editor to display tool icons, supporting:
 * - Lucide React icons (for AgentPress tools)
 * - Image URLs (for Composio toolkit logos)
 * 
 * @example
 * // With Lucide icon
 * <ToolIcon icon={FileText} color="from-blue-500/20 to-blue-600/10" />
 * 
 * // With image URL (Composio)
 * <ToolIcon iconUrl="https://composio.dev/icons/googlesheets.png" color="from-green-500/20" />
 * 
 * // With fallback (will show Wrench icon)
 * <ToolIcon />
 */
export function ToolIcon({
    icon: IconComponent,
    iconUrl,
    color = 'from-gray-500/20 to-gray-600/10 border-gray-500/20 text-gray-500',
    size = 'md',
    className
}: ToolIconProps) {
    const sizeClasses = {
        sm: 'p-1.5 rounded-md',
        md: 'p-2 rounded-lg',
        lg: 'p-3 rounded-xl'
    };

    const iconSizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6'
    };

    const containerClasses = cn(
        'relative bg-gradient-to-br border flex items-center justify-center',
        sizeClasses[size],
        color,
        className
    );

    // If we have an image URL, render with minimal/transparent container
    // (Composio icons should display without gradient background)
    if (iconUrl) {
        const imageContainerClasses = cn(
            'relative flex items-center justify-center',
            sizeClasses[size],
            className
        );

        return (
            <div className={imageContainerClasses}>
                <img
                    src={iconUrl}
                    alt=""
                    className={cn(iconSizeClasses[size], 'object-contain')}
                    onError={(e) => {
                        // On error, hide the image
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            </div>
        );
    }

    // Otherwise render the Lucide icon (with fallback to Wrench)
    const Icon = IconComponent || Wrench;
    return (
        <div className={containerClasses}>
            <Icon className={iconSizeClasses[size]} />
        </div>
    );
}

/**
 * ToolIconWithLabel - ToolIcon with an optional label/badge below it
 * Useful for grouped tool displays
 */
export interface ToolIconWithLabelProps extends ToolIconProps {
    label?: string;
}

export function ToolIconWithLabel({
    label,
    ...iconProps
}: ToolIconWithLabelProps) {
    return (
        <div className="flex flex-col items-center gap-1">
            <ToolIcon {...iconProps} />
            {label && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                    {label}
                </span>
            )}
        </div>
    );
}

export default ToolIcon;
