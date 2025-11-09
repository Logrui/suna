---
applyTo: "**/*.md,docs/**,*.docs/**,.docs/**"
---

# Documentation Writing Instructions - Hard Limit 3 Markdown Files

## Critical Constraint: Maximum 3 Markdown Files Per Response

**This is a hard limit. Do not exceed it under any circumstances.**

### When Creating Documentation

1. **Maximum 3 files** - Never create more than 3 `.md` files in a single response
2. **Consolidate First** - If you're approaching 3 files, consolidate content instead of adding a new file
3. **Clear Purpose** - Each file must serve a distinct, non-overlapping purpose
4. **Descriptive Names** - Use filenames that clearly indicate the file's purpose
   - ✅ Good: `QUICK_REFERENCE.md`, `COMPLETE_GUIDE.md`, `TROUBLESHOOTING.md`
   - ❌ Bad: `info.md`, `doc1.md`, `documentation.md`

### File Organization Principles

- **Avoid Redundancy** - Never duplicate information across files
- **Eliminate Overlap** - If 2 files cover the same topic, merge them
- **Clear Scope** - Each file should have one clear purpose:
  - Overview/Quick Start (beginner-friendly, 2-5 min read)
  - Complete Guide (full technical details, 15-30 min read)
  - Troubleshooting/Reference (specific problems, lookup-friendly)

### When Consolidating Documentation

1. **Identify Overlap** - Check if content is redundant
2. **Merge Strategy** - Combine into main file, use sections
3. **Cross-Reference** - Link between files with clear section headers
4. **Verify Coverage** - Ensure all critical info is preserved

### Update Workflow

When asked to update documentation:
- **Check Total Count** - Count existing `.md` files first
- **Plan Consolidation** - If at limit, which files can be merged?
- **Notify User** - Explain consolidation strategy before implementing
- **Keep Total ≤ 3** - Never increase file count if already at 3

### Examples

**Scenario 1: Adding new documentation when at 3 files**
- ❌ Create a 4th file
- ✅ Consolidate existing files, then add new content to appropriate file

**Scenario 2: Complex topic needing 4 files to explain**
- ❌ Create 4 separate files
- ✅ Create 3 files with clear sections:
  - File 1: Quick start + overview
  - File 2: Technical details (consolidated)
  - File 3: Troubleshooting + examples

**Scenario 3: User says "create detailed documentation"**
- ❌ Assume "detailed" means more files
- ✅ Keep to 3 files, make each one thorough within that constraint

## Location Strategy

- **Project Root Level** - High-value, frequently accessed documentation (README, CONTRIBUTING)
- **`.docs/` Directory** - Setup guides, architecture docs, detailed references
- **`.github/` Directory** - Technical instructions, CI/CD documentation
- **Inline Comments** - Complex code logic (prefer code comments over separate docs)

## Quality Over Quantity

Remember: **3 well-organized files with clear sections > 8 scattered files with overlap**

Focus on:
- Clear structure with headings
- Good cross-references
- Specific, actionable content
- Reader-friendly organization
