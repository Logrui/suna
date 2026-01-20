/**
 * Kortix Tab Group Manager
 * 
 * Manages a dedicated "Kortix" tab group for all agent-controlled tabs.
 * This keeps agent tabs organized and separate from user's personal tabs.
 */

// ========== Types ==========

export interface TabGroupState {
    groupId: number | null;
    activeTabId: number | null;
    tabIds: number[];
}

// ========== Tab Group Manager ==========

class KortixTabGroupManager {
    private groupId: number | null = null;
    private activeTabId: number | null = null;
    private tabIds: Set<number> = new Set();

    /**
     * Get or create the Kortix tab group
     */
    async getOrCreateGroup(): Promise<number> {
        // First check if our cached groupId still exists
        if (this.groupId !== null) {
            try {
                const groups = await chrome.tabGroups.query({ title: 'Kortix' });
                if (groups.some((g) => g.id === this.groupId)) {
                    return this.groupId;
                }
            } catch (e) {
                // Group might not exist anymore
            }
        }

        // Check if there's an existing Kortix group
        const existingGroups = await chrome.tabGroups.query({ title: 'Kortix' });
        if (existingGroups.length > 0) {
            this.groupId = existingGroups[0].id;
            // Sync our tab list
            const tabs = await chrome.tabs.query({ groupId: this.groupId });
            this.tabIds = new Set(tabs.map((t) => t.id!));
            console.log('[Kortix Extension - Tabs] Found existing group:', this.groupId);
            return this.groupId;
        }

        // Create a new group by first creating a tab
        const tab = await chrome.tabs.create({ active: false, url: 'about:blank' });
        if (!tab.id) throw new Error('Failed to create tab');

        // Group the tab
        this.groupId = await chrome.tabs.group({ tabIds: [tab.id] });

        // Update group properties
        await chrome.tabGroups.update(this.groupId, {
            title: 'Kortix',
            color: 'purple',
            collapsed: false,
        });

        this.tabIds.add(tab.id);
        this.activeTabId = tab.id;

        console.log('[Kortix Extension - Tabs] Created new group:', this.groupId);
        return this.groupId;
    }

    /**
     * Create a new tab in the Kortix group
     */
    async createTab(url: string, activate: boolean = true): Promise<chrome.tabs.Tab> {
        const groupId = await this.getOrCreateGroup();

        const tab = await chrome.tabs.create({ url, active: activate });
        if (!tab.id) throw new Error('Failed to create tab');

        // Add to group
        await chrome.tabs.group({ tabIds: [tab.id], groupId });

        this.tabIds.add(tab.id);
        if (activate) {
            this.activeTabId = tab.id;
        }

        console.log('[Kortix Extension - Tabs] Created tab:', tab.id, url);
        return tab;
    }

    /**
     * Navigate the current active tab, or create a new one if needed
     */
    async navigate(url: string): Promise<chrome.tabs.Tab> {
        // If we have an active tab in the group, navigate it
        if (this.activeTabId !== null) {
            try {
                const tab = await chrome.tabs.get(this.activeTabId);
                // Check if tab is still in our group
                if (tab.groupId === this.groupId) {
                    await chrome.tabs.update(this.activeTabId, { url, active: true });
                    console.log('[Kortix Extension - Tabs] Navigated existing tab:', this.activeTabId, url);
                    return tab;
                }
            } catch (e) {
                // Tab might have been closed
            }
        }

        // Create a new tab
        return this.createTab(url, true);
    }

    /**
     * Get the current active tab in the Kortix group
     */
    async getActiveTab(): Promise<chrome.tabs.Tab | null> {
        if (this.activeTabId === null) return null;

        try {
            const tab = await chrome.tabs.get(this.activeTabId);
            if (tab.groupId === this.groupId) {
                return tab;
            }
        } catch (e) {
            // Tab might have been closed
        }

        // Try to find any tab in our group
        if (this.groupId !== null) {
            const tabs = await chrome.tabs.query({ groupId: this.groupId });
            if (tabs.length > 0) {
                this.activeTabId = tabs[0].id!;
                return tabs[0];
            }
        }

        return null;
    }

    /**
     * Close the current active tab
     */
    async closeActiveTab(): Promise<void> {
        if (this.activeTabId === null) return;

        try {
            await chrome.tabs.remove(this.activeTabId);
            this.tabIds.delete(this.activeTabId);
            console.log('[Kortix Extension - Tabs] Closed tab:', this.activeTabId);

            // Find new active tab
            const tabs = await this.getGroupTabs();
            if (tabs.length > 0) {
                this.activeTabId = tabs[0].id!;
            } else {
                this.activeTabId = null;
            }
        } catch (e) {
            // Tab might already be closed
        }
    }

    /**
     * Get all tabs in the Kortix group
     */
    async getGroupTabs(): Promise<chrome.tabs.Tab[]> {
        if (this.groupId === null) return [];
        return chrome.tabs.query({ groupId: this.groupId });
    }

    /**
     * Capture screenshot of the active tab
     */
    async captureScreenshot(): Promise<string> {
        const tab = await this.getActiveTab();
        if (!tab || !tab.id) {
            throw new Error('No active tab to capture');
        }

        // Make sure tab is active
        await chrome.tabs.update(tab.id, { active: true });

        // Small delay to ensure tab is rendered
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Capture visible area
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'png',
        });

        // Extract base64 data (remove data:image/png;base64, prefix)
        const base64 = dataUrl.split(',')[1];
        return base64;
    }

    /**
     * Execute a function in the active tab's content script
     */
    async executeInActiveTab<T>(
        func: () => T | Promise<T>
    ): Promise<T> {
        const tab = await this.getActiveTab();
        if (!tab || !tab.id) {
            throw new Error('No active tab');
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func,
        });

        if (results.length === 0) {
            throw new Error('Script execution returned no results');
        }

        return results[0].result as T;
    }

    /**
     * Send a message to the content script in the active tab
     */
    async sendToActiveTab(message: any): Promise<any> {
        const tab = await this.getActiveTab();
        if (!tab || !tab.id) {
            throw new Error('No active tab');
        }

        return chrome.tabs.sendMessage(tab.id, message);
    }

    /**
     * Collapse or expand the tab group
     */
    async setCollapsed(collapsed: boolean): Promise<void> {
        if (this.groupId === null) return;
        await chrome.tabGroups.update(this.groupId, { collapsed });
    }

    /**
     * Clean up all tabs in the group
     */
    async cleanup(): Promise<void> {
        const tabs = await this.getGroupTabs();
        if (tabs.length > 0) {
            await chrome.tabs.remove(tabs.map((t) => t.id!));
        }
        this.tabIds.clear();
        this.activeTabId = null;
        this.groupId = null;
        console.log('[Kortix Extension - Tabs] Cleaned up');
    }

    // ========== State ==========

    get state(): TabGroupState {
        return {
            groupId: this.groupId,
            activeTabId: this.activeTabId,
            tabIds: Array.from(this.tabIds),
        };
    }
}

// Export singleton instance
export const tabGroupManager = new KortixTabGroupManager();
