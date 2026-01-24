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
   * Show overlay in "ongoing" state (agent is working)
   */
  public show(): void {
    if (this.state !== "hidden") return;

    this.createOverlay();
    this.setState("ongoing");
    this.enableInputBlocking();
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
    const pulseDot = this.shadowRoot.querySelector(".pulse-dot") as HTMLElement;
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
        if (aura) aura.classList.remove("paused");
        if (container) container.classList.remove("takeover-mode");
        if (statusText) statusText.textContent = "Kortix Worker is browsing...";
        if (pulseDot) {
          pulseDot.classList.remove("paused");
          pulseDot.style.background = "oklch(0.72 0.18 150)";
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
            "You are in control. Click Resume when done.";
        if (pulseDot) {
          pulseDot.classList.add("paused");
          pulseDot.style.background = "oklch(0.7 0.15 60)"; // Orange/amber
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
                    from {
                        transform: translate(-50%, 30px);
                        opacity: 0;
                    }
                    to {
                        transform: translate(-50%, 0);
                        opacity: 1;
                    }
                }

                @keyframes pulse {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(3.5);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 0;
                    }
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                @keyframes fadeOut {
                    from {
                        opacity: 1;
                    }
                    to {
                        opacity: 0;
                    }
                }

                /* ========== Atmospheric Aura ========== */

                .kortix-aura {
                    position: fixed;
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
                    transition: opacity 0.5s ease;
                }

                .kortix-aura.paused {
                    animation-play-state: paused;
                    opacity: 0.3;
                    background: radial-gradient(
                        circle at center,
                        transparent 45%,
                        oklch(0.6 0.15 60 / 0.08) 75%,
                        oklch(0.55 0.12 45 / 0.2) 100%
                    );
                }

                /* ========== Interaction Blocker (visual feedback) ========== */

                .kortix-interaction-layer {
                    position: fixed;
                    inset: 0;
                    z-index: 2147483642;
                    pointer-events: none;
                    cursor: not-allowed;
                }

                /* ========== Status Pill ========== */

                .kortix-overlay-container {
                    position: fixed;
                    bottom: 32px;
                    left: 50%;
                    transform: translateX(-50%);
                    pointer-events: auto;
                    font-family: 'Roobert', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background: oklch(0.2 0.005 285.823 / 0.85);
                    -webkit-backdrop-filter: blur(28px) saturate(180%);
                    backdrop-filter: blur(28px) saturate(180%);
                    border: 1.5px solid oklch(1 0 0 / 0.1);
                    border-radius: 1rem;
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
                    transition: all 0.3s ease;
                }

                .kortix-overlay-container.takeover-mode {
                    border-color: oklch(0.7 0.15 60 / 0.3);
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
                    transition: background 0.3s ease, box-shadow 0.3s ease;
                }

                .pulse-dot::after {
                    content: '';
                    position: absolute;
                    inset: -3px;
                    border-radius: 50%;
                    border: 1px solid oklch(0.72 0.18 150);
                    animation: pulse 3s infinite;
                }

                .pulse-dot.paused {
                    box-shadow: 0 0 12px oklch(0.7 0.15 60);
                }

                .pulse-dot.paused::after {
                    animation: none;
                    border-color: oklch(0.7 0.15 60);
                }

                .status-text {
                    color: oklch(0.985 0 0);
                    font-size: 13px;
                    font-weight: 500;
                    letter-spacing: -0.02em;
                    transition: color 0.3s ease;
                }

                .action-btn {
                    background: oklch(0.985 0 0);
                    color: oklch(0.205 0 0);
                    border: none;
                    padding: 7px 16px;
                    border-radius: 0.625rem;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    z-index: 2;
                    letter-spacing: -0.01em;
                    box-shadow: 0 4px 12px oklch(0 0 0 / 0.1);
                    font-family: inherit;
                }

                .action-btn:hover {
                    transform: translateY(-1px) scale(1.02);
                    background: oklch(1 0 0);
                    box-shadow: 0 6px 16px oklch(0 0 0 / 0.2);
                }

                .action-btn:active {
                    transform: translateY(0) scale(0.98);
                }

                #resume-btn {
                    background: oklch(0.65 0.2 260);
                    color: white;
                }

                #resume-btn:hover {
                    background: oklch(0.7 0.22 260);
                }

                /* ========== Resume Modal ========== */

                .kortix-resume-modal {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: oklch(0 0 0 / 0.5);
                    -webkit-backdrop-filter: blur(12px);
                    backdrop-filter: blur(12px);
                    z-index: 2147483647;
                    pointer-events: auto;
                    animation: fadeIn 0.3s ease forwards;
                }

                .kortix-resume-modal.hidden {
                    display: none;
                }

                .modal-content {
                    background: oklch(0.18 0.01 285 / 0.95);
                    -webkit-backdrop-filter: blur(20px);
                    backdrop-filter: blur(20px);
                    border: 1.5px solid oklch(1 0 0 / 0.12);
                    border-radius: 1.25rem;
                    padding: 28px;
                    max-width: 420px;
                    width: 90%;
                    box-shadow:
                        0 25px 50px -12px oklch(0 0 0 / 0.7),
                        0 0 0 1px oklch(1 0 0 / 0.05) inset;
                    animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    font-family: 'Roobert', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }

                .modal-content h3 {
                    margin: 0 0 8px 0;
                    color: oklch(0.985 0 0);
                    font-size: 18px;
                    font-weight: 600;
                    letter-spacing: -0.02em;
                }

                .modal-content p {
                    margin: 0 0 16px 0;
                    color: oklch(0.7 0 0);
                    font-size: 14px;
                    line-height: 1.5;
                }

                .modal-content textarea {
                    width: 100%;
                    min-height: 100px;
                    padding: 12px 14px;
                    border: 1.5px solid oklch(1 0 0 / 0.1);
                    border-radius: 0.75rem;
                    background: oklch(0.12 0.005 285);
                    color: oklch(0.95 0 0);
                    font-size: 14px;
                    font-family: inherit;
                    resize: vertical;
                    outline: none;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                }

                .modal-content textarea::placeholder {
                    color: oklch(0.5 0 0);
                }

                .modal-content textarea:focus {
                    border-color: oklch(0.65 0.2 260 / 0.5);
                    box-shadow: 0 0 0 3px oklch(0.65 0.2 260 / 0.15);
                }

                .modal-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 20px;
                    justify-content: flex-end;
                }

                .modal-btn {
                    padding: 10px 20px;
                    border-radius: 0.625rem;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: inherit;
                    border: none;
                }

                .modal-btn-secondary {
                    background: oklch(1 0 0 / 0.1);
                    color: oklch(0.85 0 0);
                    border: 1px solid oklch(1 0 0 / 0.1);
                }

                .modal-btn-secondary:hover {
                    background: oklch(1 0 0 / 0.15);
                }

                .modal-btn-primary {
                    background: oklch(0.65 0.2 260);
                    color: white;
                    box-shadow: 0 4px 12px oklch(0.65 0.2 260 / 0.3);
                }

                .modal-btn-primary:hover {
                    background: oklch(0.7 0.22 260);
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px oklch(0.65 0.2 260 / 0.4);
                }

                .modal-btn-primary:active {
                    transform: translateY(0);
                }
            </style>

            <!-- Atmospheric Aura -->
            <div class="kortix-aura"></div>

            <!-- Status Pill -->
            <div class="kortix-overlay-container">
                <div class="grain"></div>

                <div class="status-group">
                    <div class="pulse-dot"></div>
                    <span class="status-text">Kortix Worker is browsing...</span>
                </div>

                <button class="action-btn" id="takeover-btn">
                    Take Over
                </button>

                <button class="action-btn" id="resume-btn" style="display: none;">
                    Resume
                </button>
            </div>

            <!-- Resume Modal -->
            <div class="kortix-resume-modal hidden">
                <div class="modal-content">
                    <h3>Resume Task</h3>
                    <p>Let Kortix know what you changed during the takeover. This helps the agent understand the current state.</p>
                    <textarea
                        id="resume-summary"
                        placeholder="I logged in, navigated to the dashboard, and updated my profile settings..."
                    ></textarea>
                    <div class="modal-actions">
                        <button class="modal-btn modal-btn-secondary" id="cancel-resume-btn">
                            Cancel
                        </button>
                        <button class="modal-btn modal-btn-primary" id="confirm-resume-btn">
                            Resume Agent
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
