/**
 * Overlay Manager for Kortix Extension
 *
 * Premium overlay system with:
 * - Event Blocking Pro: Full mouse/keyboard blocking with CDP bypass
 * - Resume Modal: Structured handover protocol
 * - State Management: Ongoing vs Takeover modes
 * - Premium Aesthetics: Animated aura and glassmorphism
 *
 * Uses Shadow DOM for complete style isolation from page styles.
 */

export type OverlayState = "hidden" | "ongoing" | "takeover";

export class OverlayManager {
  private shadowHost: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private state: OverlayState = "hidden";
  private cdpAllowed: boolean = false;

  // Bound event handlers for proper cleanup
  private boundBlockEvent: (e: Event) => void;
  private boundBlockKeyEvent: (e: Event) => void;

  // All events we need to intercept
  private readonly MOUSE_EVENTS = [
    "mousedown",
    "mouseup",
    "mousemove",
    "click",
    "dblclick",
    "contextmenu",
    "pointerdown",
    "pointermove",
    "pointerup",
    "drag",
    "dragstart",
    "dragend",
    "dragenter",
    "dragleave",
    "dragover",
    "drop",
    "wheel",
  ];

  private readonly KEY_EVENTS = ["keydown", "keyup", "keypress"];

  constructor() {
    this.boundBlockEvent = this.blockEvent.bind(this);
    this.boundBlockKeyEvent = this.blockKeyEvent.bind(this);
  }

  /**
   * Block mouse/pointer events (with CDP bypass)
   */
  private blockEvent(e: Event): void {
    // Allow simulated events (CDP commands) to pass through
    if (this.cdpAllowed && !e.isTrusted) {
      return;
    }

    // Allow events on the overlay host itself (so Take Over button works)
    if (this.shadowHost && e.composedPath().includes(this.shadowHost)) {
      return;
    }

    // Block all user-initiated events when in ongoing state
    if (this.state === "ongoing") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }

  /**
   * Block keyboard events (with CDP bypass)
   */
  private blockKeyEvent(e: Event): void {
    // Allow simulated events (CDP commands) to pass through
    if (this.cdpAllowed && !e.isTrusted) {
      return;
    }

    // Allow events on the overlay host itself
    if (this.shadowHost && e.composedPath().includes(this.shadowHost)) {
      return;
    }

    // Block all user-initiated keyboard events when in ongoing state
    if (this.state === "ongoing") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }

