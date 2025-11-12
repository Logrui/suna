import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { getApiUrl } from '@/lib/get-api-url';
import { FileNameValidator } from '@/lib/validation';
import { Entry } from '@/hooks/react-query/knowledge-base/use-folders';

const API_URL = getApiUrl();

export interface TreeItem {
    id: string;
    type: 'folder' | 'file';
    name: string;
    parentId?: string;
    data?: any;
    children?: TreeItem[];
    expanded?: boolean;
}

export function useKbHandlers() {
    const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [movingFiles, setMovingFiles] = useState<{ [fileId: string]: boolean }>({});
    const renameInputRef = useRef<HTMLInputElement>(null);

    const handleRenameFolder = async (folderId: string, newName: string, treeData: TreeItem[], setTreeData: (data: TreeItem[]) => void) => {
        if (!newName.trim()) {
            toast.error('Folder name cannot be empty');
            return;
        }

        const validation = FileNameValidator.validateName(newName, 'folder');
        if (!validation.isValid) {
            toast.error(validation.error || 'Invalid folder name');
            return;
        }

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                toast.error('Authentication required');
                return;
            }

            const response = await fetch(`${API_URL}/knowledge-base/folders/${folderId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: newName }),
            });

            if (!response.ok) {
                toast.error('Failed to rename folder');
                return;
            }

            // Update tree data
            setTreeData(treeData.map(item => {
                if (item.id === folderId) {
                    return { ...item, name: newName };
                }
                return item;
            }));

            setRenamingFolderId(null);
            setRenameValue('');
            toast.success('Folder renamed successfully');
        } catch (error) {
            toast.error('Error renaming folder');
            console.error(error);
        }
    };

    const handleDeleteFile = async (fileId: string, folderEntries: { [folderId: string]: Entry[] }, setFolderEntries: (entries: any) => void) => {
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                toast.error('Authentication required');
                return;
            }

            const response = await fetch(`${API_URL}/knowledge-base/entries/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                toast.error('Failed to delete file');
                return;
            }

            // Remove from folder entries
            const updatedEntries = { ...folderEntries };
            for (const folderId in updatedEntries) {
                updatedEntries[folderId] = updatedEntries[folderId].filter(e => e.entry_id !== fileId);
            }
            setFolderEntries(updatedEntries);

            toast.success('File deleted successfully');
        } catch (error) {
            toast.error('Error deleting file');
            console.error(error);
        }
    };

    const handleMoveFile = async (
        fileId: string,
        fromFolderId: string,
        toFolderId: string,
        folderEntries: { [folderId: string]: Entry[] },
        setFolderEntries: (entries: any) => void
    ) => {
        if (fromFolderId === toFolderId) return;

        setMovingFiles(prev => ({ ...prev, [fileId]: true }));

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                toast.error('Authentication required');
                return;
            }

            const response = await fetch(`${API_URL}/knowledge-base/entries/${fileId}/move`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ folder_id: toFolderId }),
            });

            if (!response.ok) {
                toast.error('Failed to move file');
                return;
            }

            // Update folder entries
            const file = folderEntries[fromFolderId]?.find(e => e.entry_id === fileId);
            if (file) {
                const updatedEntries = { ...folderEntries };
                updatedEntries[fromFolderId] = updatedEntries[fromFolderId].filter(e => e.entry_id !== fileId);
                updatedEntries[toFolderId] = [...(updatedEntries[toFolderId] || []), file];
                setFolderEntries(updatedEntries);
            }

            toast.success('File moved successfully');
        } catch (error) {
            toast.error('Error moving file');
            console.error(error);
        } finally {
            setMovingFiles(prev => ({ ...prev, [fileId]: false }));
        }
    };

    return {
        renamingFolderId,
        setRenamingFolderId,
        renameValue,
        setRenameValue,
        renameInputRef,
        movingFiles,
        setMovingFiles,
        handleRenameFolder,
        handleDeleteFile,
        handleMoveFile,
    };
}
