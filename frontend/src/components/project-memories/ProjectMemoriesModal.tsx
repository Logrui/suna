'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    Plus,
    Trash2,
    Pencil,
    Search,
    X,
    Loader2,
    BookOpen,
    Lightbulb,
    Settings2,
    FileText,
    Check,
    AlertTriangle,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useProjectMemoriesModalStore } from '@/stores/use-project-memories-modal-store';
import {
    listProjectMemories,
    createProjectMemory,
    updateProjectMemory,
    deleteProjectMemory as deleteMemoryApi,
    type ProjectMemory,
    type MemoryType,
} from '@/lib/api/project-memories';

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const MEMORY_TYPES: { value: MemoryType; label: string; icon: React.ReactNode }[] = [
    { value: 'fact', label: 'Fact', icon: <BookOpen className="h-3.5 w-3.5" /> },
    { value: 'preference', label: 'Preference', icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { value: 'instruction', label: 'Instruction', icon: <Settings2 className="h-3.5 w-3.5" /> },
    { value: 'context', label: 'Context', icon: <FileText className="h-3.5 w-3.5" /> },
];

const TYPE_STYLES: Record<string, { badge: string; dot: string }> = {
    fact: {
        badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
        dot: 'bg-blue-500',
    },
    preference: {
        badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
        dot: 'bg-amber-500',
    },
    instruction: {
        badge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800',
        dot: 'bg-violet-500',
    },
    context: {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
        dot: 'bg-emerald-500',
    },
};

// ────────────────────────────────────────────────────────────────
// Memory Card
// ────────────────────────────────────────────────────────────────

interface MemoryCardProps {
    memory: ProjectMemory;
    onEdit: (memory: ProjectMemory) => void;
    onDelete: (memoryId: string) => void;
    isDeleting: boolean;
}

const MemoryCard: React.FC<MemoryCardProps> = ({
    memory,
    onEdit,
    onDelete,
    isDeleting,
}) => {
    const style = TYPE_STYLES[memory.memory_type] ?? TYPE_STYLES.fact;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="group relative rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 hover:border-border transition-all"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', style.dot)} />
                        <Badge
                            variant="outline"
                            className={cn('text-[10px] h-4 px-1.5 py-0 font-normal capitalize', style.badge)}
                        >
                            {memory.memory_type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                            {new Date(memory.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {memory.content}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onEdit(memory)}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => onDelete(memory.memory_id)}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </motion.div>
    );
};

// ────────────────────────────────────────────────────────────────
// Add / Edit Form
// ────────────────────────────────────────────────────────────────

interface MemoryFormProps {
    initial?: ProjectMemory | null;
    onSubmit: (content: string, memoryType: MemoryType) => Promise<void>;
    onCancel: () => void;
    isSubmitting: boolean;
}

const MemoryForm: React.FC<MemoryFormProps> = ({
    initial,
    onSubmit,
    onCancel,
    isSubmitting,
}) => {
    const [content, setContent] = useState(initial?.content ?? '');
    const [memoryType, setMemoryType] = useState<MemoryType>(
        initial?.memory_type ?? 'fact'
    );

    const handleSubmit = async () => {
        if (!content.trim()) return;
        await onSubmit(content.trim(), memoryType);
    };

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
        >
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter memory content..."
                    className="min-h-[80px] resize-none text-sm"
                    autoFocus
                />
                <div className="flex items-center justify-between gap-3">
                    <Select
                        value={memoryType}
                        onValueChange={(v) => setMemoryType(v as MemoryType)}
                    >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MEMORY_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-xs">
                                    <div className="flex items-center gap-2">
                                        {t.icon}
                                        {t.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            className="h-8 text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={!content.trim() || isSubmitting}
                            className="h-8 text-xs"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                                <Check className="h-3.5 w-3.5 mr-1" />
                            )}
                            {initial ? 'Update' : 'Add'}
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ────────────────────────────────────────────────────────────────
// Main Modal
// ────────────────────────────────────────────────────────────────

export const ProjectMemoriesModal: React.FC = () => {
    const { isOpen, projectId, projectName, closeModal } =
        useProjectMemoriesModalStore();

    const [memories, setMemories] = useState<ProjectMemory[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<MemoryType | 'all'>('all');
    const [showForm, setShowForm] = useState(false);
    const [editingMemory, setEditingMemory] = useState<ProjectMemory | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Fetch memories
    const fetchMemories = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await listProjectMemories(projectId, { pageSize: 100 });
            setMemories(res.memories);
        } catch (err) {
            console.error('Failed to fetch project memories:', err);
            setError('Failed to load memories');
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (isOpen && projectId) {
            fetchMemories();
        } else {
            setMemories([]);
            setSearchQuery('');
            setFilterType('all');
            setShowForm(false);
            setEditingMemory(null);
        }
    }, [isOpen, projectId, fetchMemories]);

    // Filtered memories
    const filteredMemories = memories.filter((m) => {
        const matchesType = filterType === 'all' || m.memory_type === filterType;
        const matchesSearch =
            !searchQuery ||
            m.content.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesType && matchesSearch;
    });

    // Group by type
    const groupedMemories = filteredMemories.reduce<Record<string, ProjectMemory[]>>(
        (acc, m) => {
            const key = m.memory_type;
            if (!acc[key]) acc[key] = [];
            acc[key].push(m);
            return acc;
        },
        {}
    );

    // CRUD handlers
    const handleCreate = async (content: string, memoryType: MemoryType) => {
        if (!projectId) return;
        setIsSubmitting(true);
        try {
            await createProjectMemory(projectId, { content, memory_type: memoryType });
            toast.success('Memory added');
            setShowForm(false);
            await fetchMemories();
        } catch (err) {
            console.error('Create memory error:', err);
            toast.error('Failed to add memory');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async (content: string, memoryType: MemoryType) => {
        if (!projectId || !editingMemory) return;
        setIsSubmitting(true);
        try {
            await updateProjectMemory(projectId, editingMemory.memory_id, {
                content,
                memory_type: memoryType,
            });
            toast.success('Memory updated');
            setEditingMemory(null);
            await fetchMemories();
        } catch (err) {
            console.error('Update memory error:', err);
            toast.error('Failed to update memory');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (memoryId: string) => {
        if (!projectId) return;
        setDeletingId(memoryId);
        try {
            await deleteMemoryApi(projectId, memoryId);
            toast.success('Memory deleted');
            setMemories((prev) => prev.filter((m) => m.memory_id !== memoryId));
        } catch (err) {
            console.error('Delete memory error:', err);
            toast.error('Failed to delete memory');
        } finally {
            setDeletingId(null);
        }
    };

    const handleEdit = (memory: ProjectMemory) => {
        setEditingMemory(memory);
        setShowForm(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden border-border/50 bg-background/95 backdrop-blur-xl">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 border border-violet-500/20">
                            <Brain className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-medium tracking-tight">
                                Project Memories
                            </DialogTitle>
                            {projectName && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {projectName}
                                </p>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-border/30 flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search memories..."
                            className="pl-9 h-9 text-sm"
                        />
                        {searchQuery && (
                            <button
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setSearchQuery('')}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <Select
                        value={filterType}
                        onValueChange={(v) => setFilterType(v as MemoryType | 'all')}
                    >
                        <SelectTrigger className="w-[120px] h-9 text-xs">
                            <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="text-xs">
                                All types
                            </SelectItem>
                            {MEMORY_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-xs">
                                    <div className="flex items-center gap-2">
                                        {t.icon}
                                        {t.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setShowForm(true);
                                    setEditingMemory(null);
                                }}
                                disabled={showForm}
                                className="h-9 text-xs gap-1"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add a new memory</TooltipContent>
                    </Tooltip>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-6 py-4 space-y-4">
                        {/* Add / Edit Form */}
                        <AnimatePresence>
                            {showForm && (
                                <MemoryForm
                                    onSubmit={handleCreate}
                                    onCancel={() => setShowForm(false)}
                                    isSubmitting={isSubmitting}
                                />
                            )}
                            {editingMemory && (
                                <MemoryForm
                                    initial={editingMemory}
                                    onSubmit={handleUpdate}
                                    onCancel={() => setEditingMemory(null)}
                                    isSubmitting={isSubmitting}
                                />
                            )}
                        </AnimatePresence>

                        {/* Loading */}
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-4" />
                                <p className="text-sm text-muted-foreground">
                                    Loading memories...
                                </p>
                            </div>
                        )}

                        {/* Error */}
                        {error && !isLoading && (
                            <div className="flex flex-col items-center justify-center py-16">
                                <AlertTriangle className="h-8 w-8 text-destructive mb-4" />
                                <p className="text-sm text-destructive">{error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchMemories}
                                    className="mt-3"
                                >
                                    Retry
                                </Button>
                            </div>
                        )}

                        {/* Empty state */}
                        {!isLoading && !error && filteredMemories.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gradient-to-b from-violet-100 to-violet-50 shadow-inner dark:from-violet-800/30 dark:to-violet-900/50">
                                    <Brain className="h-8 w-8 text-violet-400 dark:text-violet-500" />
                                </div>
                                <h3 className="text-base font-medium mb-1 text-foreground">
                                    {searchQuery || filterType !== 'all'
                                        ? 'No matching memories'
                                        : 'No memories yet'}
                                </h3>
                                <p className="text-xs text-muted-foreground text-center max-w-xs">
                                    {searchQuery || filterType !== 'all'
                                        ? 'Try adjusting your search or filter.'
                                        : 'Add memories to give the AI context about this project. Memories persist across all conversations.'}
                                </p>
                                {!showForm && !searchQuery && filterType === 'all' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowForm(true)}
                                        className="mt-4 gap-1"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add first memory
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Memory list grouped by type */}
                        {!isLoading &&
                            !error &&
                            Object.entries(groupedMemories).map(([type, mems]) => (
                                <div key={type} className="space-y-2">
                                    <div className="flex items-center gap-2 px-1">
                                        <div
                                            className={cn(
                                                'w-1.5 h-1.5 rounded-full',
                                                TYPE_STYLES[type]?.dot ?? 'bg-zinc-400'
                                            )}
                                        />
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            {type}s
                                        </span>
                                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                                            {mems.length}
                                        </Badge>
                                    </div>
                                    <AnimatePresence mode="popLayout">
                                        {mems.map((memory) => (
                                            <MemoryCard
                                                key={memory.memory_id}
                                                memory={memory}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                                isDeleting={deletingId === memory.memory_id}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            ))}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-border/30 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
                    </span>
                    <Button variant="ghost" size="sm" onClick={closeModal} className="h-8 text-xs">
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
