'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    FolderIcon,
    FileIcon,
    PlusIcon,
    TrashIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    MoreVerticalIcon
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensors,
    useSensor,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SharedTreeItem, FileDragOverlay } from '../knowledge-base/shared-kb-tree';
import { CommandsKbEntryModal } from './commands-kb-entry-modal';
import { KBFilePreviewModal } from '../knowledge-base/kb-file-preview-modal';
import { KBDeleteConfirmDialog } from '../knowledge-base/kb-delete-confirm-dialog';
import { useKnowledgeFolders, type Folder, type Entry } from '@/hooks/react-query/knowledge-base/use-folders';
import { FileNameValidator } from '@/lib/validation';
import { createClient } from '@/lib/supabase/client';
import { getApiUrl } from '@/lib/get-api-url';

const API_URL = getApiUrl();

interface TreeItem {
    id: string;
    type: 'folder' | 'file';
    name: string;
    parentId?: string;
    data?: Folder | Entry;
    children?: TreeItem[];
    expanded?: boolean;
}

interface CommandsBaseManagerProps {
    /** Show header with title and description */
    showHeader?: boolean;
    /** Custom header content */
    headerTitle?: string;
    headerDescription?: string;
    /** Show recent files section */
    showRecentFiles?: boolean;
    /** Show empty state message */
    emptyStateMessage?: string;
    /** Custom empty state content */
    emptyStateContent?: React.ReactNode;
    /** Maximum height for the tree view */
    maxHeight?: string;
    /** Initial folder ID from URL params (for sidebar navigation) */
    initialFolderId?: string;
    /** Initial file ID from URL params (for sidebar navigation) */
    initialFileId?: string;
}

