'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Monitor, Plus, Loader2, Globe, RefreshCw } from 'lucide-react';
import { BrowserCard } from './browser-card';
import {
    useUserBrowsers,
    useSetThreadBrowser,
    useClearThreadBrowser,
    useDeleteBrowser,
    useRenameBrowser,
    type UserBrowser,
} from '@/hooks/browser/use-user-browsers';

interface MyBrowserModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    threadId: string;
    currentBrowserId?: string | null;
}

export function MyBrowserModal({
    open,
    onOpenChange,
    threadId,
    currentBrowserId,
}: MyBrowserModalProps) {
    const { data: browsers, isLoading, isFetching, refetch } = useUserBrowsers();
    const setThreadBrowser = useSetThreadBrowser();
    const clearThreadBrowser = useClearThreadBrowser();
    const deleteBrowser = useDeleteBrowser();
    const renameBrowser = useRenameBrowser();

    const [selectedBrowserId, setSelectedBrowserId] = useState<string | null>(
        currentBrowserId ?? null
    );

    // Rename dialog state
    const [renameTarget, setRenameTarget] = useState<UserBrowser | null>(null);
    const [renameName, setRenameName] = useState('');

    // Delete confirmation state
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const hasBrowsers = browsers && browsers.length > 0;

    const handleSave = async () => {
        if (selectedBrowserId === null) {
            // Clear selection - use sandbox
            await clearThreadBrowser.mutateAsync(threadId);
        } else if (selectedBrowserId !== currentBrowserId) {
            // Set new browser
            await setThreadBrowser.mutateAsync({
                threadId,
                browserId: selectedBrowserId,
            });
        }
        onOpenChange(false);
    };

    const handleRename = (browser: UserBrowser) => {
        setRenameTarget(browser);
        setRenameName(browser.name || '');
    };

    const handleRenameSubmit = async () => {
        if (!renameTarget || !renameName.trim()) return;
        await renameBrowser.mutateAsync({
            browserId: renameTarget.id,
            name: renameName.trim(),
        });
        setRenameTarget(null);
        setRenameName('');
    };

    const handleDelete = (browserId: string) => {
        setDeleteTargetId(browserId);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTargetId) return;

        // If we're deleting the currently selected browser, clear selection
        if (selectedBrowserId === deleteTargetId) {
            setSelectedBrowserId(null);
        }

        await deleteBrowser.mutateAsync(deleteTargetId);
        setDeleteTargetId(null);
    };

    const isSaving = setThreadBrowser.isPending || clearThreadBrowser.isPending;

    // Auto-refetch when modal opens to get fresh online status
    useEffect(() => {
        if (open) {
            refetch();
        }
    }, [open, refetch]);

    // Track if this is the first load (show "Connecting..." for offline browsers)
    const isFirstLoad = isLoading && !browsers;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle className="flex items-center gap-2">
                                <Monitor className="h-5 w-5 text-purple-400" />
                                Kortix Browser
                            </DialogTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => refetch()}
                                disabled={isFetching}
                                className="h-8 w-8"
                                title="Refresh browser status"
                            >
                                <RefreshCw className={cn(
                                    "h-4 w-4",
                                    isFetching && "animate-spin"
                                )} />
                            </Button>
                        </div>
                        <DialogDescription>
                            Select which browser to use for this thread
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Loading state */}
                        {isFirstLoad && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        )}

                        {/* No browsers state */}
                        {!isLoading && !hasBrowsers && (
                            <div className={cn(
                                'relative overflow-hidden rounded-xl border border-border/50 bg-background/50 p-6 text-center'
                            )}>
                                <div
                                    className="pointer-events-none absolute inset-0 opacity-10 mix-blend-overlay"
                                    style={{ backgroundImage: "url('/noise.png')" }}
                                />

                                <div className="relative z-10 flex flex-col items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
                                        <Monitor className="h-6 w-6 text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium">No browsers connected</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Install the Kortix Browser Operator extension to enable workers to access your personal context
                                        </p>
                                    </div>
                                    <Button asChild variant="outline" className="gap-2">
                                        <a href="/connect-browser" target="_blank" rel="noopener noreferrer">
                                            <Plus className="h-4 w-4" />
                                            Connect Browser
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Browser list */}
                        {!isLoading && hasBrowsers && (
                            <div className="space-y-2">
                                {/* User's browsers */}
                                {browsers.map((browser) => (
                                    <BrowserCard
                                        key={browser.id}
                                        browser={browser}
                                        selected={selectedBrowserId === browser.id}
                                        onSelect={() => setSelectedBrowserId(browser.id)}
                                        onRename={handleRename}
                                        onDelete={handleDelete}
                                        isChecking={isFetching}
                                    />
                                ))}

                                {/* Sandbox browser option */}
                                <button
                                    type="button"
                                    onClick={() => setSelectedBrowserId(null)}
                                    className={cn(
                                        'relative w-full text-left rounded-xl border p-4 transition-all',
                                        'bg-background/50 backdrop-blur-sm',
                                        selectedBrowserId === null
                                            ? 'border-primary/50 ring-1 ring-primary/20'
                                            : 'border-border/50 hover:border-border/80'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'flex h-4 w-4 items-center justify-center rounded-full border',
                                            selectedBrowserId === null
                                                ? 'border-primary bg-primary'
                                                : 'border-muted-foreground/40'
                                        )}>
                                            {selectedBrowserId === null && (
                                                <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                                            )}
                                        </div>

                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                                            <Globe className="h-5 w-5 text-muted-foreground" />
                                        </div>

                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-sm">Use Kortix Computer</span>
                                            <span className="text-xs text-muted-foreground">
                                                Use the default Kortix Browser (default)
                                            </span>
                                        </div>
                                    </div>
                                </button>

                                {/* Add new browser link */}
                                <div className="pt-2 border-t border-border/50">
                                    <Button
                                        asChild
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                                    >
                                        <a href="/connect-browser" target="_blank" rel="noopener noreferrer">
                                            <Plus className="h-4 w-4" />
                                            Add New Browser
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Save button */}
                        {hasBrowsers && (
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Selection'
                                )}
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rename Dialog */}
            <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Rename Browser</DialogTitle>
                        <DialogDescription>
                            Enter a new name for this browser.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <Input
                            value={renameName}
                            onChange={(e) => setRenameName(e.target.value)}
                            placeholder="Browser name"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit();
                            }}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setRenameTarget(null)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleRenameSubmit}
                                disabled={!renameName.trim() || renameBrowser.isPending}
                            >
                                {renameBrowser.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Save'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Browser?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the browser from your account. You can reconnect it later by installing the extension again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteBrowser.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Delete'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
