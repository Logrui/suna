import { create } from 'zustand';

interface ProjectMemoriesModalState {
    isOpen: boolean;
    projectId: string | null;
    projectName: string | null;
    openModal: (projectId: string, projectName?: string) => void;
    closeModal: () => void;
}

export const useProjectMemoriesModalStore = create<ProjectMemoriesModalState>(
    (set) => ({
        isOpen: false,
        projectId: null,
        projectName: null,
        openModal: (projectId: string, projectName?: string) =>
            set({ isOpen: true, projectId, projectName: projectName ?? null }),
        closeModal: () =>
            set({ isOpen: false, projectId: null, projectName: null }),
    })
);
