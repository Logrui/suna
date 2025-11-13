'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SLASH_COMMANDS_FOLDER_NAME } from '../slash-commands/types';
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
import { SharedTreeItem, FileDragOverlay } from './shared-kb-tree';
import { KBFilePreviewModal } from './kb-file-preview-modal';
import { EditSummaryModal } from './edit-summary-modal';
import { KBDeleteConfirmDialog } from './kb-delete-confirm-dialog';
import { MoveFileModal } from './move-file-modal';
import { useKnowledgeFolders, type Folder, type Entry } from '@/hooks/react-query/knowledge-base/use-folders';
import { FileNameValidator } from '@/lib/validation';
import { createClient } from '@/lib/supabase/client';
import { getApiUrl } from '@/lib/get-api-url';
import { downloadFile, downloadFolderAsZip } from '@/lib/kb-download-utils';
import { CommandsKbEntryModal } from '../slash-commands/commands-kb-entry-modal';
import { useKbHandlers } from '@/hooks/use-kb-handlers';

const API_URL = getApiUrl();
const PROMPTS_FOLDER_NAME = SLASH_COMMANDS_FOLDER_NAME;

interface TreeItem {
    id: string;
    type: 'folder' | 'file';
    name: string;
    parentId?: string;
    data?: Folder | Entry;
    children?: TreeItem[];
    expanded?: boolean;
}