  /**
   * Enable full input blocking with CDP bypass
   */
  private enableInputBlocking(): void {
    // Mouse/pointer events
    this.MOUSE_EVENTS.forEach((evt) => {
      window.addEventListener(evt, this.boundBlockEvent, {
        capture: true,
        passive: false,
      });
    });

    // Keyboard events
    this.KEY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, this.boundBlockKeyEvent, {
        capture: true,
        passive: false,
      });
    });

    this.cdpAllowed = true;
  }

  /**
   * Disable input blocking
   */
  private disableInputBlocking(): void {
    // Mouse/pointer events
    this.MOUSE_EVENTS.forEach((evt) => {
      window.removeEventListener(evt, this.boundBlockEvent, { capture: true });
    });

    // Keyboard events
    this.KEY_EVENTS.forEach((evt) => {
      window.removeEventListener(evt, this.boundBlockKeyEvent, {
        capture: true,
      });
    });

    this.cdpAllowed = false;
  }


  /**
   * Show overlay in a specific state
   * @param initialState - The state to initialize with (default: "ongoing")
   */
  public show(initialState: OverlayState = "ongoing"): void {
    // If already showing and in the same state, do nothing
    if (this.state === initialState) return;

    // Create overlay if not already present
    if (this.state === "hidden") {
      this.createOverlay();
    }

    this.setState(initialState);

    // Manage input blocking based on state
    if (initialState === "ongoing") {
      this.enableInputBlocking();
    } else {
      this.disableInputBlocking();
    }
  }

  /**
   * Hide and destroy overlay completely
   */
  public hide(): void {
    this.destroy();
  }

  /**
   * Set overlay state and update UI accordingly
   */
  private setState(newState: OverlayState): void {
    this.state = newState;

    if (!this.shadowRoot) return;

    const aura = this.shadowRoot.querySelector(".kortix-aura") as HTMLElement;
    const container = this.shadowRoot.querySelector(
      ".kortix-overlay-container",
    ) as HTMLElement;
    const statusText = this.shadowRoot.querySelector(
      ".status-text",
    ) as HTMLElement;
    const statusIndicator = this.shadowRoot.querySelector(".status-indicator") as HTMLElement;
    const takeoverBtn = this.shadowRoot.querySelector(
      "#takeover-btn",
    ) as HTMLElement;
    const resumeBtn = this.shadowRoot.querySelector(
      "#resume-btn",
    ) as HTMLElement;
    const modal = this.shadowRoot.querySelector(
      ".kortix-resume-modal",
    ) as HTMLElement;

    switch (newState) {
      case "ongoing":
        // Agent is working - full blocking enabled
        // HIDE VISUALS FOR STREAM CLARITY
        if (aura) aura.style.display = "none";
        if (container) container.style.display = "none";
        if (this.shadowRoot) {
          const techOverlays = this.shadowRoot.querySelector(".tech-overlays") as HTMLElement;
          if (techOverlays) techOverlays.style.display = "none";
        }

        if (statusText) statusText.textContent = "Kortix is browsing...";
        if (statusIndicator) {
          statusIndicator.style.background = "oklch(0.72 0.18 150)";
          statusIndicator.style.boxShadow = "0 0 12px oklch(0.72 0.18 150 / 0.5)";
        }
        if (takeoverBtn) takeoverBtn.style.display = "block";
        if (resumeBtn) resumeBtn.style.display = "none";
        if (modal) modal.classList.add("hidden");
        break;

      case "takeover":
        // User has taken over - blocking disabled
        if (aura) aura.classList.add("paused");
        if (container) container.classList.add("takeover-mode");
        if (statusText)
          statusText.textContent =
            "User in Control";
        if (statusIndicator) {
          statusIndicator.style.background = "oklch(0.7 0.15 60)"; // Amber
          statusIndicator.style.boxShadow = "0 0 12px oklch(0.7 0.15 60 / 0.5)";
        }
        if (takeoverBtn) takeoverBtn.style.display = "none";
        if (resumeBtn) resumeBtn.style.display = "block";
        if (modal) modal.classList.add("hidden");
        break;

      case "hidden":
        // Completely hidden
        break;
    }
  }

  /**
   * Toggle visibility for screenshot exclusion (hide overlay from captures)
   */
  public setStreamVisibility(visible: boolean): void {
    if (!this.shadowRoot) return;

    const aura = this.shadowRoot.querySelector(".kortix-aura");
    const pill = this.shadowRoot.querySelector(".kortix-overlay-container");
    const modal = this.shadowRoot.querySelector(".kortix-resume-modal");

    if (visible) {
      aura?.classList.remove("hide-from-stream");
      pill?.classList.remove("hide-from-stream");
      modal?.classList.remove("hide-from-stream");
    } else {
      aura?.classList.add("hide-from-stream");
      pill?.classList.add("hide-from-stream");
      modal?.classList.add("hide-from-stream");
    }
  }

  /**
   * Show the resume modal
   */
  private showResumeModal(): void {
    if (!this.shadowRoot) return;

    const modal = this.shadowRoot.querySelector(
      ".kortix-resume-modal",
    ) as HTMLElement;
    const textarea = this.shadowRoot.querySelector(
      "#resume-summary",
    ) as HTMLTextAreaElement;

    if (modal) {
      modal.classList.remove("hidden");
      // Auto-focus textarea after animation
      setTimeout(() => textarea?.focus(), 100);
    }
  }

  /**
   * Hide the resume modal
   */
  private hideResumeModal(): void {
    if (!this.shadowRoot) return;

    const modal = this.shadowRoot.querySelector(
      ".kortix-resume-modal",
    ) as HTMLElement;
    const textarea = this.shadowRoot.querySelector(
      "#resume-summary",
    ) as HTMLTextAreaElement;

    if (modal) {
      modal.classList.add("hidden");
    }
    if (textarea) {
      textarea.value = "";
    }
  }

  /**
   * Create the overlay DOM structure
   */
  private createOverlay(): void {
    // Remove any existing overlay
    this.destroy();

    // Create host element - full screen
    this.shadowHost = document.createElement("div");
    this.shadowHost.id = "kortix-overlay-host";

    Object.assign(this.shadowHost.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483640",
      pointerEvents: "none", // Let events pass to our window listeners
      display: "block",
    });

    // Attach Shadow DOM (closed for isolation)
    this.shadowRoot = this.shadowHost.attachShadow({ mode: "closed" });

    // Build the overlay content
    const fontUrl = chrome.runtime.getURL(
      "fonts/roobert/RoobertUprightsVF.woff2",
    );

    this.shadowRoot.innerHTML = `
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

                * {
                    box-sizing: border-box;
                }

                .hide-from-stream {
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }

                /* ========== Animations ========== */

                @keyframes slideUp {
                    from { transform: translate(-50%, 60px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }

                @keyframes auraBreath {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.15); opacity: 0.8; }
                }

                @keyframes auraRotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes scanlineMove {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }

                /* ========== Atmospheric Aura ========== */

                .kortix-aura {
                    position: fixed;
                    inset: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(
                        circle at center,
                        transparent 20%,
                        oklch(0.12 0.02 285 / 0.15) 50%,
                        oklch(0.1 0.02 285 / 0.4) 100%
                    );
                    pointer-events: none;
                    z-index: 2147483641;
                    transition: opacity 3s cubic-bezier(0.16, 1, 0.3, 1);
                    overflow: hidden;
                    opacity: 1;
                }

                .aura-blobs {
                    position: absolute;
                    inset: 0;
                    animation: auraRotate 80s linear infinite;
                    opacity: 0.3;
                    filter: blur(140px);
                }

                .aura-blob {
                    position: absolute;
                    border-radius: 50%;
                    mix-blend-mode: screen;
                    animation: auraBreath 20s ease-in-out infinite alternate;
                }

                .aura-blob-1 {
                    width: 50%;
                    height: 50%;
                    top: 10%;
                    left: 20%;
                    background: radial-gradient(circle, oklch(0.65 0.3 265 / 0.4), transparent 70%);
                }

                .aura-blob-2 {
                    width: 60%;
                    height: 60%;
                    bottom: 15%;
                    right: 15%;
                    background: radial-gradient(circle, oklch(0.7 0.25 195 / 0.3), transparent 70%);
                    animation-delay: -7s;
                }

                .aura-blob-3 {
                    width: 45%;
                    height: 45%;
                    top: 40%;
                    left: 40%;
                    background: radial-gradient(circle, oklch(0.6 0.25 315 / 0.3), transparent 70%);
                    animation-delay: -14s;
                }

                /* Techy Overlay Layers */
                .tech-overlays {
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    z-index: 2147483642;
                }

                .scanlines {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        to bottom,
                        transparent,
                        oklch(1 0 0 / 0.02) 50%,
                        transparent
                    );
                    background-size: 100% 2px;
                    opacity: 0.2;
                }

                .vignette {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(
                        circle at center,
                        transparent 40%,
                        oklch(0 0 0 / 0.2) 100%
                    );
                }

                .kortix-aura.paused {
                    opacity: 0.2;
                    filter: grayscale(0.8);
                }
                
                .kortix-aura.paused .aura-blobs {
                   animation-play-state: paused;
                }

                /* ========== Status Pill (Antigravity Style) ========== */

                .kortix-overlay-container {
                    position: fixed;
                    bottom: 48px;
                    left: 50%;
                    transform: translateX(-50%);
                    pointer-events: auto;
                    font-family: 'Roobert', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background: oklch(0.18 0.01 285 / 0.75);
                    -webkit-backdrop-filter: blur(32px) saturate(180%);
                    backdrop-filter: blur(32px) saturate(180%);
                    border: 1px solid oklch(1 0 0 / 0.1);
                    border-radius: 9999px;
                    padding: 8px 8px 8px 22px;
                    display: flex;
                    align-items: center;
                    gap: 24px;
                    box-shadow:
                        0 32px 64px -16px oklch(0 0 0 / 0.6),
                        0 0 0 1px oklch(1 0 0 / 0.04) inset;
                    user-select: none;
                    animation: slideUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    overflow: hidden;
                    white-space: nowrap;
                    z-index: 2147483645;
                    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .kortix-overlay-container.takeover-mode {
                    border-color: oklch(0.7 0.15 60 / 0.25);
                    background: oklch(0.22 0.02 65 / 0.8);
                }

                .grain {
                    position: absolute;
                    inset: 0;
                    opacity: 0.12;
                    pointer-events: none;
                    mix-blend-mode: overlay;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                }

                .status-group {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    z-index: 2;
                }

                .status-indicator {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: oklch(0.75 0.25 150);
                    box-shadow: 0 0 16px oklch(0.75 0.25 150 / 0.6);
                    position: relative;
                }

                .takeover-mode .status-indicator {
                    background: oklch(0.75 0.2 65);
                    box-shadow: 0 0 16px oklch(0.75 0.2 65 / 0.6);
                }

                .status-text {
                    color: oklch(0.98 0 0);
                    font-size: 14px;
                    font-weight: 500;
                    letter-spacing: -0.015em;
                }

                .action-btn {
                    background: oklch(0.98 0 0);
                    color: oklch(0.15 0 0);
                    border: none;
                    padding: 10px 22px;
                    border-radius: 9999px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    z-index: 2;
                    letter-spacing: -0.01em;
                    font-family: inherit;
                    box-shadow: 0 4px 12px oklch(0 0 0 / 0.1);
                }

                .action-btn:hover {
                    transform: scale(1.04) translateY(-1px);
                    background: white;
                    box-shadow: 0 12px 32px -8px oklch(0 0 0 / 0.4);
                }

                .action-btn:active {
                    transform: scale(0.96);
                }

                #resume-btn {
                    background: oklch(0.65 0.25 265);
                    color: white;
                    box-shadow: 0 4px 16px oklch(0.65 0.25 265 / 0.3);
                }

                #resume-btn:hover {
                    background: oklch(0.7 0.28 265);
                    box-shadow: 0 16px 32px -8px oklch(0.65 0.25 265 / 0.5);
                }

                /* ========== Resume Modal ========== */

                .kortix-resume-modal {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: oklch(0.05 0 0 / 0.4);
                    -webkit-backdrop-filter: blur(24px);
                    backdrop-filter: blur(24px);
                    z-index: 2147483647;
                    pointer-events: auto;
                    animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                .kortix-resume-modal.hidden {
                    display: none;
                }

                .modal-content {
                    background: oklch(0.15 0.01 285 / 0.85);
                    border: 1px solid oklch(1 0 0 / 0.1);
                    border-radius: 28px;
                    padding: 36px;
                    max-width: 480px;
                    width: 90%;
                    box-shadow: 0 48px 96px -24px oklch(0 0 0 / 0.6);
                    font-family: inherit;
                    position: relative;
                    overflow: hidden;
                }

                .modal-content h3 {
                    margin: 0 0 14px 0;
                    color: oklch(1 0 0);
                    font-size: 22px;
                    font-weight: 600;
                    letter-spacing: -0.025em;
                }

                .modal-content p {
                    margin: 0 0 24px 0;
                    color: oklch(0.85 0 0);
                    font-size: 15px;
                    line-height: 1.6;
                }

                .modal-content textarea {
                    width: 100%;
                    min-height: 140px;
                    padding: 18px;
                    border: 1px solid oklch(1 0 0 / 0.08);
                    border-radius: 20px;
                    background: oklch(1 0 0 / 0.03);
                    color: oklch(1 0 0);
                    font-size: 15px;
                    font-family: inherit;
                    resize: none;
                    outline: none;
                    transition: border-color 0.3s ease, background 0.3s ease;
                }

                .modal-content textarea:focus {
                    border-color: oklch(0.65 0.25 265 / 0.4);
                    background: oklch(1 0 0 / 0.05);
                }

                .modal-actions {
                    display: flex;
                    gap: 14px;
                    margin-top: 32px;
                    justify-content: flex-end;
                }

                .modal-btn {
                    padding: 12px 28px;
                    border-radius: 9999px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: inherit;
                    border: none;
                }

                .modal-btn-secondary {
                    background: oklch(1 0 0 / 0.04);
                    color: oklch(0.85 0 0);
                    border: 1px solid oklch(1 0 0 / 0.1);
                }

                .modal-btn-secondary:hover {
                    background: oklch(1 0 0 / 0.08);
                    transform: translateY(-2px);
                }

                .modal-btn-primary {
                    background: oklch(0.98 0 0);
                    color: oklch(0.15 0 0);
                    box-shadow: 0 8px 20px -4px oklch(0.98 0 0 / 0.2);
                }

                .modal-btn-primary:hover {
                    background: white;
                    transform: translateY(-2px);
                    box-shadow: 0 16px 32px -8px oklch(0 0 0 / 0.4);
                }
            </style>

            <div class="kortix-aura">
                <div class="aura-blobs">
                    <div class="aura-blob aura-blob-1"></div>
                    <div class="aura-blob aura-blob-2"></div>
                    <div class="aura-blob aura-blob-3"></div>
                </div>
            </div>

            <div class="tech-overlays">
                <div class="scanlines"></div>
                <div class="vignette"></div>
            </div>

            <!-- Status Pill -->
            <div class="kortix-overlay-container">
                <div class="grain"></div>

                <div class="status-group">
                    <div class="status-indicator"></div>
                    <span class="status-text">Kortix is browsing...</span>
                </div>

                <button class="action-btn" id="takeover-btn">
                    Take Over
                </button>

                <button class="action-btn" id="resume-btn" style="display: none;">
                    Resume Task
                </button>
            </div>

            <!-- Resume Modal -->
            <div class="kortix-resume-modal hidden">
                <div class="modal-content">
                    <div class="grain"></div>
                    <h3>Resume Task</h3>
                    <p>Briefly describe what you changed. This helps your Kortix Worker maintain continuity.</p>
                    <textarea
                        id="resume-summary"
                        placeholder="I updated the shipping address and saved the form..."
                    ></textarea>
                    <div class="modal-actions">
                        <button class="modal-btn modal-btn-secondary" id="cancel-resume-btn">
                            Cancel
                        </button>
                        <button class="modal-btn modal-btn-primary" id="confirm-resume-btn">
                            Confirm & Resume
                        </button>
                    </div>
                </div>
            </div>
        `;

    // Attach event listeners
    this.attachEventListeners();

    // Add to DOM
    document.body.appendChild(this.shadowHost);
  }

  /**
   * Attach event listeners to overlay elements
   */
  private attachEventListeners(): void {
    if (!this.shadowRoot) return;

    // Take Over button - switch to takeover mode
    const takeoverBtn = this.shadowRoot.querySelector("#takeover-btn");
    takeoverBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log("[Kortix Overlay] User requested takeover");

      // Disable blocking and switch state
      this.disableInputBlocking();
      this.setState("takeover");

      // Notify background script
      chrome.runtime.sendMessage({ type: "USER_TAKEOVER" });
    });

    // Resume button - show modal
    const resumeBtn = this.shadowRoot.querySelector("#resume-btn");
    resumeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log("[Kortix Overlay] User wants to resume");
      this.showResumeModal();
    });

    // Cancel resume - go back to takeover mode
    const cancelBtn = this.shadowRoot.querySelector("#cancel-resume-btn");
    cancelBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hideResumeModal();
    });

    // Confirm resume - send summary and switch back to ongoing
    const confirmBtn = this.shadowRoot.querySelector("#confirm-resume-btn");
    confirmBtn?.addEventListener("click", (e) => {
      e.stopPropagation();

      const textarea = this.shadowRoot?.querySelector(
        "#resume-summary",
      ) as HTMLTextAreaElement;
      const summary = textarea?.value?.trim() || "";

      console.log("[Kortix Overlay] Resuming with summary:", summary);

      // Re-enable blocking
      this.enableInputBlocking();
      this.setState("ongoing");
      this.hideResumeModal();

      // Notify background script with the summary
      chrome.runtime.sendMessage({
        type: "RESUME_TASK",
        summary: summary,
      });
    });

    // Close modal when clicking backdrop
    const modal = this.shadowRoot.querySelector(".kortix-resume-modal");
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.hideResumeModal();
      }
    });

    // Handle Escape key in modal
    const textarea = this.shadowRoot.querySelector("#resume-summary");
    textarea?.addEventListener("keydown", (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === "Escape") {
        this.hideResumeModal();
      }
      // Allow Ctrl+Enter to submit
      if (keyEvent.key === "Enter" && (keyEvent.ctrlKey || keyEvent.metaKey)) {
        confirmBtn?.dispatchEvent(new Event("click"));
      }
    });
  }

  /**
   * Clean up and remove overlay
   */
  private destroy(): void {
    this.disableInputBlocking();

    if (this.shadowHost) {
      this.shadowHost.remove();
      this.shadowHost = null;
      this.shadowRoot = null;
    }

    this.state = "hidden";
  }

  /**
   * Get current overlay state
   */
  public getState(): OverlayState {
    return this.state;
  }

  /**
   * Check if overlay is currently visible
   */
  public isVisible(): boolean {
    return this.state !== "hidden";
  }

  /**
   * Check if currently in takeover mode
   */
  public isInTakeover(): boolean {
    return this.state === "takeover";
  }
}

// Export singleton instance
export const overlayManager = new OverlayManager();
