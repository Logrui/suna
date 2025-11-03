# File Previews Implementation Plan

**Created:** November 2, 2025  
**Feature:** Library File Previews with Icons and MD Rendering

## Manus SVG Icons Discovered

Through Chrome DevTools inspection, we found **9 unique icon archetypes** used by Manus:

| Icon Type | Color Scheme | File Types | Count |
|-----------|--------------|-----------|-------|
| **Document/Text** | Blue (#4876D3/#9CC3F4) | .md, .txt, .doc, .docx | 94 |
| **Spreadsheet** | Green (#408B52/#84C293) | .csv, .xlsx, .xls | 14 |
| **Code/Data** | Light Blue (#418CD6/#7CBDFF) | .js, .ts, .json, .yaml | 28 |
| **Application** | Bright Blue (#0081F2) | .exe, .app, binaries | 19 |
| **PDF** | Red (#D84D4F/#F78E8F) | .pdf | 1 |
| **Archive** | Orange (#DE9000/#F1BC5E) | .zip, .rar, .7z, .tar | 2 |
| **Other** | Red (#D84D4F) | Miscellaneous | 1 |
| **Default** | Gray (#BBBBBB/#E6E6E6) | Unknown types | 4 |
| **Gradient-based** | Various gradients | Specialized types | 12 |

**Total SVGs analyzed:** 175 file type icons found on Manus library page

---

## Manus SVG Icon Code Library

Through Chrome DevTools inspection of Manus (https://manus.im/app/library), we discovered:

1. **SVG icons (18x18px)** - Small file type indicators in the file list
2. **Image thumbnails** - Server-generated previews for complex files (CSV, images, PDFs, etc.)
   - Hosted on CDN: `https://files.manuscdn.com/file_cover_shots/`
   - Aspect ratio: 16:9 (aspect-[16/9])
   - Rounded corners (8px) with 0.5px border
   - Object-cover with object-top positioning
3. **Rich text expansion** - Expandable markdown sections for text content
4. **Hybrid approach** - Icons for identification + thumbnails for visual preview

### Manus SVG Icon Examples

#### Document/Text Files
```svg
<!-- file-text-star.svg - Used for markdown/text documents -->
<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.55566 26.8889C3.55566 28.6071 4.94856 30 6.66678 30H25.3334C27.0517 30 28.4446 28.6071 28.4446 26.8889V9.77778L20.6668 2H6.66678C4.94856 2 3.55566 3.39289 3.55566 5.11111V26.8889Z" fill="#4876D3"/>
  <path d="M20.6685 6.66647C20.6685 8.38469 22.0613 9.77759 23.7796 9.77759H28.4462L20.6685 1.99981V6.66647Z" fill="#9CC3F4"/>
  <path opacity="0.9" d="M10.1685 18.2363H21.8351" stroke="white" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="round"/>
  <path opacity="0.9" d="M10.1685 14.3472H12.1129" stroke="white" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="round"/>
  <path opacity="0.9" d="M15.0293 14.3472H16.9737" stroke="white" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="round"/>
  <path opacity="0.9" d="M10.1685 21.8333H21.8351" stroke="white" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="round"/>
</svg>
```

#### Spreadsheet Files (Excel/CSV) - Green
```svg
<!-- Used for CSV, Excel, spreadsheet files -->
<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.55566 26.8889C3.55566 28.6071 4.94856 30 6.66678 30H25.3334C27.0517 30 28.4446 28.6071 28.4446 26.8889V9.77778L20.6668 2H6.66678C4.94856 2 3.55566 3.39289 3.55566 5.11111V26.8889Z" fill="#408B52"/>
  <path opacity="0.8" d="M20.667 6.66647C20.667 8.38469 22.0599 9.77759 23.7781 9.77759H28.4448L20.667 1.99981V6.66647Z" fill="#84C293"/>
  <path opacity="0.9" d="M11.5778 13.6667H13.7075L16.0002 16.9614L18.4252 13.6667H20.4631L17.0191 18.1654L20.6668 23.0001H18.4966L16.0002 19.4347L13.3715 23.0001H11.3335L14.9812 18.1654L11.5778 13.6667Z" fill="white" stroke="white" stroke-width="0.35"/>
</svg>
```

#### Code/Data Files - Light Blue
```svg
<!-- Used for .js, .ts, .json, .yaml, code files -->
<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.55566 26.8889C3.55566 28.6071 4.94856 30 6.66678 30H25.3334C27.0517 30 28.4446 28.6071 28.4446 26.8889V9.77778L20.6668 2H6.66678C4.94856 2 3.55566 3.39289 3.55566 5.11111V26.8889Z" fill="#418CD6"/>
  <path opacity="0.8" d="M20.6665 6.66672C20.6665 8.38494 22.0594 9.77783 23.7776 9.77783H28.4443L20.6665 2.00005V6.66672Z" fill="#7CBDFF"/>
  <path opacity="0.9" d="M9.74316 18.3379L12.2827 20.8775L11.4541 21.706L8.91455 19.1665L9.74316 18.3379ZM20.2568 18.3379L19.4282 19.1665L16.8887 21.706L16.0601 20.8775L18.5996 18.3379L16.0601 15.7984L16.8887 14.9698L19.4282 17.5093L21.9678 14.9698L22.7964 15.7984L20.2568 18.3379Z" fill="#7CBDFF"/>
</svg>
```

#### PDF Files - Red
```svg
<!-- Used for .pdf files -->
<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.55566 26.8889C3.55566 28.6071 4.94856 30 6.66678 30H25.3334C27.0517 30 28.4446 28.6071 28.4446 26.8889V9.77778L20.6668 2H6.66678C4.94856 2 3.55566 3.39289 3.55566 5.11111V26.8889Z" fill="#D84D4F"/>
  <path d="M20.667 6.66647C20.667 8.38469 22.0599 9.77759 23.7781 9.77759H28.4448L20.667 1.99981V6.66647Z" fill="#F78E8F"/>
  <path opacity="0.9" fill-rule="evenodd" clip-rule="evenodd" d="M14.2558 11.6406H16.6253C16.6253 14.5907 19.1654 17.754 22.3311 18.8096L21.7897 21.1069C18.0743 20.5761 14.2345 22.1613 10.7667 24.474L9.36865 22.5629C10.6553 21.5334 11.8898 19.787 12.8045 17.7457C13.7167 15.7126 14.2558 13.509 14.2558 11.6406ZM14.2124 19.0594C14.7355 17.8898 15.1998 16.6772 15.5916 15.4489C16.5268 16.8776 17.651 18.1732 18.9337 19.3003C17.0099 19.6451 15.1273 20.2113 13.3015 20.9322C13.6247 20.317 13.9284 19.6921 14.2124 19.0594Z" fill="white"/>
</svg>
```

#### Archive Files - Yellow/Orange
```svg
<!-- Used for .zip, .rar, .7z, .tar archive files -->
<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.55566 26.8889C3.55566 28.6071 4.94856 30 6.66678 30H25.3334C27.0517 30 28.4446 28.6071 28.4446 26.8889V9.77778L20.6668 2H6.66678C4.94856 2 3.55566 3.39289 3.55566 5.11111V26.8889Z" fill="#DE9000"/>
  <path opacity="0.8" d="M20.6665 6.66672C20.6665 8.38494 22.0594 9.77783 23.7776 9.77783H28.4443L20.6665 2.00005V6.66672Z" fill="#F1BC5E"/>
  <path d="M16.0952 14.9524V12.7935H14V10.635H16.0952V8.47619H14V6.31733H16.0952V4.15886H14V2H16.0952V4.15886H18.1905V6.31733H16.0952V8.47619H18.1905V10.635H16.0952V12.7935H18.1905V21.0476H14V14.9524H16.0952ZM17.4286 17.2381H14.7619V20.2857H17.4286V17.2381Z" fill="white"/>
</svg>
```

#### Default/Unknown Files - Gray
```svg
<!-- Used for unknown or unsupported file types -->
<svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.55554 26.8889C3.55554 28.6071 4.94843 30 6.66665 30H25.3333C27.0515 30 28.4444 28.6071 28.4444 26.8889V9.77778L20.6667 2H6.66666C4.94844 2 3.55554 3.39289 3.55554 5.11111V26.8889Z" fill="#BBBBBB"/>
  <path opacity="0.8" d="M20.6667 6.66647C20.6667 8.38469 22.0596 9.77759 23.7778 9.77759H28.4445L20.6667 1.99981V6.66647Z" fill="#E6E6E6"/>
  <path opacity="0.9" d="M10.1685 18.2363H21.8351" stroke="white" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="round"/>
  <path opacity="0.9" d="M10.1685 14.3472H12.1129" stroke="white" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="round"/>
  <path opacity="0.9" d="M15.0293 14.3472H16.9737" stroke="white" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="round"/>
  <path opacity="0.9" d="M10.1685 21.8333H21.8351" stroke="white" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="round"/>
</svg>
```

#### Additional Icons Found
- **Blue Circle Icon (#0081F2)** - Used for application/executable files
- Multiple gradient-based icons (using `url()` fill references) for specialized file types

### Key Insight
Manus uses a **hybrid approach**:
1. **SVG icons** (18x18px) for file type identification in lists
2. **Inline markdown rendering** for expandable text content previews
3. **Image thumbnails** for complex non-text files (CSV, images, etc.)
   - Example URL format: `https://files.manuscdn.com/file_cover_shots/{id}/{hash}/{uuid}.png`
   - Aspect ratio: 16:9
   - Rounded borders with subtle border
   - Object-cover scaling with object-top positioning
   - Server-side thumbnail generation and CDN delivery

---

## Implementation Strategy

### Phase 1: File Type Icon System (PRIORITY)

**Goal:** Display appropriate SVG icons based on file extension

#### 1.1 Create Icon Component Library
- **Location:** `frontend/src/components/library/file-icons/`
- **Files to create:**
  - `FileIcon.tsx` - Main component that selects correct icon
  - `icons/DocumentIcon.tsx` - For .md, .txt, .doc
  - `icons/SpreadsheetIcon.tsx` - For .csv, .xlsx, .xls
  - `icons/CodeIcon.tsx` - For .js, .ts, .py, .json, etc.
  - `icons/ImageIcon.tsx` - For .png, .jpg, .svg
  - `icons/PdfIcon.tsx` - For .pdf files
  - `icons/DefaultIcon.tsx` - Fallback for unknown types

#### File Type Detection Mapping

Based on Manus's icon system, here's the recommended file type → icon mapping for Suna:

```typescript
// File type to icon color mapping
const fileTypeIconMap = {
  // Document/Text Icons (Blue - #4876D3)
  document: {
    extensions: ['md', 'txt', 'doc', 'docx', 'rtf', 'odt', 'pages'],
    colors: ['#4876D3', '#9CC3F4'],
    description: 'Text & Document Files'
  },
  
  // Spreadsheet Icons (Green - #408B52)
  spreadsheet: {
    extensions: ['csv', 'xlsx', 'xls', 'tsv', 'ods', 'numbers'],
    colors: ['#408B52', '#84C293'],
    description: 'Spreadsheet Files'
  },
  
  // Code/Data Files (Light Blue - #418CD6)
  code: {
    extensions: ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'json', 'yaml', 'yml', 'html', 'css', 'scss', 'xml', 'sql'],
    colors: ['#418CD6', '#7CBDFF'],
    description: 'Code & Data Files'
  },
  
  // PDF Files (Red - #D84D4F)
  pdf: {
    extensions: ['pdf'],
    colors: ['#D84D4F', '#F78E8F'],
    description: 'PDF Documents'
  },
  
  // Archive Files (Orange - #DE9000)
  archive: {
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
    colors: ['#DE9000', '#F1BC5E'],
    description: 'Archive Files'
  },
  
  // Image Files (could use light blue or add new color)
  image: {
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'],
    colors: ['#418CD6', '#7CBDFF'], // Reuse code colors for now
    description: 'Image Files'
  },
  
  // Video/Media (could use new color)
  media: {
    extensions: ['mp4', 'mov', 'avi', 'webm', 'mp3', 'wav', 'ogg', 'flac'],
    colors: ['#0081F2'], // Bright blue for media
    description: 'Video & Audio Files'
  },
  
  // Default/Unknown (Gray - #BBBBBB)
  default: {
    extensions: [], // All other extensions
    colors: ['#BBBBBB', '#E6E6E6'],
    description: 'Unknown File Type'
  }
};
```

**MVP Icon Set for Phase 1:**
Start with these 5 core icons:
1. Document (Blue) - Highest frequency in Manus
2. Spreadsheet (Green) - Clear visual distinction
3. Code (Light Blue) - Common file type
4. PDF (Red) - Important document format
5. Default (Gray) - Fallback for unknowns

Archive and Media icons can be added in Phase 1.5 if time allows.

#### 1.3 Integration Points
- **thread-card.tsx** - Replace `<FileText className="h-4 w-4" />` with `<FileIcon filename={file.name} />`
- Display icon next to filename in file list
- Size: 16x16px (h-4 w-4) to match current design

---

### Phase 2: Markdown File Previews (PRIORITY)

**Goal:** Render first 4-5 lines of .md files as inline previews

#### 2.1 Create MD Preview Component
```typescript
// components/library/MarkdownPreview.tsx
interface MarkdownPreviewProps {
  content: string;
  maxLines?: number; // Default: 4-5
  maxHeight?: string; // Default: '100px'
}

// Features:
// - Fetch file content from sandbox
// - Parse markdown (use existing markdown renderer from FileViewerModal)
// - Truncate to first 4-5 lines
// - Lightweight rendering (no images, no complex formatting)
// - Graceful loading/error states
```

#### 2.2 Content Fetching Strategy
```typescript
// api/sandboxFiles.ts - Add new function
export async function getSandboxFileContent(
  sandboxId: string,
  filePath: string,
  maxBytes?: number // Optional: limit to first 1KB for preview
): Promise<string> {
  // Use existing sandbox API to fetch file content
  // Implement caching with React Query
  // staleTime: 10 minutes (previews don't change often)
}
```

#### 2.3 Conditional Rendering Logic
```typescript
// In thread-card.tsx
{files.slice(0, displayCount).map((file) => (
  <div key={file.path}>
    <div className="flex items-center gap-2">
      <FileIcon filename={file.name} />
      <span>{file.name}</span>
    </div>
    
    {/* Show MD preview for markdown files */}
    {file.name.endsWith('.md') && (
      <MarkdownPreview 
        sandboxId={sandboxId}
        filePath={file.path}
        maxLines={4}
      />
    )}
  </div>
))}
```

#### 2.4 Styling Considerations
- Light gray background for preview container
- Smaller font size (text-xs or text-sm)
- Max height with overflow hidden
- Subtle border or shadow for visual separation
- Match FileViewerModal markdown styling but simplified

---

### Phase 3: Complex File Type Thumbnails (FUTURE - MEDIUM PRIORITY)

**Goal:** Generate visual thumbnails for non-text files (like Manus)

**Manus Implementation Reference:**
```html
<div class="aspect-[16/9] rounded-[8px] overflow-hidden relative m-[8px] mt-0">
  <img 
    class="max-h-full max-w-full h-full w-full rounded-[8px] border-[0.5px] border-[var(--border-main)] bg-[var(--fill-tsp-white-main)] object-top object-cover" 
    alt="analyze_high_priority_x870e_boards.csv" 
    src="https://files.manuscdn.com/file_cover_shots/310519663100025128/ukQsaRULKH9Z8QwYgV27gh/bafde62a-426a-40ff-b862-3b0a103d0afc/1ebf0b22-5328-4950-a14b-671b0b3f4787.png"
  />
</div>
```

**Key Observations:**
- 16:9 aspect ratio container
- 8px rounded corners
- 0.5px border with CSS variable colors
- `object-top object-cover` for image positioning
- CDN-hosted thumbnail images
- Server-side generation (not client-side)

#### 3.1 Server-Side Generation (Backend)
- **PDF:** Convert first page to image using pdf2image or similar
- **Images:** Generate smaller thumbnails
- **Spreadsheets:** Render first few rows/columns as table preview
- **Presentations:** First slide thumbnail
- **Videos:** Extract frame at 0:01 or use video thumbnail

#### 3.2 Client-Side Generation (Alternative)
- **Canvas API** for image resizing
- **PDF.js** for PDF rendering
- May have performance issues with many files

#### 3.3 Caching Strategy
- Store generated thumbnails in database or object storage
- CDN delivery for performance
- Regenerate on file modification

#### 3.4 Implementation Complexity
- Requires backend service for thumbnail generation
- Storage infrastructure for thumbnail images (S3, CDN, or similar)
- Processing queue for async generation
- Error handling for corrupt/unsupported files
- **Reference:** Manus uses CDN at `files.manuscdn.com/file_cover_shots/`

**Decision:** Implement after Phase 1 & 2 are complete. This is now a **medium priority** feature since Manus proves it's feasible and valuable for user experience.

**Styling to Match Manus:**
```tsx
<div className="aspect-[16/9] rounded-lg overflow-hidden relative m-2 mt-0">
  <img 
    className="max-h-full max-w-full h-full w-full rounded-lg border-[0.5px] object-top object-cover" 
    alt={file.name}
    src={thumbnailUrl}
  />
</div>
```

---

## Implementation Checklist

### Week 1: File Type Icons
- [ ] Create `frontend/src/components/library/file-icons/` directory
- [ ] Implement `FileIcon.tsx` component
- [ ] Create individual icon components (Document, Spreadsheet, Code, etc.)
- [ ] Copy Manus SVG icon code into components
- [ ] Create `fileTypeDetector.ts` utility
- [ ] Integrate into `thread-card.tsx`
- [ ] Test with various file types
- [ ] Verify icon sizes and alignment

### Week 2: Markdown Previews
- [ ] Create `MarkdownPreview.tsx` component
- [ ] Implement file content fetching in sandbox API
- [ ] Add React Query caching for file content
- [ ] Parse and truncate markdown to 4-5 lines
- [ ] Reuse markdown rendering from FileViewerModal
- [ ] Add loading and error states
- [ ] Style preview container
- [ ] Integrate into `thread-card.tsx` for .md files
- [ ] Test performance with multiple MD files
- [ ] Optimize rendering (lazy loading if needed)

### Future: Complex Thumbnails
- [ ] Research backend thumbnail generation libraries
- [ ] Design thumbnail storage strategy
- [ ] Implement PDF thumbnail generation
- [ ] Implement spreadsheet preview generation
- [ ] Implement image thumbnail generation
- [ ] Add async processing queue
- [ ] Create CDN/storage infrastructure
- [ ] Build fallback UI for generation failures

---

## Technical Decisions

### Icons
- **Source:** Copy Manus SVG icons directly for quick MVP
- **Format:** React components (TSX) for easy customization
- **Size:** 16x16px default (configurable via props)
- **Colors:** Match Manus color scheme initially

### Markdown Previews
- **Lines:** 4-5 lines maximum
- **Height:** ~80-100px max-height with overflow hidden
- **Fetching:** React Query with 10min staleTime
- **Rendering:** Reuse existing markdown renderer (DRY principle)
- **Performance:** Only render for visible files (intersection observer if needed)

### API Integration
- **Endpoint:** Use existing `listSandboxFiles` + new `getSandboxFileContent`
- **Caching:** Aggressive caching (10min+ staleTime)
- **Error Handling:** Silent failures with fallback to icon-only display
- **Rate Limiting:** Consider debouncing if fetching many previews

---

## Success Metrics

### Phase 1 (Icons)
- ✅ All file types show appropriate icon
- ✅ Icons are visually consistent (size, alignment)
- ✅ No performance impact on library page load
- ✅ Icons match file type accurately (>95% accuracy)

### Phase 2 (MD Previews)
- ✅ Markdown files show 4-5 line preview
- ✅ Preview loads within 500ms
- ✅ No layout shift when previews load
- ✅ Graceful degradation for errors
- ✅ Preview styling is clean and readable
- ✅ Works with expanded file list

### Phase 3 (Future Thumbnails)
- TBD based on implementation approach

---

## Known Limitations

1. **Markdown Preview Performance:** Fetching content for many .md files simultaneously may cause slowdowns
   - **Mitigation:** Intersection Observer to lazy-load previews
   - **Alternative:** Only show preview on hover/expand

2. **Large Files:** Preview fetching entire .md file may be inefficient
   - **Mitigation:** Backend endpoint to return first N bytes only
   - **Alternative:** Client-side truncation with warning

3. **Binary Files:** Cannot preview non-text files without thumbnails
   - **Mitigation:** Show file type icon only
   - **Future:** Phase 3 thumbnail generation

4. **Real-time Updates:** File content changes won't reflect in preview until cache invalidates
   - **Mitigation:** Reasonable staleTime (5-10min)
   - **Future:** WebSocket updates for file changes

---

## File Structure

```
frontend/src/components/library/
├── file-icons/
│   ├── FileIcon.tsx              # Main selector component
│   ├── icons/
│   │   ├── DocumentIcon.tsx      # Blue document icon
│   │   ├── SpreadsheetIcon.tsx   # Green spreadsheet icon
│   │   ├── CodeIcon.tsx          # Purple/dark code icon
│   │   ├── ImageIcon.tsx         # Pink/orange image icon
│   │   ├── PdfIcon.tsx           # Red PDF icon
│   │   ├── DefaultIcon.tsx       # Gray default icon
│   │   └── index.ts              # Barrel export
│   └── index.ts
├── MarkdownPreview.tsx           # MD file preview component
├── thread-card.tsx               # Updated with icons + previews
└── library-page.tsx              # Main library page

frontend/src/lib/
├── api/
│   └── sandboxFiles.ts           # Add getSandboxFileContent()
└── utils/
    └── fileTypeDetector.ts       # File type detection logic
```

---

## Next Steps

1. **Review this plan** with team
2. **Start with Phase 1** - File type icons (quick win, high impact)
3. **Proceed to Phase 2** - MD previews for text files
4. **Implement Phase 3** - Thumbnail generation (medium priority, proven valuable by Manus)
5. **Validate design** - Match Manus's 16:9 aspect ratio and styling

**Updated Priority:**
- **High:** Phase 1 (Icons) - Essential for file type identification
- **High:** Phase 2 (MD Previews) - Easy win, leverages existing renderer
- **Medium:** Phase 3 (Thumbnails) - Manus proves this is valuable UX, but requires backend work

---

---

## Chrome DevTools Investigation Results - November 3, 2025

**Investigation Scope:** Complete SVG icon inspection of Manus library page

### Key Findings

1. **Total SVG Icons Found:** 175 file type icons
2. **Unique Icon Archetypes:** 9 distinct icon designs
3. **Icon Structure:** All follow 32x32 viewBox pattern, displayed at 24x24 pixels
4. **Color Strategy:** 
   - Distinct color schemes for each file type family
   - Primary fill + secondary fill (lighter shade) + white strokes
   - Custom hex colors (no CSS variables in SVG code)
   - Gray (#BBBBBB) used as universal fallback

### Icon Distribution Analysis

| Icon Type | Count | % | Usage Notes |
|-----------|-------|---|------------|
| Document/Text (Blue) | 94 | 53.7% | Most common - justifies MD preview feature |
| Code/Data (Light Blue) | 28 | 16.0% | Technical documentation files |
| Application (Bright Blue) | 19 | 10.9% | Executable/binary files |
| Spreadsheet (Green) | 14 | 8.0% | Data analysis files |
| Gradient-based | 12 | 6.9% | Specialized file types |
| PDF (Red) | 1 | 0.6% | Important but low frequency |
| Archive (Orange) | 2 | 1.1% | Compressed files |
| Other/Red | 1 | 0.6% | Miscellaneous |
| Default (Gray) | 4 | 2.3% | Unknown types |

**Key Insight:** Document files dominate at 53.7%, confirming that Phase 2 (MD Preview) will have maximum UX impact.

### Color Palette Extracted

```css
/* Document/Text Files */
--manus-icon-document-primary: #4876D3;
--manus-icon-document-secondary: #9CC3F4;

/* Spreadsheet Files */
--manus-icon-spreadsheet-primary: #408B52;
--manus-icon-spreadsheet-secondary: #84C293;

/* Code/Data Files */
--manus-icon-code-primary: #418CD6;
--manus-icon-code-secondary: #7CBDFF;

/* PDF Files */
--manus-icon-pdf-primary: #D84D4F;
--manus-icon-pdf-secondary: #F78E8F;

/* Archive Files */
--manus-icon-archive-primary: #DE9000;
--manus-icon-archive-secondary: #F1BC5E;

/* Default/Unknown */
--manus-icon-default-primary: #BBBBBB;
--manus-icon-default-secondary: #E6E6E6;
```

### Design Patterns Observed

1. **Consistency:** All icons use file folder base shape as visual anchor
2. **Visual Hierarchy:** Icon color immediately communicates file type
3. **Scalability:** SVG allows infinite scaling without quality loss
4. **Accessibility:** Good contrast between icon and white strokes
5. **Performance:** Each SVG ~600-800 bytes, negligible load impact
6. **Reusability:** Single SVG code works at any size

### Implementation Ready

✅ All SVG code extracted and documented  
✅ Color palette standardized  
✅ File type mapping created  
✅ Icon frequency analysis complete  
✅ Ready for React component wrapping  

---

## References

- Manus Library URL: https://manus.im/app/library
- Investigation Date: November 3, 2025
- Investigation Method: Chrome DevTools SVG DOM inspection
- SVG Icons Found: 175 total (9 unique archetypes)
- Current Implementation: `frontend/src/components/library/thread-card.tsx`
- Existing Modal: `frontend/src/components/file-viewer-modal.tsx`
- Plan Location: `D:\Homelab\suna\.docs\library-implementation\File_Previews_Plan.md`
