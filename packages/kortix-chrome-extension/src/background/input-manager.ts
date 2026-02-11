/**
 * Input Manager for Kortix Extension
 * 
 * Uses chrome.debugger API to dispatch hardware-level events
 * to bypass "isTrusted" check and complex UI barriers.
 */

export class InputManager {
    private attachedTabs: Set<number> = new Set();

    /**
     * Attach debugger to a tab if not already attached
     */
    private async ensureAttached(tabId: number): Promise<void> {
        if (this.attachedTabs.has(tabId)) return;

        return new Promise((resolve, reject) => {
            chrome.debugger.attach({ tabId }, '1.3', () => {
                if (chrome.runtime.lastError) {
                    // Check if already attached (e.g. by StreamingManager)
                    if (chrome.runtime.lastError.message?.includes('already attached')) {
                        console.log(`[InputManager] Tab ${tabId} was already attached, proceeding...`);
                        this.attachedTabs.add(tabId);
                        resolve();
                    } else {
                        reject(new Error(chrome.runtime.lastError.message));
                    }
                } else {
                    this.attachedTabs.add(tabId);
                    // Enable necessary domains
                    chrome.debugger.sendCommand({ tabId }, 'Input.enable', {}, () => {
                        resolve();
                    });
                }
            });
        });
    }

    /**
     * Dispatch a mouse event
     */
    async dispatchMouseEvent(tabId: number, params: any): Promise<void> {
        await this.ensureAttached(tabId);

        return new Promise((resolve, reject) => {
            chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', params, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Dispatch a keyboard event
     */
    async dispatchKeyEvent(tabId: number, params: any): Promise<void> {
        await this.ensureAttached(tabId);

        return new Promise((resolve, reject) => {
            chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', params, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Set file input values (File Upload)
     * This uses CDP's DOM.setFileInputFiles to bypass the OS file picker.
     */
    async setFileInputFiles(tabId: number, params: { files: string[], selector?: string, nodeId?: number }): Promise<void> {
        await this.ensureAttached(tabId);

        return new Promise(async (resolve, reject) => {
            try {
                let targetNodeId = params.nodeId;

                // 1. Enable DOM domain
                await new Promise<void>((res) => chrome.debugger.sendCommand({ tabId }, 'DOM.enable', {}, () => res()));

                // 2. Resolve selector if provided
                if (params.selector && !targetNodeId) {
                    const result: any = await new Promise((res) => chrome.debugger.sendCommand({ tabId }, 'DOM.getDocument', {}, res));
                    const search: any = await new Promise((res) => chrome.debugger.sendCommand({ tabId }, 'DOM.querySelector', {
                        nodeId: result.root.nodeId,
                        selector: params.selector
                    }, res));
                    targetNodeId = search.nodeId;
                }

                if (!targetNodeId) {
                    throw new Error('Could not find target node for file upload');
                }

                // 3. Set files
                chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
                    files: params.files,
                    nodeId: targetNodeId
                }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Detach from a tab
     */
    async detach(tabId: number): Promise<void> {
        if (!this.attachedTabs.has(tabId)) return;

        return new Promise((resolve) => {
            chrome.debugger.detach({ tabId }, () => {
                this.attachedTabs.delete(tabId);
                resolve();
            });
        });
    }

    /**
     * Detach from all tabs
     */
    async detachAll(): Promise<void> {
        const detachPromises = Array.from(this.attachedTabs).map(tabId => this.detach(tabId));
        await Promise.all(detachPromises);
    }
}

export const inputManager = new InputManager();
