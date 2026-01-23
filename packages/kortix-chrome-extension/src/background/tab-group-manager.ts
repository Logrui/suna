/**
 * Kortix Tab Group Manager
 * 
 * Manages a dedicated "Kortix" tab group for all agent-controlled tabs.
 * This keeps agent tabs organized and separate from user's personal tabs.
 */

import { debuggerCapture } from './debugger-capture';

// ========== Types ==========

export interface TabGroupState {
    groupId: number | null;
    windowId: number | null;
    activeTabId: number | null;
    tabIds: number[];
}

// ========== Tab Group Manager ==========

class KortixTabGroupManager {
    private groupId: number | null = null;
    private windowId: number | null = null;
    private activeTabId: number | null = null;
    private tabIds: Set<number> = new Set();

    /**
     * Get or create a dedicated window for Kortix.
     * Dimensions fixed to 1440x900 for consistency with Sandbox.
     */
    async getOrCreateWindow(): Promise<number> {
        // 1. Check if we already have a valid window ID cached
        if (this.windowId !== null) {
            try {
                const win = await chrome.windows.get(this.windowId);
                return win.id!;
            } catch (e) {
                this.windowId = null;
            }
        }

        // 2. Try to find a window that contains our specific tab group
        if (this.groupId !== null) {
            try {
                const group = await chrome.tabGroups.get(this.groupId);
                this.windowId = group.windowId;
                return this.windowId;
            } catch (e) {
                this.groupId = null;
            }
        }

        // 3. Fallback: query for any group titled 'Kortix'
        const existingGroups = await chrome.tabGroups.query({ title: 'Kortix' });
        if (existingGroups.length > 0) {
            this.windowId = existingGroups[0].windowId;
            this.groupId = existingGroups[0].id;
            return this.windowId;
        }

        // 4. No dedicated window found, create a new one with fixed dimensions
        const width = 1440;
        const height = 900;

        // Center the window roughly
        const win = await chrome.windows.create({
            focused: true, // Focus once on create so user sees it
            type: 'normal',
            width,
            height,
        });

        this.windowId = win.id!;
        console.log(`[Kortix Extension - Tabs] Created dedicated window (${width}x${height}):`, this.windowId);
        return this.windowId;
    }

    /**
     * Get or create the Kortix tab group
     */
    async getOrCreateGroup(): Promise<number> {
        const windowId = await this.getOrCreateWindow();

        // Try to find an existing Kortix group (cached or by query)
        let group: chrome.tabGroups.TabGroup | null = null;

        if (this.groupId !== null) {
            try {
                const existing = await chrome.tabGroups.get(this.groupId);
                if (existing.title === 'Kortix') {
                    group = existing;

                    // Ensure it's in our dedicated window
                    if (group.windowId !== windowId) {
                        console.log('[Kortix Extension - Tabs] Moving group to dedicated window');
                        // We can't move a group directly across windows in one call reliably, 
                        // so we move the tabs and the group follows or we re-group
                        const tabs = await chrome.tabs.query({ groupId: group.id });
                        await chrome.tabs.move(tabs.map(t => t.id!), { windowId, index: -1 });
                    }
                }
            } catch (e) {
                this.groupId = null;
            }
        }

        if (!group) {
            const existingGroups = await chrome.tabGroups.query({ title: 'Kortix' });
            if (existingGroups.length > 0) {
                group = existingGroups[0];
                this.groupId = group.id;

                if (group.windowId !== windowId) {
                    const tabs = await chrome.tabs.query({ groupId: group.id });
                    await chrome.tabs.move(tabs.map(t => t.id!), { windowId, index: -1 });
                }
            }
        }

        if (group) {
            // Found it - sync tab list and ENFORCE color
            const tabs = await chrome.tabs.query({ groupId: group.id });
            this.tabIds = new Set(tabs.map((t) => t.id!));

            // Persistent enforcement for browsers like Comet that might override extension settings
            this.enforceGroupVisuals(group.id);
            return group.id;
        }

        // Create a new group by first creating a tab in our dedicated window
        const tab = await chrome.tabs.create({
            windowId,
            url: 'https://www.google.com',
            active: false
        });
        if (!tab.id) throw new Error('Failed to create tab');

        // Wait a tiny bit for navigation to start
        await new Promise(resolve => setTimeout(resolve, 100));

        // Group the tab
        this.groupId = await chrome.tabs.group({ tabIds: [tab.id] });
        console.log('[Kortix Extension - Tabs] Grouped tab into new group:', this.groupId);

        // Small delay to ensure Chrome has registered the group
        await new Promise(resolve => setTimeout(resolve, 50));

        // Persistent enforcement
        this.enforceGroupVisuals(this.groupId);

        this.tabIds.add(tab.id);
        this.activeTabId = tab.id;

        return this.groupId;
    }

