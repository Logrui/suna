# Portkit: Research & Analysis Report

**Feature**: [Feature Name]
**Upstream Ref**: [Git Hash/Tag]
**Date**: [Date]

## 1. Feature Subgraph (The "Blast Radius")
<!-- Extracted from codemap_report.md -->
### Entry Points
*   `path/to/entry.ts`

### Dependencies
*   **Internal**: `path/to/utils.ts`
*   **External**: `package.json` dependencies

## 2. Feature Diff (Semantic)
<!-- Extracted from feature_diff_report.md -->
*   **Upstream Change**: `Button.tsx` added `isLoading` prop.
*   **Local Divergence**: `Button.tsx` has custom `variant` prop.

## 3. Specifications & Limitations
<!-- Extracted from safety_check_report.md -->
*   **Auth**: Requires Supabase Auth (Upstream) vs Local Auth (Us).
*   **Blockers**: `next-intl` import in `Layout.tsx`.
*   **Registry Check**: `routes.ts` is protected by `AdminPanel` feature.

## 4. Intersection List (The Danger Zone)
| File | Status | Owner | Action Required |
| :--- | :--- | :--- | :--- |
| `Button.tsx` | 🔴 CONFLICT | `CoreUI` | **Morph** |
| `NewPage.tsx` | 🟢 SAFE | - | Copy |
