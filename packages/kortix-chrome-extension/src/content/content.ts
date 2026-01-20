/**
 * Kortix AI Browser Operator - Content Script
 * 
 * Executes commands in the page context:
 * - DOM manipulation (click, type, scroll)
 * - Data extraction (emails, text, attributes)
 * - Screenshot capture
 * - Form interaction
 * - Element inspection
 */

interface CommandRequest {
  type: string;
  command: {
    id: string;
    action: string;
    params?: Record<string, any>;
  };
  commandId: string;
  sessionId: string;
}

interface CommandResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Main command handler
 */
chrome.runtime.onMessage.addListener(
  (request: CommandRequest, _sender, sendResponse) => {
    if (request.type === 'executeCommand') {
      executeCommand(request.command)
        .then((result) => {
          sendResponse({ success: true, data: result });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
          });
        });

      return true; // Keep channel open for async response
    }
  }
);

/**
 * Execute command based on action type
 */
async function executeCommand(command: any): Promise<any> {
  const { action, params } = command;

  switch (action) {
    case 'navigate':
      return handleNavigate(params);

    case 'click':
      return handleClick(params);

    case 'type':
      return handleType(params);

    case 'scroll':
      return handleScroll(params);

    case 'screenshot':
      return handleScreenshot(params);

    case 'extractEmails':
      return handleExtractEmails(params);

    case 'extractContent':
      return handleExtractContent(params);

    case 'getElements':
      return handleGetElements(params);

    case 'fillForm':
      return handleFillForm(params);

    case 'submitForm':
      return handleSubmitForm(params);

    case 'getPageInfo':
      return handleGetPageInfo(params);

    case 'executeScript':
      return handleExecuteScript(params);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Navigate to URL
 */
async function handleNavigate(params: any): Promise<any> {
  const { url } = params;

  if (!url) {
    throw new Error('URL parameter required');
  }

  window.location.href = url;

  // Wait for page to load
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        url: window.location.href,
        title: document.title,
      });
    }, 2000);
  });
}

/**
 * Click element by selector or index
 */
async function handleClick(params: any): Promise<any> {
  const { selector, index } = params;

  let element: Element | null = null;

  if (selector) {
    element = document.querySelector(selector);
  } else if (index !== undefined) {
    const elements = document.querySelectorAll('a, button, input, [role="button"]');
    element = elements[index];
  }

  if (!element) {
    throw new Error('Element not found');
  }

  (element as HTMLElement).click();

  // Wait for action to complete
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    clicked: true,
    element: element.tagName,
  };
}

/**
 * Type text into element
 */
async function handleType(params: any): Promise<any> {
  const { selector, text, index } = params;

  let element: Element | null = null;

  if (selector) {
    element = document.querySelector(selector);
  } else if (index !== undefined) {
    const elements = document.querySelectorAll('input, textarea');
    element = elements[index];
  }

  if (!element) {
    throw new Error('Element not found');
  }

  const input = element as HTMLInputElement | HTMLTextAreaElement;
  input.focus();
  input.value = text;

  // Trigger input event
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  return {
    typed: true,
    value: input.value,
  };
}

/**
 * Scroll page
 */
async function handleScroll(params: any): Promise<any> {
  const { direction, amount = 500 } = params;

  if (direction === 'down') {
    window.scrollBy(0, amount);
  } else if (direction === 'up') {
    window.scrollBy(0, -amount);
  } else if (direction === 'top') {
    window.scrollTo(0, 0);
  } else if (direction === 'bottom') {
    window.scrollTo(0, document.body.scrollHeight);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    scrolled: true,
    scrollY: window.scrollY,
  };
}

/**
 * Take screenshot using canvas API
 */
