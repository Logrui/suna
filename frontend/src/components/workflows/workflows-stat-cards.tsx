'use client';

import { motion, useAnimation } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

// ============ ANIMATION CONFIG - TWEAK THESE WITHOUT TOUCHING globals.css ============
export interface RingAnimationConfig {
    type: 'none' | 'shimmer' | 'glow' | 'sparkle';
    /** Animation duration in seconds */
    duration?: number;
    /** Max brightness multiplier (1.0 = no change, 1.5 = 50% brighter) */
    brightness?: number;
    /** Glow spread in pixels */
    glowSpread?: number;
    /** Delay between sparkle flashes (for sparkle type) */
    sparkleDelay?: number;
}

export interface BorderAnimationConfig {
    type: 'none' | 'shimmer';
    /** Animation duration in seconds */
    duration?: number;
    /** Shimmer color opacity (0-1) */
    opacity?: number;
    /** Shimmer brightness/lightness (0-1, default 1 = white, 0.5 = gray) */
    brightness?: number;
}

// Stat Card component aligned with Kortix design language
export interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: number;
    secondaryValue?: number;
    secondaryLabel?: string;
    description?: string;
    status?: 'default' | 'success' | 'warning' | 'error';
    delay?: number;
    showRing?: boolean;
    ringPercentage?: number;
    // Animation configs - fully customizable!
    ringAnimation?: RingAnimationConfig;
    borderAnimation?: BorderAnimationConfig;
    /** Card float animation (subtle Y movement) */
    enableFloat?: boolean;
    floatAmount?: number; // pixels
    floatDuration?: number; // seconds
    /** Card soft glow animation */
    enableGlow?: boolean;
    glowIntensity?: number; // 0-1
    glowDuration?: number; // seconds
}

// Default configs
const defaultRingAnimation: RingAnimationConfig = { type: 'none' };
const defaultBorderAnimation: BorderAnimationConfig = { type: 'none' };

