'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedBg } from '@/components/ui/animated-bg';
import { KortixLogo } from '@/components/sidebar/kortix-logo';

export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Workflow Editor Error:', error);
    }, [error]);

    return (
        <div className="w-full relative overflow-hidden min-h-screen">
            <div className="relative flex flex-col items-center w-full px-4 sm:px-6 min-h-screen justify-center">
                {/* Animated background - exactly like hero section */}
                <AnimatedBg variant="hero" />

                <div className="relative z-10 w-full max-w-[456px] flex flex-col items-center gap-8">
                    {/* Logo - 32px height */}
                    <KortixLogo size={32} />

                    {/* Title - 43px */}
                    <h1 className="text-[43px] font-normal tracking-tight text-foreground leading-none text-center">
                        Something went wrong
                    </h1>

                    {/* Description - 16px */}
                    <p className="text-[16px] text-foreground/60 text-center leading-relaxed">
                        An unexpected error occurred in the workflow editor.
                        <br />
                        We apologize for the inconvenience.
                    </p>

                    {/* Status Card - 456px width, 96px height */}
                    <Card className="w-full bg-card border border-border">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="flex flex-col gap-1 overflow-hidden">
                                        <div className='flex items-center gap-2'>
                                            <div className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse"></div>
                                            <span className="text-base font-medium text-red-400">Workflow Error</span>
                                        </div>
                                        <p className="text-base text-gray-400 truncate" title={error.message}>
                                            {error.message || "Unknown error occurred"}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={reset}
                                    size="icon"
                                    variant="ghost"
                                    className="h-12 w-12 bg-border shrink-0"
                                    title="Try Again"
                                >
                                    <RefreshCw className="h-5 w-5 text-foreground" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Grain texture overlay - ON TOP OF EVERYTHING */}
                <div
                    className="absolute inset-0 opacity-[0.15] pointer-events-none z-50"
                    style={{
                        backgroundImage: 'url(/grain-texture.png)',
                        backgroundRepeat: 'repeat',
                        mixBlendMode: 'overlay'
                    }}
                />
            </div>
        </div>
    );
}
