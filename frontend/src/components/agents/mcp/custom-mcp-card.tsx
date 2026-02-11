import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Settings, ShieldCheck, AlertCircle, Link2, Trash2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import type { MCPConfiguration } from './types';

interface CustomMCPCardProps {
    server: MCPConfiguration;
    onConfigure?: (server: MCPConfiguration) => void;
    onEdit?: (server: MCPConfiguration) => void;
    onManageTools?: (server: MCPConfiguration) => void;
    onRemove?: (server: MCPConfiguration) => void;
    className?: string;
}

export const CustomMCPCard: React.FC<CustomMCPCardProps> = ({
    server,
    onConfigure,
    onEdit,
    onManageTools,
    onRemove,
    className,
}) => {
    // Extracting details from the config blob
    const url = server.config?.url || 'No URL provided';
    const requiresConfig = server.config?.requires_config || false;
    const isConnected = !requiresConfig;

    return (
        <div className={cn(
            "group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-md hover:shadow-primary/5",
            className
        )}>
            {/* Grain Overlay for Premium Feel */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
                style={{ backgroundImage: "url('/noise.png')" }} />

            <div className="p-6 relative z-10">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center border border-border/50">
                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary font-semibold text-lg">
                                {server.name ? server.name.charAt(0).toUpperCase() : <Sparkles className="h-5 w-5" />}
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground text-lg mb-1 truncate">
                                {server.name || 'Untitled MCP'}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{url}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            onClick={() => onEdit?.(server)}
                            title="Edit Server Settings"
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Remove Integration"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl border-border/40 shadow-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-xl font-semibold tracking-tight">Remove Integration?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground leading-relaxed">
                                        Are you sure you want to remove <strong className="text-foreground">{server.name}</strong>? This will disable all associated tools and remove the server from this agent.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-3">
                                    <AlertDialogCancel className="rounded-xl border-border/50 hover:bg-muted">Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => onRemove?.(server)}
                                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl shadow-lg shadow-destructive/20"
                                    >
                                        Remove Server
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                <div className="space-y-4 mb-4">
                    <div className="flex flex-wrap gap-2">
                        {isConnected ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 flex items-center gap-1.5 px-2.5 py-1">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Connected
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 flex items-center gap-1.5 px-2.5 py-1">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Configuration Required
                            </Badge>
                        )}
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-border/50 text-muted-foreground bg-muted/30">
                                {server.enabledTools?.length || 0} tools enabled
                            </Badge>
                            <Badge variant="outline" className="border-border/50 text-muted-foreground bg-muted/30">
                                Custom MCP
                            </Badge>
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed h-10">
                        {isConnected
                            ? `Manage tools and settings for ${server.name}. This server is successfully connected and ready to use.`
                            : `This server requires authentication or additional configuration before it can be used by the agent.`
                        }
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {!isConnected ? (
                        <Button
                            onClick={() => (onConfigure || onEdit)?.(server)}
                            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 rounded-xl"
                            size="sm"
                        >
                            <Settings className="h-4 w-4 mr-2" />
                            Configure
                        </Button>
                    ) : (
                        <Button
                            onClick={() => onManageTools?.(server)}
                            className="flex-1 bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 rounded-xl"
                            variant="secondary"
                            size="sm"
                        >
                            <Settings className="h-4 w-4 mr-2" />
                            Manage Tools
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
