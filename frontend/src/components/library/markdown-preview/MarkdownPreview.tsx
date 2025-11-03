/**
 * Markdown Preview Component
 * Displays a truncated preview of markdown files in thread cards
 * Shows first N lines with formatting preserved but HTML stripped
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownPreviewProps {
  /** Raw markdown content to preview */
  markdown: string;
  /** Maximum number of lines to show (default: 5) */
  maxLines?: number;
  /** Maximum number of characters to show (default: 300) */
  maxChars?: number;
  /** Optional CSS class */
  className?: string;
}

/**
 * Truncates markdown to a preview-friendly length
 * Takes first N lines and limits character count
 */
function truncateMarkdown(
  markdown: string,
  maxLines: number = 5,
  maxChars: number = 300
): string {
  if (!markdown) return '';

  // Split by lines and take first N
  const lines = markdown.split('\n').slice(0, maxLines);
  let truncated = lines.join('\n');

  // Limit by character count
  if (truncated.length > maxChars) {
    truncated = truncated.substring(0, maxChars).trim();
    // Remove incomplete last word
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.substring(0, lastSpace);
    }
    truncated += '…';
  }

  return truncated;
}

/**
 * Custom renderers for preview mode (minimal, text-focused)
 */
const previewComponents = {
  // Headings: render without # markers
  h1: ({ children }: any) => <span className="font-semibold">{children}</span>,
  h2: ({ children }: any) => <span className="font-semibold">{children}</span>,
  h3: ({ children }: any) => <span className="font-semibold">{children}</span>,
  h4: ({ children }: any) => <span className="font-semibold">{children}</span>,
  h5: ({ children }: any) => <span className="font-semibold">{children}</span>,
  h6: ({ children }: any) => <span className="font-semibold">{children}</span>,

  // Inline elements
  strong: ({ children }: any) => <strong>{children}</strong>,
  em: ({ children }: any) => <em>{children}</em>,

  // Links: render as text with accent color
  a: ({ children }: any) => <span className="text-blue-500">{children}</span>,

  // Paragraphs: inline flow
  p: ({ children }: any) => <span>{children}</span>,

  // Line breaks
  br: () => <br />,

  // Lists: show first item only
  ul: ({ children }: any) => <span>{children}</span>,
  ol: ({ children }: any) => <span>{children}</span>,
  li: ({ children }: any) => (
    <span className="inline">
      • {children}{' '}
    </span>
  ),

  // Code blocks and inline code: show with minimal styling
  code: ({ node, inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
      );
    }

    // For code blocks in preview, just show first line
    const firstLine = String(children).split('\n')[0];
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'code';

    return (
      <span className="inline text-xs">
        [{language}] {firstLine}
      </span>
    );
  },

  // Skip complex elements for preview
  blockquote: ({ children }: any) => <span>{children}</span>,
  table: () => <span>[Table]</span>,
  img: () => <span>[Image]</span>,
  hr: () => null,
};

/**
 * Renders a preview of markdown content
 * Truncated to first N lines with formatting preserved
 */
export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  markdown,
  maxLines = 5,
  maxChars = 300,
  className,
}) => {
  if (!markdown) {
    return null;
  }

  const truncated = truncateMarkdown(markdown, maxLines, maxChars);

  return (
    <div
      className={cn(
        'text-sm text-muted-foreground line-clamp-3 prose-sm prose-invert max-w-none',
        'break-words whitespace-normal overflow-hidden text-ellipsis',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={previewComponents}
      >
        {truncated}
      </ReactMarkdown>
    </div>
  );
};

MarkdownPreview.displayName = 'MarkdownPreview';