export function PromptsTab() {
    const router = useRouter();
    const [treeData, setTreeData] = useState<TreeItem[]>([]);
    const [folderEntries, setFolderEntries] = useState<{ [folderId: string]: Entry[] }>({});
    const [loadingFolders, setLoadingFolders] = useState<{ [folderId: string]: boolean }>({});
    const [selectedItem, setSelectedItem] = useState<TreeItem | null>(null);
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

    const [editSummaryEntry, setEditSummaryEntry] = useState<Entry | null>(null);

    const [moveFileModal, setMoveFileModal] = useState<{
        isOpen: boolean;
        fileId: string | null;
        fileName: string;
        currentFolderId: string;
    }>({
        isOpen: false,
        fileId: null,
        fileName: '',
        currentFolderId: '',
    });

    // Use shared KB handlers hook
    const { renamingFolderId, setRenamingFolderId, renameValue, setRenameValue, renameInputRef, movingFiles, handleRenameFolder, handleDeleteFile, handleMoveFile } = useKbHandlers();

    const { folders, recentFiles, loading: foldersLoading, refetch: refetchFolders } = useKnowledgeFolders();

    // Get prompts folder
    const promptsFolder = folders.find(f => f.name === PROMPTS_FOLDER_NAME);

    // DND Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Build tree structure for prompts folder only
    React.useEffect(() => {
        const buildTree = () => {
            if (!promptsFolder) {
                setTreeData([]);
                return;
            }

            const tree: TreeItem[] = [{
                id: promptsFolder.folder_id,
                type: 'folder' as const,
                name: promptsFolder.name,
                data: promptsFolder,
                children: folderEntries[promptsFolder.folder_id]?.map(entry => ({
                    id: entry.entry_id,
                    type: 'file' as const,
                    name: entry.filename,
                    parentId: promptsFolder.folder_id,
                    data: entry,
                })) || [],
                expanded: true, // Always expand prompts folder
            }];
            setTreeData(tree);
        };

        buildTree();
    }, [folders, folderEntries, promptsFolder]);

    // Auto-fetch prompts folder entries
    React.useEffect(() => {
        if (!foldersLoading && promptsFolder && !folderEntries[promptsFolder.folder_id]) {
            fetchFolderEntries(promptsFolder.folder_id);
        }
    }, [promptsFolder, foldersLoading, folderEntries]);

    // File handling functions
    const handleFileSelect = (item: TreeItem) => {
        if (item.type === 'file' && item.data && 'entry_id' in item.data) {
            const entry = item.data as Entry;
            setFilePreviewModal({
                isOpen: true,
                file: entry,
            });
        } else {
            setSelectedItem(item);
        }
    };

    const handleCloseFilePreview = () => {
        setFilePreviewModal({ isOpen: false, file: null });
    };

    const fetchFolderEntries = async (folderId: string) => {
        if (!folderId) {
            console.error('[PromptsTab] fetchFolderEntries called with undefined folderId');
            return;
        }
        
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

    // Handle move file with refetch
    const handleMoveFileLocal = async (fileId: string, targetFolderId: string) => {
        const movedFile = Object.values(folderEntries).flat().find(f => f.entry_id === fileId);
        const fromFolderId = Object.entries(folderEntries).find(([_, files]) => files.find(f => f.entry_id === fileId))?.[0];
        
        if (!fromFolderId || !movedFile) return;
        
        await handleMoveFile(fileId, fromFolderId, targetFolderId, folderEntries, setFolderEntries);
        
        // Refetch the folders to update tree
        await refetchFolders();
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
            handleMoveFileLocal(activeItem.id, overItem.id);
        }

        setActiveId(null);
    };

    // Handle file drops
    const handleNativeFileDrop = async (files: FileList, folderId: string) => {
        if (!promptsFolder) {
            toast.error('Prompts folder not found');
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
                    formData.append('skip_summary', 'true'); // Skip LLM processing for prompt files

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

    if (foldersLoading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-start">
                    <div>
                        <Skeleton className="h-6 w-32 mb-2" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                </div>
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
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-semibold">Prompts</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage your custom prompts and templates
                    </p>
                </div>
                {promptsFolder && (
                    <CommandsKbEntryModal
                        folders={[promptsFolder]}
                        promptsFolderId={promptsFolder.folder_id}
                        onUploadComplete={() => {
                            refetchFolders();
                        }}
                        trigger={
                            <Button size="sm" className="gap-2">
                                <PlusIcon className="h-4 w-4" />
                                Create Prompt
                            </Button>
                        }
                    />
                )}
            </div>

            {/* Main Content */}
            <div 
                className="space-y-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
            >
                {treeData.length === 0 ? (
                    <div className="text-center py-12 px-6 bg-muted/30 rounded-xl border-2 border-dashed border-border">
                        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 border">
                            <FileIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                            No Prompts Yet
                        </h4>
                        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                            Create your first prompt to get started with custom templates.
                        </p>
                        {promptsFolder && (
                            <CommandsKbEntryModal
                                folders={[promptsFolder]}
                                promptsFolderId={promptsFolder.folder_id}
                                onUploadComplete={() => {
                                    refetchFolders();
                                }}
                                trigger={
                                    <Button size="sm" className="gap-2">
                                        <PlusIcon className="h-4 w-4" />
                                        Create Prompt
                                    </Button>
                                }
                            />
                        )}
                    </div>
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
                                            onMoveFile={(fileId, fileName) => {
                                                const file = Object.values(folderEntries).flat().find(f => f.entry_id === fileId);
                                                if (file) {
                                                    const currentFolderId = Object.entries(folderEntries).find(([_, files]) => files.find(f => f.entry_id === fileId))?.[0];
                                                    if (currentFolderId) {
                                                        setMoveFileModal({
                                                            isOpen: true,
                                                            fileId,
                                                            fileName,
                                                            currentFolderId,
                                                        });
                                                    }
                                                }
                                            }}
                                            onDownloadFile={(fileId, fileName) => {
                                                console.log('[PromptsTab] onDownloadFile called:', { fileId, fileName });
                                                downloadFile(fileId, fileName);
                                            }}
                                            onDownloadFolder={(folderId, folderName) => {
                                                downloadFolderAsZip(folderId, folderName);
                                            }}
                                            onNativeFileDrop={handleNativeFileDrop}
                                            uploadStatus={uploadStatus[item.id]}
                                            isLoadingEntries={loadingFolders[item.id]}
                                            movingFiles={movingFiles}
                                            editingFolder={renamingFolderId}
                                            editingName={renameValue}
                                            onStartEdit={(id, name) => {
                                                setRenamingFolderId(id);
                                                setRenameValue(name);
                                            }}
                                            onEditChange={setRenameValue}
                                            onFinishEdit={() => {
                                                if (renamingFolderId) {
                                                    handleRenameFolder(renamingFolderId, renameValue, treeData, setTreeData);
                                                }
                                            }}
                                            editInputRef={renameInputRef}
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
                    onEditSummary={(fileId, fileName, summary) => {
                        // Close preview and open edit summary modal
                        setFilePreviewModal({ isOpen: false, file: null });
                        if (editSummaryEntry) {
                            setEditSummaryEntry({
                                ...editSummaryEntry,
                                summary: summary
                            });
                        }
                    }}
                />
            )}

            {editSummaryEntry && (
                <EditSummaryModal
                    isOpen={!!editSummaryEntry}
                    onClose={() => setEditSummaryEntry(null)}
                    fileName={editSummaryEntry.filename}
                    currentSummary={editSummaryEntry.summary || ''}
                    onSave={async (summary) => {
                        try {
                            const supabase = createClient();
                            const { data: { session } } = await supabase.auth.getSession();

                            if (!session?.access_token) {
                                toast.error('Authentication required');
                                return;
                            }

                            const response = await fetch(`${API_URL}/knowledge-base/entries/${editSummaryEntry.entry_id}`, {
                                method: 'PATCH',
                                headers: {
                                    'Authorization': `Bearer ${session.access_token}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ summary }),
                            });

                            if (response.ok) {
                                toast.success('Summary updated successfully');
                                await refetchFolders();
                                setEditSummaryEntry(null);
                            } else {
                                toast.error('Failed to update summary');
                            }
                        } catch (error) {
                            toast.error('Error updating summary');
                            console.error(error);
                        }
                    }}
                />
            )}

            {moveFileModal.fileId && (
                <MoveFileModal
                    isOpen={moveFileModal.isOpen}
                    onClose={() => {
                        setMoveFileModal({
                            isOpen: false,
                            fileId: null,
                            fileName: '',
                            currentFolderId: '',
                        });
                    }}
                    fileName={moveFileModal.fileName}
                    currentFolderId={moveFileModal.currentFolderId}
                    folders={folders}
                    isMoving={movingFiles[moveFileModal.fileId] || false}
                    onMove={async (targetFolderId) => {
                        if (!moveFileModal.fileId) return;
                        await handleMoveFile(
                            moveFileModal.fileId,
                            moveFileModal.currentFolderId,
                            targetFolderId,
                            folderEntries,
                            setFolderEntries
                        );
                        await refetchFolders();
                    }}
                />
            )}
        </div>
    );
}
