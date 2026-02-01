'use client';

import React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ThreadBranchModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (name: string) => void;
    loading?: boolean;
    initialName?: string;
}

export function ThreadBranchModal({ 
    open, 
    onOpenChange, 
    onConfirm, 
    loading = false,
    initialName = ""
}: ThreadBranchModalProps) {
    const [name, setName] = React.useState(initialName);

    React.useEffect(() => {
        if (open) {
            setName(initialName);
        }
    }, [open, initialName]);

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Branch Conversation</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will create a new thread branching from this message. The new thread will include all messages up to this point.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="grid gap-2 py-4">
                    <Label htmlFor="name">Thread Name</Label>
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter thread name..."
                        disabled={loading}
                    />
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm(name);
                        }}
                        disabled={loading || !name.trim()}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Branch
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
