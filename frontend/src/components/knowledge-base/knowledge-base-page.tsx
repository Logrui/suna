'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { KnowledgeBasePageHeader } from './knowledge-base-header';
import { KnowledgeBaseManager } from './knowledge-base-manager';
import { KBTabsNavigation } from './kb-tabs-navigation';
import { DatabasesTab } from './databases-tab';

export function KnowledgeBasePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const activeTab = useMemo(() => {
        const tab = searchParams.get('tab');
        return tab || 'knowledge-base';
    }, [searchParams]);

    const handleTabChange = (newTab: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', newTab);
        router.replace(`${pathname}?${params.toString()}`);
    };

    const handleAddDatabase = () => {
        // Placeholder for future functionality
        // Could open a dialog or navigate to a setup page
    };

    return (
        <div className="min-h-screen">
            <div className="container mx-auto max-w-9xl px-4 py-8">
                <KnowledgeBasePageHeader />
            </div>
            <div className="sticky top-0 z-50">
                <div className="absolute inset-0 backdrop-blur-md" style={{
                    maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)'
                }}></div>
                <div className="relative bg-gradient-to-b from-background/95 via-background/70 to-transparent">
                    <div className="container mx-auto max-w-7xl px-4 py-4">
                        <KBTabsNavigation
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            onAddDatabase={handleAddDatabase}
                        />
                    </div>
                </div>
            </div>
            <div className="container mx-auto max-w-7xl px-4 py-2">
                <div className="w-full min-h-[calc(100vh-300px)]">
                    {activeTab === "knowledge-base" && (
                        <KnowledgeBaseManager
                            showHeader={true}
                            showRecentFiles={false}
                            enableAssignments={false}
                        />
                    )}

                    {activeTab === "databases" && (
                        <DatabasesTab />
                    )}
                </div>
            </div>
        </div>
    );
}