    /**
     * Enforce group color and title with retries (Comet/Edge/AI-organizer safety)
     */
    private async enforceGroupVisuals(groupId: number, retries: number = 3): Promise<void> {
        const apply = async () => {
            try {
                await chrome.tabGroups.update(groupId, {
                    title: 'Kortix',
                    color: 'purple',
                    collapsed: false,
                });

                // Verify
                const updated = await chrome.tabGroups.get(groupId);
                console.log(`[Kortix Extension - Tabs] Group ${groupId} visuals: title="${updated.title}", color="${updated.color}"`);

                if (updated.color !== 'purple' && retries > 0) {
                    console.warn(`[Kortix Extension - Tabs] Color mismatch in Comet/Browser (expected purple, got ${updated.color}). Retrying...`);
                    setTimeout(() => this.enforceGroupVisuals(groupId, retries - 1), 500);
                }
            } catch (e) {
                console.error('[Kortix Extension - Tabs] Failed to update group visuals:', e);
            }
        };

        apply();
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
        // Try cached ID first
        if (this.activeTabId !== null) {
            try {
                const tab = await chrome.tabs.get(this.activeTabId);
                if (tab.groupId === this.groupId) {
                    return tab;
                }
            } catch (e) {
                // Tab might have been closed
                this.activeTabId = null;
            }
        }

        // Fallback: Try to find any tab in our group
        if (this.groupId !== null) {
            try {
                const tabs = await chrome.tabs.query({ groupId: this.groupId });
                if (tabs.length > 0) {
                    this.activeTabId = tabs[0].id!;
                    return tabs[0];
                }
            } catch (e) {
                console.error('[Kortix Extension - Tabs] Failed to query tabs in group:', e);
            }
        }

        return null;
    }

    /**
     * Switch to a specific tab in the group
     */
    async switchTab(tabId: number): Promise<void> {
        // Ensure it's one of ours
        if (this.tabIds.has(tabId)) {
            await chrome.tabs.update(tabId, { active: true });
            this.activeTabId = tabId;
            console.log('[Kortix Extension - Tabs] Switched to tab:', tabId);
        } else {
            // Find it in the group even if not in our Set (safety)
            const tabs = await this.getGroupTabs();
            const tab = tabs.find(t => t.id === tabId);
            if (tab) {
                await chrome.tabs.update(tabId, { active: true });
                this.activeTabId = tabId;
                this.tabIds.add(tabId);
            } else {
                throw new Error(`Tab ${tabId} not found in Kortix group`);
            }
        }
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
     * Capture screenshot of a tab.
     * 
     * REFACTORED: Now uses chrome.debugger + Page.captureScreenshot
     * which does NOT require the tab to be active/visible.
     * This fixes the annoying tab-switching bug.
     * 
     * @param tabId - Optional specific tab ID. If not provided, uses active tab.
     */
    async captureScreenshot(tabId?: number): Promise<string> {
        let targetTabId = tabId;

        // If no specific tab, use active tab
        if (!targetTabId) {
            const tab = await this.getActiveTab();

            // If no active tab, try to create/get group to ensure at least one tab exists
            if (!tab || !tab.id) {
                console.log('[Kortix Extension - Tabs] No active tab, attempting to create/get group');
                await this.getOrCreateGroup();
                const newTab = await this.getActiveTab();
                if (!newTab?.id) {
                    throw new Error('No active tab to capture');
                }
                targetTabId = newTab.id;
            } else {
                targetTabId = tab.id;
            }
        }

        // Get tab info for URL check
        let tab: chrome.tabs.Tab;
        try {
            tab = await chrome.tabs.get(targetTabId);
        } catch (e) {
            throw new Error(`Tab ${targetTabId} not found`);
        }

        // Restricted URLs (chrome://, about:, extensions) - debugger can sometimes capture these, 
        // but it's unreliable. We'll warn but try anyway if using debugger.
        if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('about:') || !tab.url?.startsWith('http')) {
            console.warn(`[Kortix Extension - Tabs] Attempting capture on potentially restricted URL: ${tab.url}`);
        }

        try {
            // Use debugger-based capture - NO TAB ACTIVATION REQUIRED!
            // This is the key fix: we no longer call chrome.tabs.update(tab.id, { active: true })
            const base64 = await debuggerCapture.captureTab(targetTabId, 'png');

            if (!base64) {
                throw new Error('Capture returned empty result');
            }

            return base64;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error(`[Kortix Extension - Tabs] Failed to capture screenshot for ${tab.url}:`, e);

            throw new Error(`Screenshot failed: ${errorMsg} (${tab.url})`);
        }
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
     * Clean up all tabs in the group and close the dedicated window
     */
    async cleanup(): Promise<void> {
        if (this.windowId !== null) {
            try {
                await chrome.windows.remove(this.windowId);
            } catch (e) {
                // Window might already be closed
            }
        }

        this.tabIds.clear();
        this.activeTabId = null;
        this.groupId = null;
        this.windowId = null;
        console.log('[Kortix Extension - Tabs] Cleaned up and closed window');
    }

    // ========== State ==========

    get state(): TabGroupState {
        return {
            groupId: this.groupId,
            windowId: this.windowId,
            activeTabId: this.activeTabId,
            tabIds: Array.from(this.tabIds),
        };
    }
}

// Export singleton instance
export const tabGroupManager = new KortixTabGroupManager();
