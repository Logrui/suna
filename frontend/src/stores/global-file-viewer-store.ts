import { create } from 'zustand';
import { Project } from '@/lib/api/projects';

interface GlobalFileViewerState {
    isOpen: boolean;
    sandboxId: string | null;
    filePath: string | null;
    project: Project | undefined;
    filePathList: string[] | undefined;
    openFileViewer: (options: {
        sandboxId: string;
        filePath?: string;
        project?: Project;
        filePathList?: string[];
    }) => void;
    closeFileViewer: () => void;
}

export const useGlobalFileViewerStore = create<GlobalFileViewerState>((set) => ({
    isOpen: false,
    sandboxId: null,
    filePath: null,
    project: undefined,
    filePathList: undefined,
    openFileViewer: (options) =>
        set({
            isOpen: true,
            sandboxId: options.sandboxId,
            filePath: options.filePath || null,
            project: options.project,
            filePathList: options.filePathList,
        }),
    closeFileViewer: () =>
        set({
            isOpen: false,
            sandboxId: null,
            filePath: null,
            project: undefined,
            filePathList: undefined,
        }),
}));
