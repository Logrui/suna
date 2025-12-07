'use client';

import { useMaintenanceStore } from '@/stores/maintenance-store';
import { MaintenancePage } from '@/components/maintenance/maintenance-page';

export function GlobalMaintenanceHandler() {
    const isMaintenanceMode = useMaintenanceStore((state) => state.isMaintenanceMode);

    if (!isMaintenanceMode) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 bg-background">
            <MaintenancePage />
        </div>
    );
}
