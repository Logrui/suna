'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function MCPSuccessPage() {
    useEffect(() => {
        // Automatically close the window after 3 seconds
        const timer = setTimeout(() => {
            window.close();
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
            <div className="relative">
                {/* Premium Glow Effect */}
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />

                <div className="relative flex flex-col items-center text-center space-y-6 max-w-sm">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xl animate-enter">
                        <CheckCircle2 className="h-10 w-10 text-primary" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-balance">
                            Authentication Successful!
                        </h1>
                        <p className="text-muted-foreground leading-relaxed italic">
                            Your MCP server has been successfully connected.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">Closing window in 3 seconds...</span>
                    </div>

                    <button
                        onClick={() => window.close()}
                        className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors pt-4"
                    >
                        Close now
                    </button>
                </div>
            </div>
        </div>
    );
}
