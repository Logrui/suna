/**
 * Markdown Preview Component
 * Displays a truncated preview of markdown files in thread cards
 * Uses the same rendering logic as the file viewer modal for consistency
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';
import { CodeRenderer } from '@/components/file-renderers/code-renderer';

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
 * Custom renderers matching the file viewer modal styling
 */
const previewComponents = {
  // Code blocks - use the same CodeRenderer as modal
  code(props: any) {
    const { className, children, ...rest } = props;
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const code = String(children).replace(/\n$/, '');
    
    const isInline = !className || !match;
    
    if (isInline) {
      return (
        <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono" {...rest}>
          {children}
        </code>
      );
    }
    
    return (
      <CodeRenderer
        content={code}
        language={language}
      />
    );
  },

  // Headings - matching modal styles
  h1: ({ node, ...props }: any) => (
    <h1 className="text-2xl font-medium my-4 first:mt-0" {...props} />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 className="text-xl font-medium my-3 first:mt-0" {...props} />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 className="text-lg font-medium my-2 first:mt-0" {...props} />
  ),
  h4: ({ node, ...props }: any) => (
    <h4 className="text-base font-medium my-2 first:mt-0" {...props} />
  ),
  h5: ({ node, ...props }: any) => (
    <h5 className="text-base font-medium my-2 first:mt-0" {...props} />
  ),
  h6: ({ node, ...props }: any) => (
    <h6 className="text-base font-medium my-2 first:mt-0" {...props} />
  ),

  // Links
  a: ({ node, ...props }: any) => (
    <a className="text-primary hover:underline" {...props} />
  ),

  // Paragraphs
  p: ({ node, ...props }: any) => (
    <p className="my-2 leading-relaxed" {...props} />
  ),

  // Lists
  ul: ({ node, ...props }: any) => (
    <ul className="list-disc pl-5 my-2" {...props} />
  ),
  ol: ({ node, ...props }: any) => (
    <ol className="list-decimal pl-5 my-2" {...props} />
  ),
  li: ({ node, ...props }: any) => (
    <li className="my-1" {...props} />
  ),

  // Blockquotes
  blockquote: ({ node, ...props }: any) => (
    <blockquote className="border-l-4 border-muted pl-4 italic my-2" {...props} />
  ),

  // Tables - matching modal styles
  table: ({ node, ...props }: any) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ node, ...props }: any) => (
    <th
      className="border border-slate-300 dark:border-zinc-700 px-3 py-2 text-left font-semibold bg-slate-100 dark:bg-zinc-800"
      {...props}
    />
  ),
  td: ({ node, ...props }: any) => (
    <td
      className="border border-slate-300 dark:border-zinc-700 px-3 py-2"
      {...props}
    />
  ),

  // Pre - no background for code blocks
  pre: ({ node, ...props }: any) => (
    <pre className="p-0 my-2 bg-transparent" {...props} />
  ),

  // Images - simple placeholder for preview
  img: ({ node, ...props }: any) => (
    <div className="text-sm text-muted-foreground my-2 p-2 bg-muted/30 rounded border border-dashed">
      [Image: {props.alt || 'untitled'}]
    </div>
  ),
  
  // Inline formatting
  strong: ({ node, ...props }: any) => (
    <strong className="font-semibold" {...props} />
  ),
  em: ({ node, ...props }: any) => (
    <em className="italic" {...props} />
  ),
  
  // Horizontal rule
  hr: ({ node, ...props }: any) => (
    <hr className="my-4 border-muted-foreground/20" {...props} />
  ),
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
        'markdown prose prose-sm dark:prose-invert max-w-none',
        'text-lg leading-relaxed',
        '[&>*:first-child]:mt-0',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={previewComponents}
      >
        {truncated}
      </ReactMarkdown>
    </div>
  );
};

MarkdownPreview.displayName = 'MarkdownPreview';