export function StatCard({
    icon: Icon,
    label,
    value,
    secondaryValue,
    secondaryLabel,
    description,
    status = 'default',
    delay = 0,
    showRing = false,
    ringPercentage = 0,
    ringAnimation = defaultRingAnimation,
    borderAnimation = defaultBorderAnimation,
    enableFloat = false,
    floatAmount = 3,
    floatDuration = 4,
    enableGlow = false,
    glowIntensity = 0.08,
    glowDuration = 4,
}: StatCardProps) {
    // Calculate ring circumference for the progress indicator
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (ringPercentage / 100) * circumference;

    // Animation controls
    const ringControls = useAnimation();
    const cardControls = useAnimation();

    // Status-based icon colors (vibrant, matching old design)
    const iconColor = {
        default: 'text-blue-500',
        success: 'text-green-500',
        warning: 'text-amber-500',
        error: 'text-red-500',
    };

    // Ring stroke colors (as hex for framer-motion filter)
    const ringStrokeClass = {
        default: 'stroke-blue-500',
        success: 'stroke-green-500',
        warning: 'stroke-amber-500',
        error: 'stroke-red-500',
    };

    // Ring animation effect via framer-motion
    useEffect(() => {
        if (ringAnimation.type === 'none') return;

        const duration = ringAnimation.duration ?? 4;
        const brightness = ringAnimation.brightness ?? 1.3;
        const glowSpread = ringAnimation.glowSpread ?? 4;

        if (ringAnimation.type === 'shimmer' || ringAnimation.type === 'glow') {
            ringControls.start({
                filter: [
                    `brightness(1) drop-shadow(0 0 0px currentColor)`,
                    `brightness(${brightness}) drop-shadow(0 0 ${glowSpread}px currentColor)`,
                    `brightness(1) drop-shadow(0 0 0px currentColor)`,
                ],
                transition: {
                    duration,
                    repeat: Infinity,
                    ease: 'easeInOut',
                },
            });
        } else if (ringAnimation.type === 'sparkle') {
            // Intermittent sparkle - mostly idle with occasional flash
            const sparkleDelay = ringAnimation.sparkleDelay ?? 3;
            ringControls.start({
                filter: [
                    `brightness(1)`,
                    `brightness(1)`,
                    `brightness(${brightness}) drop-shadow(0 0 ${glowSpread}px currentColor)`,
                    `brightness(1)`,
                    `brightness(1)`,
                ],
                transition: {
                    duration: duration,
                    times: [0, 0.7, 0.75, 0.8, 1], // Flash at 75% of cycle
                    repeat: Infinity,
                    ease: 'easeInOut',
                    repeatDelay: sparkleDelay,
                },
            });
        }
    }, [ringAnimation, ringControls]);

    // Card animations via framer-motion
    useEffect(() => {
        const animations: Parameters<typeof cardControls.start>[0][] = [];

        if (enableFloat) {
            animations.push({
                y: [0, -floatAmount, 0],
                transition: {
                    duration: floatDuration,
                    repeat: Infinity,
                    ease: 'easeInOut',
                },
            });
        }

        if (enableGlow) {
            animations.push({
                boxShadow: [
                    `0 0 0 0 rgba(99, 102, 241, 0)`,
                    `0 0 20px 2px rgba(99, 102, 241, ${glowIntensity})`,
                    `0 0 0 0 rgba(99, 102, 241, 0)`,
                ],
                transition: {
                    duration: glowDuration,
                    repeat: Infinity,
                    ease: 'easeInOut',
                },
            });
        }

        // Can only run one animation at a time with start(), so we'll pick the first
        if (animations.length > 0) {
            cardControls.start(animations[0]);
        }
    }, [enableFloat, enableGlow, floatAmount, floatDuration, glowIntensity, glowDuration, cardControls]);

    // Build border shimmer style
    const hasBorderShimmer = borderAnimation.type === 'shimmer';
    const borderDuration = borderAnimation.duration ?? 8;
    const borderOpacity = borderAnimation.opacity ?? 0.3;
    const borderBrightness = borderAnimation.brightness ?? 1; // 1 = white, 0.5 = gray, 0 = black

    // Use oklch with configurable lightness (L channel) and opacity
    const shimmerColor = `oklch(${borderBrightness} 0 0 / ${borderOpacity})`;

    const borderShimmerStyle = hasBorderShimmer ? {
        background: `linear-gradient(var(--background), var(--background)) padding-box, linear-gradient(90deg, transparent, ${shimmerColor}, transparent) border-box`,
        backgroundSize: '100% 100%, 200% 100%',
        animation: `border-shimmer ${borderDuration}s linear infinite`,
        border: '1.5px solid transparent',
    } : undefined;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={cardControls}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className={cn(
                "relative overflow-hidden rounded-2xl border border-border/50 p-6 backdrop-blur-sm hover:border-border/80 transition-all group bg-background/50"
            )}
            style={borderShimmerStyle}
        >
            {/* Grain Overlay */}
            <div
                className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply"
                style={{ backgroundImage: "url('/noise.png')" }}
            />

            {/* Subtle gradient on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                        {/* Label */}
                        <p className="text-sm text-muted-foreground">{label}</p>

                        {/* Values Row */}
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-medium tracking-tight">{value.toLocaleString()}</span>
                            {secondaryValue !== undefined && (
                                <span className="text-sm text-muted-foreground">
                                    · {secondaryValue} {secondaryLabel}
                                </span>
                            )}
                        </div>

                        {/* Description */}
                        {description && (
                            <p className="text-xs text-muted-foreground/80">{description}</p>
                        )}
                    </div>

                    {/* Icon with optional ring progress */}
                    {showRing ? (
                        <div className="relative flex-shrink-0 w-14 h-14">
                            {/* Background ring */}
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                                <circle
                                    cx="28"
                                    cy="28"
                                    r={radius}
                                    fill="none"
                                    strokeWidth="3"
                                    className="stroke-border"
                                />
                                <motion.circle
                                    cx="28"
                                    cy="28"
                                    r={radius}
                                    fill="none"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    className={ringStrokeClass[status]}
                                    initial={{ strokeDashoffset: circumference }}
                                    animate={{ strokeDashoffset }}
                                    transition={{ duration: 1, delay: delay + 0.3, ease: "easeOut" }}
                                    style={{
                                        strokeDasharray: circumference,
                                    }}
                                />
                                {/* Animated glow ring overlay */}
                                {ringAnimation.type !== 'none' && (
                                    <motion.circle
                                        cx="28"
                                        cy="28"
                                        r={radius}
                                        fill="none"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        className={ringStrokeClass[status]}
                                        animate={ringControls}
                                        style={{
                                            strokeDasharray: circumference,
                                            strokeDashoffset,
                                        }}
                                    />
                                )}
                            </svg>
                            {/* Center icon */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Icon className={cn("h-5 w-5", iconColor[status])} />
                            </div>
                        </div>
                    ) : (
                        <div className="p-2.5 rounded-xl bg-muted/50">
                            <Icon className={cn("h-5 w-5", iconColor[status])} />
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
