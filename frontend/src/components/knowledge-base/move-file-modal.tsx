'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FolderIcon, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Folder } from '@/hooks/react-query/knowledge-base/use-folders';

interface MoveFileModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileName: string;
    currentFolderId: string;
    folders: Folder[];
    onMove: (targetFolderId: string) => Promise<void>;
    isMoving?: boolean;
}

export function MoveFileModal({
    isOpen,
    onClose,
    fileName,
    currentFolderId,
    folders,
    onMove,
    isMoving = false,
}: MoveFileModalProps) {
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    // Set initial folder on open
    useEffect(() => {
        if (isOpen && folders.length > 0) {
            // Select the first available folder that's not the current one
            const availableFolders = folders.filter(f => f.folder_id !== currentFolderId);
            if (availableFolders.length > 0) {
                setSelectedFolderId(availableFolders[0].folder_id);
            }
        }
    }, [isOpen, folders, currentFolderId]);

    const handleMove = async () => {
        if (!selectedFolderId) return;

        setIsLoading(true);
        try {
            await onMove(selectedFolderId);
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const availableFolders = folders.filter(f => f.folder_id !== currentFolderId);
    const currentFolder = folders.find(f => f.folder_id === currentFolderId);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderIcon className="h-5 w-5" />
                        Move File
                    </DialogTitle>
                    <DialogDescription>
                        Move "{fileName}" to a different folder
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {currentFolder && (
                        <div className="p-3 bg-muted/50 rounded-lg border border-border">
                            <p className="text-sm text-muted-foreground mb-1">
                                Current location:
                            </p>
                            <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                <FolderIcon className="h-4 w-4" />
                                {currentFolder.name}
                            </p>
                        </div>
                    )}

                    {availableFolders.length === 0 ? (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                No other folders available. Create a new folder to move files.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Select destination folder:</Label>
                            <ScrollArea className="h-[300px] border rounded-lg p-4">
                                <RadioGroup value={selectedFolderId} onValueChange={setSelectedFolderId}>
                                    <div className="space-y-3">
                                        {availableFolders.map((folder) => (
                                            <div key={folder.folder_id} className="flex items-center space-x-3">
                                                <RadioGroupItem
                                                    value={folder.folder_id}
                                                    id={folder.folder_id}
                                                    disabled={isLoading || isMoving}
                                                />
                                                <Label
                                                    htmlFor={folder.folder_id}
                                                    className="flex-1 cursor-pointer flex items-center gap-2 font-normal"
                                                >
                                                    <FolderIcon className="h-4 w-4 text-muted-foreground" />
                                                    <span>{folder.name}</span>
                                                    <span className="text-xs text-muted-foreground ml-auto">
                                                        ({folder.entry_count || 0} items)
                                                    </span>
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </RadioGroup>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading || isMoving}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleMove}
                        disabled={!selectedFolderId || isLoading || isMoving || availableFolders.length === 0}
                    >
                        {isLoading || isMoving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Moving...
                            </>
                        ) : (
                            'Move File'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
