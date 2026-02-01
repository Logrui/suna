'use client';

import React from 'react';
import { CopyButton } from './actions/CopyButton';
import { EditButton } from './actions/EditButton';
import { BranchButton } from './actions/BranchButton';
import { cn } from '@/lib/utils';

interface MessageActionsProps {
    messageId: string;
    content: string;
    showEdit?: boolean;
    showBranch?: boolean;
    onEdit?: () => void;
    onBranch?: () => void;
    className?: string;
}

export function MessageActions({
    messageId,
    content,
    showEdit = false,
    showBranch = false,
    onEdit,
    onBranch,
    className
}: MessageActionsProps) {
    return (
        <div className={cn(
            "flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            className
        )}>
            <CopyButton text={content} />

            {showEdit && onEdit && (
                <EditButton onClick={onEdit} />
            )}

            {showBranch && onBranch && (
                <BranchButton onClick={onBranch} />
            )}
        </div>
    );
}