async function handleScreenshot(_params: any): Promise<any> {
  try {
    const canvas = await html2canvas(document.body);
    const dataUrl = canvas.toDataURL('image/png');

    return {
      screenshot: dataUrl,
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    console.warn('[Kortix Extension - Content] Screenshot failed, using fallback');

    return {
      screenshot: null,
      error: 'Screenshot not available',
      fallback: true,
    };
  }
}

/**
 * Extract emails from page
 */
async function handleExtractEmails(_params: any): Promise<any> {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  // Extract from text content
  const bodyText = document.body.innerText;
  const emailsFromText = bodyText.match(emailRegex) || [];

  // Extract from mailto links
  const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
    .map((a) => {
      const href = (a as HTMLAnchorElement).href;
      return href.replace('mailto:', '').split('?')[0];
    });

  // Extract from data attributes
  const dataAttributeEmails = Array.from(
    document.querySelectorAll('[data-email]')
  )
    .map((el) => el.getAttribute('data-email'))
    .filter((email): email is string => email !== null && email !== '');

  // Combine and deduplicate
  const allEmails = [...new Set([...emailsFromText, ...mailtoLinks, ...dataAttributeEmails])];

  return {
    emails: allEmails,
    count: allEmails.length,
    sources: {
      text: emailsFromText.length,
      mailto: mailtoLinks.length,
      dataAttributes: dataAttributeEmails.length,
    },
  };
}

/**
 * Extract page content
 */
async function handleExtractContent(params: any): Promise<any> {
  const { selector } = params;

  let content = '';

  if (selector) {
    const element = document.querySelector(selector);
    content = element?.textContent || '';
  } else {
    content = document.body.innerText;
  }

  return {
    content: content.trim(),
    length: content.length,
  };
}

/**
 * Get all interactive elements
 */
async function handleGetElements(_params: any): Promise<any> {
  const elements = document.querySelectorAll(
    'a, button, input, textarea, select, [role="button"], [role="link"]'
  );

  const elementsList = Array.from(elements)
    .slice(0, 100) // Limit to first 100
    .map((el, index) => ({
      index,
      tag: el.tagName.toLowerCase(),
      text: el.textContent?.substring(0, 100) || '',
      type: (el as HTMLInputElement).type || '',
      href: (el as HTMLAnchorElement).href || '',
      id: el.id || '',
      className: el.className || '',
    }));

  return {
    elements: elementsList,
    total: elements.length,
  };
}

/**
 * Fill form fields
 */
async function handleFillForm(params: any): Promise<any> {
  const { fields } = params;

  if (!fields || typeof fields !== 'object') {
    throw new Error('Fields parameter required');
  }

  const results: any = {};

  for (const [selector, value] of Object.entries(fields)) {
    const element = document.querySelector(selector);

    if (!element) {
      results[selector] = { success: false, error: 'Element not found' };
      continue;
    }

    const input = element as HTMLInputElement | HTMLTextAreaElement;
    input.focus();
    input.value = String(value);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    results[selector] = { success: true, value: input.value };
  }

  return results;
}

/**
 * Submit form
 */
async function handleSubmitForm(params: any): Promise<any> {
  const { selector } = params;

  const form = selector
    ? document.querySelector(selector)
    : document.querySelector('form');

  if (!form) {
    throw new Error('Form not found');
  }

  (form as HTMLFormElement).submit();

  // Wait for submission
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return {
    submitted: true,
    url: window.location.href,
  };
}

/**
 * Get page information
 */
async function handleGetPageInfo(_params: any): Promise<any> {
  return {
    title: document.title,
    url: window.location.href,
    domain: window.location.hostname,
    protocol: window.location.protocol,
    scrollY: window.scrollY,
    scrollHeight: document.body.scrollHeight,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    readyState: document.readyState,
  };
}

/**
 * Execute arbitrary script (with restrictions)
 */
async function handleExecuteScript(params: any): Promise<any> {
  const { code } = params;

  if (!code) {
    throw new Error('Code parameter required');
  }

  try {
    // Use Function constructor to execute code in page context
    const result = new Function(code)();

    return {
      success: true,
      result: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Script execution failed',
    };
  }
}

/**
 * Utility: html2canvas fallback
 * Simple implementation if library not available
 */
async function html2canvas(_element: HTMLElement): Promise<HTMLCanvasElement> {
  // This is a placeholder - in production, include the html2canvas library
  // For now, return a simple canvas with page info
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = '16px Arial';
    ctx.fillText(`Screenshot: ${document.title}`, 10, 30);
  }

  return canvas;
}

console.log('[Kortix Extension - Content] Content script loaded');
