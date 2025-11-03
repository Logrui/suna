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
  /** Maximum number of lines to show (default: 20) */
  maxLines?: number;
  /** Maximum number of characters to show (default: 1600) */
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
 * Custom renderers for preview mode with proper formatting
 */
const previewComponents = {
  // Headings: render with proper sizing and spacing
  h1: ({ children }: any) => <h1 className="text-2xl font-semibold mb-2 mt-3 first:mt-0">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-semibold mb-2 mt-3 first:mt-0">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-semibold mb-1.5 mt-2.5 first:mt-0">{children}</h3>,
  h4: ({ children }: any) => <h4 className="text-base font-semibold mb-1.5 mt-2 first:mt-0">{children}</h4>,
  h5: ({ children }: any) => <h5 className="text-base font-medium mb-1 mt-2 first:mt-0">{children}</h5>,
  h6: ({ children }: any) => <h6 className="text-base font-medium mb-1 mt-2 first:mt-0">{children}</h6>,

  // Inline elements
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,

  // Links: render with accent color
  a: ({ children, href }: any) => <span className="text-blue-400 underline">{children}</span>,

  // Paragraphs: block-level with spacing
  p: ({ children }: any) => <p className="mb-2 leading-relaxed">{children}</p>,

  // Line breaks
  br: () => <br />,

  // Lists: proper formatting
  ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,

  // Code blocks and inline code
  code: ({ node, inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
      );
    }

    // For code blocks, show with proper formatting
    return (
      <pre className="bg-muted/50 p-2 rounded mb-2 overflow-x-auto">
        <code className="text-sm font-mono">{children}</code>
      </pre>
    );
  },

  // Blockquotes
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 mb-2 italic text-muted-foreground">
      {children}
    </blockquote>
  ),

  // Tables - properly formatted
  table: ({ children }: any) => (
    <div className="overflow-x-auto mb-3">
      <table className="min-w-full border-collapse border border-border/30 text-sm">
        {children}
      </table>
    </div>
  ),
  
  thead: ({ children }: any) => (
    <thead className="bg-muted/30">
      {children}
    </thead>
  ),
  
  tbody: ({ children }: any) => (
    <tbody>
      {children}
    </tbody>
  ),
  
  tr: ({ children }: any) => (
    <tr className="border-b border-border/20">
      {children}
    </tr>
  ),
  
  th: ({ children }: any) => (
    <th className="border border-border/20 px-3 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  
  td: ({ children }: any) => (
    <td className="border border-border/20 px-3 py-1.5">
      {children}
    </td>
  ),
  
  // Images - show placeholder
  img: ({ alt }: any) => <div className="text-sm text-muted-foreground mb-1">[Image: {alt || 'untitled'}]</div>,
  
  // Horizontal rule
  hr: () => <hr className="my-2 border-muted-foreground/20" />,
};

/**
 * Renders a preview of markdown content
 * Truncated to first N lines with formatting preserved
 */
export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  markdown,
  maxLines = 20,
  maxChars = 1600,
  className,
}) => {
  if (!markdown) {
    return null;
  }

  const truncated = truncateMarkdown(markdown, maxLines, maxChars);

  return (
    <div
      className={cn(
        'text-lg leading-relaxed text-foreground prose prose-invert max-w-none',
        'break-words overflow-hidden',
        '[&>*:first-child]:mt-0',
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
