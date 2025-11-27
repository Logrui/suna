'use client';

import { FileViewerModal } from '@/components/thread/file-viewer-modal';
import { useGlobalFileViewerStore } from '@/stores/global-file-viewer-store';

/**
 * Global File Viewer Component
 * 
 * This component provides a global file viewer modal that can be triggered
 * from anywhere in the app without requiring navigation to a thread page.
 * 
 * Usage:
 * 1. Add this component once to your root layout
 * 2. Use the store to open files: 
 *    const { openFileViewer } = useGlobalFileViewerStore();
 *    openFileViewer({ sandboxId, filePath, project });
 */
export function GlobalFileViewer() {
    const { isOpen, sandboxId, filePath, project, filePathList, closeFileViewer } = useGlobalFileViewerStore();

    // Don't render if no sandboxId (prevents errors)
    if (!sandboxId) {
        return null;
    }

    return (
        <FileViewerModal
            open={isOpen}
            onOpenChange={closeFileViewer}
            sandboxId={sandboxId}
            initialFilePath={filePath}
            projectId={project?.id}
            filePathList={filePathList}
        />
    );
}
