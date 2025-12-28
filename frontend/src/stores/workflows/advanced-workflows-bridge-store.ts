/**
 * Advanced Workflows Bridge Store
 * 
 * Zustand store for managing communication between Suna (parent) and the
 * Advanced Workflows editor (embedded iframe). This enables seamless
 * integration where the iframe can request Suna to perform actions like
 * opening modals, and Suna can notify the iframe of updates.
 * 
 * Message Protocol:
 * ─────────────────
 * FROM IFRAME → PARENT:
 *   - SUNA_OPEN_PROFILE_MODAL: Request to open Composio profile management
 * 
 * FROM PARENT → IFRAME:
 *   - SUNA_PROFILES_UPDATED: Profiles were changed
 *   - SUNA_MODAL_CLOSED: Modal was closed (even if no changes)
 */

import { create } from 'zustand';

// ═══════════════════════════════════════════════════════════════════════════
// Message Types - Shared Protocol
// ═══════════════════════════════════════════════════════════════════════════

export const ADVANCED_WORKFLOWS_MESSAGE_TYPES = {
    // From iframe → parent (Suna)
    OPEN_PROFILE_MODAL: 'SUNA_OPEN_PROFILE_MODAL',

    // From parent (Suna) → iframe
    PROFILES_UPDATED: 'SUNA_PROFILES_UPDATED',
    MODAL_CLOSED: 'SUNA_MODAL_CLOSED',
} as const;

export interface AdvancedWorkflowsMessage {
    type: string;
    payload?: {
        toolkit?: string;
        profileIds?: string[];
        source?: string;
        [key: string]: unknown;
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile Modal State
// ═══════════════════════════════════════════════════════════════════════════

interface ProfileModalConfig {
    /** Whether the modal is open */
    open: boolean;
    /** Optional: Pre-filter to a specific toolkit (e.g., "gmail", "slack") */
    toolkit?: string;
    /** Source identifier for debugging */
    source?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Store Interface
// ═══════════════════════════════════════════════════════════════════════════

interface AdvancedWorkflowsBridgeState {
    // ─────────────────────────────────────────────────────────────────────────
    // Profile Modal State
    // ─────────────────────────────────────────────────────────────────────────
    profileModalConfig: ProfileModalConfig;

    /** Open the Composio profile management modal */
    openProfileModal: (toolkit?: string, source?: string) => void;

    /** Close the profile modal and reset state */
    closeProfileModal: () => void;

    // ─────────────────────────────────────────────────────────────────────────
    // Iframe Reference (for sending messages back)
    // ─────────────────────────────────────────────────────────────────────────
    iframeRef: React.RefObject<HTMLIFrameElement> | null;

    /** Set the iframe reference for sending postMessages */
    setIframeRef: (ref: React.RefObject<HTMLIFrameElement>) => void;

    /** Send a message to the embedded iframe */
    sendMessageToIframe: (message: AdvancedWorkflowsMessage) => void;

    // ─────────────────────────────────────────────────────────────────────────
    // Notification Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Notify iframe that profiles were updated */
    notifyProfilesUpdated: (toolkit?: string, profileIds?: string[]) => void;

    /** Notify iframe that modal was closed */
    notifyModalClosed: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Store Implementation
// ═══════════════════════════════════════════════════════════════════════════

export const useAdvancedWorkflowsBridgeStore = create<AdvancedWorkflowsBridgeState>((set, get) => ({
    // ─────────────────────────────────────────────────────────────────────────
    // Initial State
    // ─────────────────────────────────────────────────────────────────────────
    profileModalConfig: {
        open: false,
        toolkit: undefined,
        source: undefined,
    },
    iframeRef: null,

    // ─────────────────────────────────────────────────────────────────────────
    // Profile Modal Actions
    // ─────────────────────────────────────────────────────────────────────────
    openProfileModal: (toolkit?: string, source?: string) => {
        console.log('[AdvancedWorkflowsBridge] Opening profile modal', { toolkit, source });
        set({
            profileModalConfig: {
                open: true,
                toolkit,
                source,
            },
        });
    },

    closeProfileModal: () => {
        console.log('[AdvancedWorkflowsBridge] Closing profile modal');

        // Notify iframe before closing
        const state = get();
        state.notifyProfilesUpdated(state.profileModalConfig.toolkit);

        set({
            profileModalConfig: {
                open: false,
                toolkit: undefined,
                source: undefined,
            },
        });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Iframe Reference Actions
    // ─────────────────────────────────────────────────────────────────────────
    setIframeRef: (ref) => {
        set({ iframeRef: ref });
    },

    sendMessageToIframe: (message: AdvancedWorkflowsMessage) => {
        const { iframeRef } = get();

        if (!iframeRef?.current?.contentWindow) {
            console.warn('[AdvancedWorkflowsBridge] Cannot send message: iframe not available');
            return;
        }

        try {
            console.log('[AdvancedWorkflowsBridge] Sending message to iframe:', message.type);
            iframeRef.current.contentWindow.postMessage(message, '*');
        } catch (error) {
            console.error('[AdvancedWorkflowsBridge] Failed to send message to iframe:', error);
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Notification Actions
    // ─────────────────────────────────────────────────────────────────────────
    notifyProfilesUpdated: (toolkit?: string, profileIds?: string[]) => {
        get().sendMessageToIframe({
            type: ADVANCED_WORKFLOWS_MESSAGE_TYPES.PROFILES_UPDATED,
            payload: {
                toolkit,
                profileIds,
            },
        });
    },

    notifyModalClosed: () => {
        get().sendMessageToIframe({
            type: ADVANCED_WORKFLOWS_MESSAGE_TYPES.MODAL_CLOSED,
            payload: {},
        });
    },
}));

// ═══════════════════════════════════════════════════════════════════════════
// Hook: Message Listener for iframe messages
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Custom hook to listen for messages from the Advanced Workflows iframe.
 * Call this in the component that renders the iframe.
 * 
 * @example
 * ```tsx
 * useAdvancedWorkflowsMessageListener();
 * ```
 */
export function useAdvancedWorkflowsMessageListener() {
    const openProfileModal = useAdvancedWorkflowsBridgeStore((state) => state.openProfileModal);

    // This hook should be used with useEffect in the component
    // Returning the handler for flexibility
    return (event: MessageEvent) => {
        const message = event.data as AdvancedWorkflowsMessage;

        if (!message?.type) return;

        switch (message.type) {
            case ADVANCED_WORKFLOWS_MESSAGE_TYPES.OPEN_PROFILE_MODAL:
                console.log('[AdvancedWorkflowsBridge] Received OPEN_PROFILE_MODAL from iframe', message.payload);
                openProfileModal(
                    message.payload?.toolkit,
                    message.payload?.source as string | undefined
                );
                break;

            // Add more message handlers as needed
            default:
                // Ignore unknown messages (could be from other sources)
                break;
        }
    };
}
