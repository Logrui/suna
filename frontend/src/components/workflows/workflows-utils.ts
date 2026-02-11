import {
    List,
    Network,
    GitBranch,
    Play,
    Pause,
    Clock,
} from 'lucide-react';
import { type WorkflowMode, type WorkflowStatus } from '@/hooks/workflows';

// Helper function to get mode icon
export function getModeIcon(mode: WorkflowMode) {
    switch (mode) {
        case 'simple':
            return List;
        case 'advanced':
            return Network;
        case 'advanced-legacy':
            return GitBranch;
        default:
            return List;
    }
}

// Helper function to get mode styles
export function getModeStyles(mode: WorkflowMode) {
    switch (mode) {
        case 'simple':
            return { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' };
        case 'advanced':
            return { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' };
        case 'advanced-legacy':
            return { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' };
        default:
            return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
    }
}

// Helper function to get status styles
export function getStatusStyles(status: WorkflowStatus) {
    switch (status) {
        case 'active':
            return { bg: 'bg-green-500/10', text: 'text-green-500', icon: Play };
        case 'paused':
            return { bg: 'bg-yellow-500/10', text: 'text-yellow-500', icon: Pause };
        case 'draft':
            return { bg: 'bg-muted', text: 'text-muted-foreground', icon: Clock };
        case 'archived':
            return { bg: 'bg-muted/50', text: 'text-muted-foreground/60', icon: Clock };
        default:
            return { bg: 'bg-muted', text: 'text-muted-foreground', icon: Clock };
    }
}

// Time ago helper
export function getTimeAgo(date: Date): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}
