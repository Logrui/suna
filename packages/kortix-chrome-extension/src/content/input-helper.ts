/**
 * Input Helper for Kortix Extension
 *
 * Provides robust input handling that bypasses React's event suppression
 * and works with modern frameworks (React 16+, Vue, Angular, etc.)
 *
 * The key insight from Manus: React tracks the `value` property descriptor
 * and ignores programmatic changes that don't trigger its internal setter.
 * We bypass this by using the native HTMLInputElement.prototype setter directly.
 */

export class InputHelper {
    // Cache native setters for performance
    private static nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
    )?.set;

    private static nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
    )?.set;

    /**
     * Set value on a React-controlled input/textarea while bypassing React's value tracker
     * This ensures React recognizes the change and updates its internal state
     */
    static setReactValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
        const lastValue = element.value;
        element.value = value;

        // Reset React's value tracker if present
        // React 16+ uses _valueTracker to detect programmatic value changes
        const tracker = (element as any)._valueTracker;
        if (tracker) {
            tracker.setValue(lastValue);
        }

        // Dispatch events to notify React and other frameworks
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }

    /**
     * Type text into any element (input, textarea, or contenteditable)
     * Uses native setters to bypass framework protections
     *
     * @param element - The target element to type into
     * @param text - The text to type
     * @param clear - Whether to clear existing content first (default: true)
     */
    static type(element: HTMLElement, text: string, clear: boolean = true): void {
        // Focus the element first
        element.focus();

        if (element instanceof HTMLInputElement) {
            this.typeIntoInput(element, text, clear);
        } else if (element instanceof HTMLTextAreaElement) {
            this.typeIntoTextArea(element, text, clear);
        } else if (element.isContentEditable) {
            this.typeIntoContentEditable(element, text, clear);
        } else {
            // Fallback: try to set textContent
            console.warn('[InputHelper] Unknown element type, using textContent fallback');
            element.textContent = text;
        }
    }

    /**
     * Type into an HTMLInputElement using native setter
     */
    private static typeIntoInput(input: HTMLInputElement, text: string, clear: boolean): void {
        const newValue = clear ? text : input.value + text;

        // Use native setter to bypass React's controlled component logic
        if (this.nativeInputValueSetter) {
            this.nativeInputValueSetter.call(input, newValue);
        } else {
            // Fallback if native setter not available
            input.value = newValue;
        }

        // Reset React's value tracker
        const tracker = (input as any)._valueTracker;
        if (tracker) {
            tracker.setValue(clear ? '' : input.value);
        }

        // Dispatch comprehensive events for framework compatibility
        this.dispatchInputEvents(input, text);
    }

    /**
     * Type into an HTMLTextAreaElement using native setter
     */
    private static typeIntoTextArea(textarea: HTMLTextAreaElement, text: string, clear: boolean): void {
        const newValue = clear ? text : textarea.value + text;

        // Use native setter to bypass React's controlled component logic
        if (this.nativeTextAreaValueSetter) {
            this.nativeTextAreaValueSetter.call(textarea, newValue);
        } else {
            // Fallback if native setter not available
            textarea.value = newValue;
        }

        // Reset React's value tracker
        const tracker = (textarea as any)._valueTracker;
        if (tracker) {
            tracker.setValue(clear ? '' : textarea.value);
        }

        // Dispatch comprehensive events for framework compatibility
        this.dispatchInputEvents(textarea, text);
    }

    /**
     * Type into a contenteditable element (rich text editors like DraftJS, ProseMirror, Slate, etc.)
     */
    private static typeIntoContentEditable(element: HTMLElement, text: string, clear: boolean): void {
        // Select all content if clearing
        if (clear) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            selection?.removeAllRanges();
            selection?.addRange(range);
        } else {
            // Move cursor to end
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(false); // Collapse to end
            selection?.removeAllRanges();
            selection?.addRange(range);
        }

        // Try document.execCommand first (works on most rich text editors)
        // Note: execCommand is deprecated but still widely supported and often the only way
        // to properly interact with rich text editors
        const execSuccess = document.execCommand('insertText', false, text);

        if (!execSuccess) {
            // Fallback: Use InputEvent (modern approach for some editors)
            try {
                const inputEvent = new InputEvent('beforeinput', {
                    inputType: 'insertText',
                    data: text,
                    bubbles: true,
                    cancelable: true,
                });
                element.dispatchEvent(inputEvent);

                // If beforeinput didn't insert, manually set
                if (clear) {
                    element.textContent = text;
                } else {
                    element.textContent = (element.textContent || '') + text;
                }

                element.dispatchEvent(new InputEvent('input', {
                    inputType: 'insertText',
                    data: text,
                    bubbles: true,
                }));
            } catch (e) {
                // Final fallback: direct textContent manipulation
                if (clear) {
                    element.textContent = text;
                } else {
                    element.textContent = (element.textContent || '') + text;
                }
            }
        }
    }

    /**
     * Dispatch comprehensive input events for maximum framework compatibility
     */
    private static dispatchInputEvents(element: HTMLElement, data: string): void {
        // beforeinput - Modern editors like ProseMirror listen to this
        try {
            element.dispatchEvent(new InputEvent('beforeinput', {
                inputType: 'insertText',
                data: data,
                bubbles: true,
                cancelable: true,
            }));
        } catch (e) {
            // InputEvent might not support all options in older browsers
        }

        // input - Standard event, React listens to this
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

        // change - Some frameworks prefer this
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

        // Trigger blur/focus cycle to ensure validation runs
        // (Some forms validate on blur)
    }

    /**
     * Clear an input element
     */
    static clear(element: HTMLElement): void {
        this.type(element, '', true);
    }

    /**
     * Append text to an existing value without clearing
     */
    static append(element: HTMLElement, text: string): void {
        this.type(element, text, false);
    }

    /**
     * Simulate typing character by character with delay (for visual feedback)
     * Useful for demos or when sites detect instant typing as bot behavior
     */
    static async typeSlowly(
        element: HTMLElement,
        text: string,
        delayMs: number = 50,
        clear: boolean = true
    ): Promise<void> {
        element.focus();

        if (clear) {
            this.clear(element);
        }

        for (const char of text) {
            // Small random variance to seem more human
            const variance = Math.random() * 20 - 10;
            await new Promise(resolve => setTimeout(resolve, delayMs + variance));
            this.append(element, char);
        }
    }

    /**
     * Check if an element is a valid input target
     */
    static isInputElement(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement {
        return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
    }

    /**
     * Check if an element is contenteditable
     */
    static isContentEditable(element: Element | null): boolean {
        return element instanceof HTMLElement && element.isContentEditable;
    }

    /**
     * Check if an element can receive text input
     */
    static isTypeable(element: Element | null): boolean {
        return this.isInputElement(element) || this.isContentEditable(element);
    }
}

// Export singleton for convenience
export const inputHelper = InputHelper;