export function CommandsBaseManager({
    showHeader = true,
    headerTitle = "Slash Commands",
    headerDescription = "Manage your custom slash commands",
    showRecentFiles = true,
    emptyStateMessage,
    emptyStateContent,
    maxHeight,
    initialFolderId,
    initialFileId
}: CommandsBaseManagerProps) {
    const router = useRouter();
    const [treeData, setTreeData] = useState<TreeItem[]>([]);
    const [folderEntries, setFolderEntries] = useState<{ [folderId: string]: Entry[] }>({});
    const [loadingFolders, setLoadingFolders] = useState<{ [folderId: string]: boolean }>({});
    const [movingFiles, setMovingFiles] = useState<{ [fileId: string]: boolean }>({});
    const [selectedItem, setSelectedItem] = useState<TreeItem | null>(null);
    const [editingFolder, setEditingFolder] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // Modal states
    const [deleteConfirm, setDeleteConfirm] = useState<{
        isOpen: boolean;
        item: { id: string; name: string; type: 'folder' | 'file' } | null;
        isDeleting: boolean;
    }>({
        isOpen: false,
        item: null,
        isDeleting: false,
    });

    const [uploadStatus, setUploadStatus] = useState<{
        [folderId: string]: {
            isUploading: boolean;
            progress: number;
            currentFile?: string;
            totalFiles?: number;
            completedFiles?: number;
        };
    }>({});

    const [filePreviewModal, setFilePreviewModal] = useState<{
        isOpen: boolean;
        file: Entry | null;
    }>({
        isOpen: false,
        file: null,
    });

    const { folders, recentFiles, loading: foldersLoading, refetch: refetchFolders } = useKnowledgeFolders();

    // Get Suna folder
    const sunaFolder = folders.find(f => f.name === 'Suna');

    // DND Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Build tree structure for Suna folder only
    React.useEffect(() => {
        const buildTree = () => {
            if (!sunaFolder) {
                setTreeData([]);
                return;
            }

            const tree: TreeItem[] = [{
                id: sunaFolder.folder_id,
                type: 'folder' as const,
                name: sunaFolder.name,
                data: sunaFolder,
                children: folderEntries[sunaFolder.folder_id]?.map(entry => ({
                    id: entry.entry_id,
                    type: 'file' as const,
                    name: entry.filename,
                    parentId: sunaFolder.folder_id,
                    data: entry,
                })) || [],
                expanded: true, // Always expand Suna folder
            }];
            setTreeData(tree);
        };

        buildTree();
    }, [folders, folderEntries, sunaFolder]);

    // Auto-fetch Suna folder entries
    React.useEffect(() => {
        if (!foldersLoading && sunaFolder && !folderEntries[sunaFolder.folder_id]) {
            fetchFolderEntries(sunaFolder.folder_id);
        }
    }, [sunaFolder, foldersLoading, folderEntries]);

    // Handle URL params for sidebar navigation
    React.useEffect(() => {
        if (foldersLoading || !sunaFolder) return;

        // Handle file navigation from sidebar
        if (initialFileId && sunaFolder.folder_id) {
            // Make sure folder is loaded first
            if (!folderEntries[sunaFolder.folder_id]) {
                fetchFolderEntries(sunaFolder.folder_id);
            }
            
            // Find the file in folder entries and open preview
            setTimeout(() => {
                const entries = folderEntries[sunaFolder.folder_id];
                if (entries) {
                    const file = entries.find(e => e.entry_id === initialFileId);
                    if (file) {
                        setFilePreviewModal({
                            isOpen: true,
                            file: file,
                        });
                    }
                }
            }, 500);
        }
    }, [initialFileId, foldersLoading, sunaFolder, folderEntries]);

    // File handling functions
    const handleFileSelect = (item: TreeItem) => {
        if (item.type === 'file' && item.data && 'entry_id' in item.data) {
            const entry = item.data as Entry;
            
            // Update URL to reflect selection
            router.replace(`/slash-commands?file=${entry.entry_id}`, { scroll: false });
            
            setFilePreviewModal({
                isOpen: true,
                file: entry,
            });
        } else {
            setSelectedItem(item);
        }
    };

    const handleCloseFilePreview = () => {
        // Clear file param from URL when closing preview
        router.replace('/slash-commands', { scroll: false });
        setFilePreviewModal({ isOpen: false, file: null });
    };

    const fetchFolderEntries = async (folderId: string) => {
        setLoadingFolders(prev => ({ ...prev, [folderId]: true }));

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('No session found');
            }

            const response = await fetch(`${API_URL}/knowledge-base/folders/${folderId}/entries`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setFolderEntries(prev => ({ ...prev, [folderId]: data }));
            }
        } catch (error) {
            console.error('Failed to fetch entries:', error);
        } finally {
            setLoadingFolders(prev => ({ ...prev, [folderId]: false }));
        }
    };

    const handleExpand = async (folderId: string) => {
        const folder = treeData.find(item => item.id === folderId);
        const isCurrentlyExpanded = folder?.expanded;

        setTreeData(prev =>
            prev.map(item =>
                item.id === folderId
                    ? { ...item, expanded: !item.expanded }
                    : item
            )
        );

        if (folder && !isCurrentlyExpanded && !folderEntries[folderId]) {
            await fetchFolderEntries(folderId);
        }

        if (isCurrentlyExpanded) {
            setLoadingFolders(prev => ({ ...prev, [folderId]: false }));
        }
    };

    const handleDelete = (id: string, type: 'folder' | 'file') => {
        const item = treeData.flatMap(folder => [folder, ...(folder.children || [])])
            .find(item => item.id === id);

        if (!item) return;

        setDeleteConfirm({
            isOpen: true,
            item: { id, name: item.name, type },
            isDeleting: false,
        });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm.item) return;

        const { id, type } = deleteConfirm.item;
        setDeleteConfirm(prev => ({ ...prev, isDeleting: true }));

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('No session found');
            }

            const endpoint = type === 'folder'
                ? `${API_URL}/knowledge-base/folders/${id}`
                : `${API_URL}/knowledge-base/entries/${id}`;

            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                toast.success(`${type === 'folder' ? 'Folder' : 'File'} deleted`);
                refetchFolders();

                if (type === 'folder') {
                    if (selectedItem?.id === id) {
                        setSelectedItem(null);
                    }
                } else {
                    const parentFolder = treeData.find(folder =>
                        folder.children?.some(child => child.id === id)
                    );
                    if (parentFolder) {
                        await fetchFolderEntries(parentFolder.id);
                    }
                }
            } else {
                toast.error(`Failed to delete ${type}`);
            }
        } catch (error) {
            toast.error(`Failed to delete ${type}`);
        } finally {
            setDeleteConfirm({
                isOpen: false,
                item: null,
                isDeleting: false,
            });
        }
    };

    const handleMoveFile = async (fileId: string, targetFolderId: string) => {
        setMovingFiles(prev => ({ ...prev, [fileId]: true }));

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('No session found');
            }

            const response = await fetch(`${API_URL}/knowledge-base/entries/${fileId}/move`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    folder_id: targetFolderId
                })
            });

            if (response.ok) {
                toast.success('Command moved successfully');
                refetchFolders();
                const movedItem = treeData.flatMap(folder => folder.children || []).find(file => file.id === fileId);
                if (movedItem) {
                    await fetchFolderEntries(movedItem.parentId!);
                    await fetchFolderEntries(targetFolderId);
                }
            } else {
                toast.error('Failed to move command');
            }
        } catch (error) {
            toast.error('Failed to move command');
        } finally {
            setMovingFiles(prev => ({ ...prev, [fileId]: false }));
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            setActiveId(null);
            return;
        }

        const activeItemId = active.id.toString();
        const overItemId = over.id.toString().replace('droppable-', '');

        const activeItem = treeData.flatMap(folder => [folder, ...(folder.children || [])]).find(item => item.id === activeItemId);
        const overItem = treeData.flatMap(folder => [folder, ...(folder.children || [])]).find(item => item.id === overItemId);

        if (!activeItem || !overItem) {
            setActiveId(null);
            return;
        }

        if (activeItem.type === 'file' && overItem.type === 'folder') {
            handleMoveFile(activeItem.id, overItem.id);
        }

        setActiveId(null);
    };

    // Handle file drops
    const handleNativeFileDrop = async (files: FileList, folderId: string) => {
        if (!sunaFolder) {
            toast.error('Suna folder not found');
            return;
        }

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('No session found');
            }

            const fileArray = Array.from(files);
            const totalFiles = fileArray.length;

            setUploadStatus(prev => ({
                ...prev,
                [folderId]: {
                    isUploading: true,
                    progress: 0,
                    totalFiles,
                    completedFiles: 0,
                    currentFile: fileArray[0]?.name
                }
            }));

            let successCount = 0;

            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];

                const validation = FileNameValidator.validateName(file.name, 'file');
                if (!validation.isValid) {
                    toast.error(`Invalid filename "${file.name}": ${FileNameValidator.getFriendlyErrorMessage(file.name, 'file')}`);
                    continue;
                }

                setUploadStatus(prev => ({
                    ...prev,
                    [folderId]: {
                        ...prev[folderId],
                        currentFile: file.name,
                        progress: (i / totalFiles) * 100
                    }
                }));

                try {
                    const formData = new FormData();
                    formData.append('file', file);

                    const response = await fetch(`${API_URL}/knowledge-base/folders/${folderId}/upload`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: formData
                    });

                    if (response.ok) {
                        const result = await response.json();
                        successCount++;

                        if (result.filename_changed) {
                            toast.info(`File "${result.original_filename}" was renamed to "${result.final_filename}" to avoid conflicts`);
                        }
                    } else {
                        if (response.status === 413) {
                            try {
                                const errorData = await response.json();
                                toast.error(`Knowledge base limit exceeded: ${errorData.detail || 'Total file size limit (50MB) exceeded'}`);
                            } catch {
                                toast.error('Knowledge base limit exceeded: Total file size limit (50MB) exceeded');
                            }
                        } else {
                            toast.error(`Failed to upload ${file.name}: Error ${response.status}`);
                        }
                    }
                } catch (error) {
                    toast.error(`Error uploading ${file.name}`);
                }

                setUploadStatus(prev => ({
                    ...prev,
                    [folderId]: {
                        ...prev[folderId],
                        completedFiles: i + 1,
                        progress: ((i + 1) / totalFiles) * 100
                    }
                }));
            }

            setTimeout(() => {
                setUploadStatus(prev => {
                    const newStatus = { ...prev };
                    delete newStatus[folderId];
                    return newStatus;
                });
            }, 3000);

            if (successCount === totalFiles) {
                toast.success(`Successfully uploaded ${successCount} file(s)`);
            } else if (successCount > 0) {
                toast.success(`Uploaded ${successCount} of ${totalFiles} files`);
            }

            refetchFolders();
            await fetchFolderEntries(folderId);

        } catch (error) {
            console.error('Error uploading files:', error);
            toast.error('Failed to upload files');

            setUploadStatus(prev => {
                const newStatus = { ...prev };
                delete newStatus[folderId];
                return newStatus;
            });
        }
    };

    // Format date helper
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays} days ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    const getFileTypeInfo = (filename: string) => {
        const extension = filename.split('.').pop()?.toLowerCase() || '';
        const fileType = extension.toUpperCase();

        const getTypeColor = (ext: string) => {
            switch (ext) {
                case 'md': return 'bg-blue-100 text-blue-700 border-blue-200';
                case 'txt': return 'bg-gray-100 text-gray-700 border-gray-200';
                case 'prompt': return 'bg-purple-100 text-purple-700 border-purple-200';
                default: return 'bg-slate-100 text-slate-700 border-slate-200';
            }
        };

        return {
            extension: fileType,
            colorClass: getTypeColor(extension)
        };
    };

    if (foldersLoading) {
        return (
            <div className="space-y-4">
                {showHeader && (
                    <div className="flex justify-between items-start">
                        <div>
                            <Skeleton className="h-6 w-32 mb-2" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                        <Skeleton className="h-8 w-24" />
                    </div>
                )}
                <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 rounded-lg border border-border/30">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-6 w-6" />
                    </div>
                    
                    <div className="ml-6 space-y-2">
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-border/20">
                            <Skeleton className="h-9 w-9 rounded-lg" />
                            <div className="flex-1 space-y-1">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="h-6 w-6" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header Section */}
            {showHeader && (
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-semibold">{headerTitle}</h3>
                        <p className="text-sm text-muted-foreground">
                            {headerDescription}
                        </p>
                    </div>
                    {sunaFolder && (
                        <CommandsKbEntryModal
                            folders={[sunaFolder]}
                            sunaFolderId={sunaFolder.folder_id}
                            onUploadComplete={() => {
                                refetchFolders();
                            }}
                            trigger={
                                <Button size="sm" className="gap-2">
                                    <PlusIcon className="h-4 w-4" />
                                    Create Command
                                </Button>
                            }
                        />
                    )}
                </div>
            )}

            {/* Recent Files Section */}
            {showRecentFiles && recentFiles.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-medium text-foreground">
                            Recently Added
                        </h3>
                        <span className="text-xs text-muted-foreground">
                            {recentFiles.length} commands
                        </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
                        {recentFiles.slice(0, 6).map((file) => {
                            const fileInfo = getFileTypeInfo(file.filename);
                            return (
                                <div
                                    key={file.entry_id}
                                    className="group cursor-pointer"
                                    onClick={() => setFilePreviewModal({
                                        isOpen: true,
                                        file: file,
                                    })}
                                >
                                    <div className="relative bg-muted/20 border border-border/50 rounded-lg p-4 transition-all duration-200 hover:bg-muted/30 hover:border-border">
                                        <div className="flex flex-col items-center space-y-3">
                                            <div className="relative">
                                                <div className="w-12 h-12 bg-muted/80 rounded-lg flex items-center justify-center">
                                                    <FileIcon className="h-6 w-6 text-foreground/60" />
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 bg-background border border-border rounded px-1 py-0.5">
                                                    <span className="text-[8px] font-medium text-muted-foreground uppercase">
                                                        {fileInfo.extension.slice(0, 3)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-center space-y-1 w-full">
                                                <p className="text-xs font-medium text-foreground truncate" title={file.filename}>
                                                    {file.filename.length > 12 ? `${file.filename.slice(0, 12)}...` : file.filename}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(file.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div 
                className="space-y-4"
                style={{ maxHeight }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
            >
                {treeData.length === 0 ? (
                    emptyStateContent ? emptyStateContent : (
                        <div className="text-center py-12 px-6 bg-muted/30 rounded-xl border-2 border-dashed border-border">
                            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 border">
                                <FileIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h4 className="text-sm font-semibold text-foreground mb-2">
                                No Slash Commands Yet
                            </h4>
                            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                                {emptyStateMessage || "Create your first slash command to get started with custom prompts."}
                            </p>
                            {sunaFolder && (
                                <CommandsKbEntryModal
                                    folders={[sunaFolder]}
                                    sunaFolderId={sunaFolder.folder_id}
                                    onUploadComplete={() => {
                                        refetchFolders();
                                    }}
                                    trigger={
                                        <Button size="sm" className="gap-2">
                                            <PlusIcon className="h-4 w-4" />
                                            Create Command
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                    )
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={[]}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-3">
                                {treeData.map((item) => {
                                    return (
                                        <SharedTreeItem
                                            key={item.id}
                                            item={item}
                                            onExpand={handleExpand}
                                            onSelect={handleFileSelect}
                                            enableDnd={true}
                                            enableActions={true}
                                            enableEdit={true}
                                            enableAssignment={false}
                                            onDelete={handleDelete}
                                            editingFolder={editingFolder}
                                            editingName={editingName}
                                            onStartEdit={() => {}}
                                            onFinishEdit={() => {}}
                                            onEditChange={() => {}}
                                            onEditKeyPress={() => {}}
                                            editInputRef={editInputRef}
                                            onNativeFileDrop={handleNativeFileDrop}
                                            uploadStatus={uploadStatus[item.id]}
                                            validationError={editingFolder === item.id ? validationError : null}
                                            isLoadingEntries={loadingFolders[item.id]}
                                            movingFiles={movingFiles}
                                        />
                                    );
                                })}
                            </div>
                        </SortableContext>

                        <DragOverlay>
                            {activeId ? (() => {
                                const findActiveItem = (items: TreeItem[]): TreeItem | null => {
                                    for (const item of items) {
                                        if (item.id === activeId) return item;
                                        if (item.children) {
                                            const found = findActiveItem(item.children);
                                            if (found) return found;
                                        }
                                    }
                                    return null;
                                };

                                const activeItem = findActiveItem(treeData);

                                if (activeItem?.type === 'file') {
                                    return <FileDragOverlay item={activeItem} />;
                                } else {
                                    return (
                                        <div className="bg-background border rounded-lg p-3">
                                            <div className="flex items-center gap-2">
                                                <FolderIcon className="h-4 w-4" />
                                                <span className="font-medium text-sm">
                                                    {activeItem?.name}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }
                            })() : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>

            {/* Modals */}
            <KBDeleteConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, item: null, isDeleting: false })}
                onConfirm={confirmDelete}
                itemName={deleteConfirm.item?.name || ''}
                itemType={deleteConfirm.item?.type || 'file'}
                isDeleting={deleteConfirm.isDeleting}
            />

            {filePreviewModal.file && (
                <KBFilePreviewModal
                    isOpen={filePreviewModal.isOpen}
                    onClose={handleCloseFilePreview}
                    file={filePreviewModal.file}
                    onEditSummary={() => {}}
                />
            )}
        </div>
    );
}
