/**
 * Markdown Preview Component Plan
 * 
 * Analysis of Markdown Preview Requirements:
 * 
 * ## Rendering Strategy
 * - Use existing react-markdown + remark-gfm + rehype pipeline
 * - Parse full markdown but truncate before rendering
 * - Show first N lines (suggested: 3-5 lines for preview)
 * - Strip code block syntax highlighting for performance
 * - Remove complex elements (tables, diagrams)
 * - Clean HTML and sanitize output
 * 
 * ## Display Characteristics
 * - Max height: ~60-80px (fits 2-3 lines of text)
 * - Max width: Full thread-card width
 * - Font size: 0.875rem (text-sm)
 * - Color: Muted foreground to differentiate from title
 * - Line clamping: 3 lines max with text-ellipsis
 * - Overflow: Hidden with ellipsis
 * 
 * ## Content Handling
 * - Headings: Render as text (remove # markers)
 * - Bold/Italic: Preserve formatting
 * - Code: Render inline code (backticks) as text
 * - Code blocks: Show first line with language indicator
 * - Links: Render as text (remove markdown syntax)
 * - Lists: Render first item
 * - Images: Skip (would be complex in preview)
 * - Tables: Skip (not relevant for preview)
 * 
 * ## Truncation Logic
 * 1. Split markdown by lines
 * 2. Take first 5-10 lines
 * 3. Join back to markdown string
 * 4. Render with react-markdown
 * 5. Apply CSS line-clamp (3 lines)
 * 6. Add ellipsis if content extends beyond
 * 
 * ## File Integration
 * - Location: frontend/src/components/library/markdown-preview/MarkdownPreview.tsx
 * - Props: 
 *   - markdown: string (raw markdown content)
 *   - maxLines?: number (default: 5)
 *   - maxChars?: number (default: 300)
 *   - className?: string
 * - Usage: <MarkdownPreview markdown={fileContent} />
 * 
 * ## Integration in thread-card
 * - Show preview only when file is .md AND isExpanded is true
 * - Position: Below title, above file list
 * - Styling: Similar styling to file list items
 * - Click: Launches full file viewer modal (existing behavior)
 * 
 * ## Performance Considerations
 * - Only parse first N lines (not full file)
 * - Lazy load previews (only for expanded cards)
 * - Cache parsed markdown if needed
 * - Minimal re-renders
 * 
 * ## Testing Strategy
 * 1. Create test .md file with mixed content
 * 2. Test truncation (shows only first few lines)
 * 3. Test formatting (preserves bold, italic, inline code)
 * 4. Test edge cases (empty file, single line, very long lines)
 * 5. Test in thread-card (preview appears below title)
 * 6. Test modal launch (clicking preview opens file viewer)
 */

export const MarkdownPreviewPlan = {
  maxLinesDefault: 5,
  maxCharsDefault: 300,
  lineClampsInCSS: 3,
  previewHeight: '60px',
  fontSize: 'text-sm',
  color: 'text-muted-foreground',
};
