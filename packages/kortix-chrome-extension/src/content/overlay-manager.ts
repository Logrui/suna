/**
 * Overlay Manager for Kortix Extension
 * 
 * Handles the "Kortix is browsing..." status bar injected into the page.
 * Uses Shadow DOM for complete style isolation.
 */

export class OverlayManager {
    private shadowHost: HTMLElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private isVisible: boolean = false;

    private keyListener = (e: KeyboardEvent) => {
        // Block all keyboard input to the page while overlay is active
        e.preventDefault();
        e.stopPropagation();
    };

    /**
     * Create and inject the overlay into the current page
     */
    public show() {
        if (this.isVisible) return;

        // Remove any existing overlay instance (safety)
        this.destroy();

        // Create the host element - Full Screen
        this.shadowHost = document.createElement('div');
        this.shadowHost.id = 'kortix-overlay-host';

        Object.assign(this.shadowHost.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '2147483640',
            // ENABLE pointer-events to block access to the website underneath
            pointerEvents: 'auto',
            display: 'block',
            cursor: 'default'
        });

        // Attach Shadow DOM (closed mode)
        this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' });

        // Create the container element (Full Screen Container)
        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
        `;

        const fontUrl = chrome.runtime.getURL('fonts/roobert/RoobertUprightsVF.woff2');

        // Build the inner HTML with styles and components
        container.innerHTML = `
            <style>
                @font-face {
                    font-family: 'Roobert';
                    src: url('${fontUrl}') format('woff2');
                    font-weight: 100 900;
                    font-style: normal;
                }

                :host {
                    all: initial;
                }

                .hide-from-stream {
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }

                @keyframes breathe {
                    0%, 100% { 
                        opacity: 0.5; 
                        transform: scale(1);
                    }
                    50% { 
                        opacity: 0.85; 
                        transform: scale(1.02);
                    }
                }

                @keyframes slideUp {
                    from { transform: translate(-50%, 30px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }

                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(3.5); opacity: 0; }
                    100% { transform: scale(1); opacity: 0; }
                }

                /* Atmospheric Breathe Vignette - Stationary and 100% stable */
                .kortix-aura {
                    position: absolute;
                    inset: 0;
                    /* Soft glowing perimeter with signature Kortix OKLCH colors */
                    background: radial-gradient(
                        circle at center,
                        transparent 45%,
                        oklch(0.65 0.3 260 / 0.1) 75%,
                        oklch(0.6 0.25 285 / 0.3) 100%
                    );
                    pointer-events: none;
                    animation: breathe 8s cubic-bezier(0.4, 0, 0.4, 1) infinite;
                    z-index: 2147483641;
                }
                
                /* The Elite Status Card - Centered at bottom */
                .kortix-overlay-container {
                    position: absolute;
                    bottom: 32px;
                    left: 50%;
                    transform: translateX(-50%);
                    pointer-events: auto;
                    font-family: 'Roobert', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    /* Match Kortix bg-card with high-quality blur */
                    background: oklch(0.2 0.005 285.823 / 0.85);
                    -webkit-backdrop-filter: blur(28px) saturate(180%);
                    backdrop-filter: blur(28px) saturate(180%);
                    /* 1.5px Hairline border per design guidelines */
                    border: 1.5px solid oklch(1 0 0 / 0.1);
                    border-radius: 1rem; /* rounded-2xl */
                    padding: 10px 10px 10px 20px;
                    display: flex;
                    align-items: center;
                    gap: 24px;
                    box-shadow: 
                        0 20px 40px -12px oklch(0 0 0 / 0.6),
                        0 0 0 1px oklch(1 0 0 / 0.05) inset;
                    user-select: none;
                    animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    overflow: hidden;
                    white-space: nowrap;
                    z-index: 2147483645;
                }

                .grain {
                    position: absolute;
                    inset: 0;
                    opacity: 0.3;
                    pointer-events: none;
                    mix-blend-mode: overlay;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                }

                .status-group {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 2;
                }

                .pulse-dot {
                    width: 6px;
                    height: 6px;
                    background: oklch(0.72 0.18 150);
                    border-radius: 50%;
                    box-shadow: 0 0 12px oklch(0.72 0.18 150);
                    position: relative;
                }

                .pulse-dot::after {
                    content: '';
                    position: absolute;
                    inset: -3px;
                    border-radius: 50%;
                    border: 1px solid oklch(0.72 0.18 150);
                    animation: pulse 3s infinite;
                }

                .status-text {
                    color: oklch(0.985 0 0); /* --foreground */
                    font-size: 13px;
                    font-weight: 500;
                    letter-spacing: -0.02em;
                }

                .takeover-btn {
                    /* Match ShadCN Primary/Secondary styling */
                    background: oklch(0.985 0 0);
                    color: oklch(0.205 0 0);
                    border: none;
                    padding: 7px 16px;
                    border-radius: 0.625rem; /* rounded-lg/radius */
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    z-index: 2;
                    letter-spacing: -0.01em;
                    box-shadow: 0 4px 12px oklch(0 0 0 / 0.1);
                }

                .takeover-btn:hover {
                    transform: translateY(-1px);
                    background: oklch(1 0 0);
                    box-shadow: 0 6px 16px oklch(0 0 0 / 0.2);
                }

                .takeover-btn:active {
                    transform: translateY(0) scale(0.98);
                }
            </style>
            
            <div class="kortix-aura"></div>
            <div class="kortix-overlay-container">
                <div class="grain"></div>
                
                <div class="status-group">
                    <div class="pulse-dot"></div>
                    <span class="status-text">Kortix Worker is browsing....</span>
                </div>
                
                <button class="takeover-btn" id="takeover-trigger">
                    Take Over
                </button>
            </div>
        `;

        // Handle button click
        const btn = container.querySelector('#takeover-trigger');
        btn?.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't let the block sink catch this
            console.log('[Kortix Overlay] User requested takeover');
            chrome.runtime.sendMessage({ type: 'USER_TAKEOVER' });
            this.destroy();
        });

        // Register keyboard sink
        window.addEventListener('keydown', this.keyListener, true);
        window.addEventListener('keyup', this.keyListener, true);
        window.addEventListener('keypress', this.keyListener, true);

        this.shadowRoot.appendChild(container);
        document.body.appendChild(this.shadowHost);
        this.isVisible = true;
    }

    /**
     * Toggles visibility for screenshot exclusion
     */
    public setStreamVisibility(visible: boolean) {
        if (!this.shadowRoot) return;
        const aura = this.shadowRoot.querySelector('.kortix-aura');
        const pill = this.shadowRoot.querySelector('.kortix-overlay-container');

        if (visible) {
            aura?.classList.remove('hide-from-stream');
            pill?.classList.remove('hide-from-stream');
        } else {
            aura?.classList.add('hide-from-stream');
            pill?.classList.add('hide-from-stream');
        }
    }

    /**
     * Remove the overlay from the page
     */
    public hide() {
        this.destroy();
    }

    private destroy() {
        if (this.shadowHost) {
            this.shadowHost.remove();
            this.shadowHost = null;
        }
        window.removeEventListener('keydown', this.keyListener, true);
        window.removeEventListener('keyup', this.keyListener, true);
        window.removeEventListener('keypress', this.keyListener, true);
        this.isVisible = false;
    }
}

export const overlayManager = new OverlayManager();
