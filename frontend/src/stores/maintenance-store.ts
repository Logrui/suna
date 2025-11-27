import { create } from 'zustand';

interface MaintenanceStore {
    isMaintenanceMode: boolean;
    setMaintenanceMode: (isMaintenance: boolean) => void;
}

export const useMaintenanceStore = create<MaintenanceStore>((set) => ({
    isMaintenanceMode: false,
    setMaintenanceMode: (isMaintenance) => set({ isMaintenanceMode: isMaintenance }),
}));
