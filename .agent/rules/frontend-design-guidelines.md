---
trigger: glob
globs: *.ts, *tsx, *.js
---

# Kortix (Suna) Frontend Design Guidelines

## 1. Core Principles & Aesthetics

- **Premium Feel**: The UI must feel "rich" and "premium". Avoid flat, generic designs.
- **Rich Aesthetics**: Use purposeful texture (grain/noise overlays), subtle gradients, and glassmorphism.
- **Motion-First**: Interfaces should feel alive. Use `framer-motion` for complex interactions and native CSS animations for simple states.
- **Typography-Driven**: Use `text-balance` for headings. Rely on the `Roobert` font family for sans and `Roobert Mono` for code.
- **Theme-Aware**: All components must support Dark/Light modes seamlessly using OKLCH color spaces.

## 2. Tech Stack & Standards

- **Framework**: Next.js 15 (App Router).
- **Language**: TypeScript (Strict Mode).
- **Styling**:
  - **Tailwind CSS v4** (using `@theme inline` and CSS variables).
  - **Modules**: Avoid CSS Modules; prefer Tailwind utility classes.
  - **Global Styles**: Defined in `globals.css`.
- **UI Library**: ShadCN UI (Radix Primitives + Tailwind).
- **Icons**: `lucide-react` (primary), `react-icons` (fallback).
- **State**: React Hooks (`useState`, `useReducer`) + `nuqs` (URL state) or `zustand` (global).

## 3. Project Structure

- **App Router**: `src/app/` structure. Use Route Groups `(group)` to organize features without affecting URLs.
- **Components**:
  - `src/components/ui`: ShadCN primitives (Button, Card, Input).
  - `src/components/[feature]`: Feature-specific components (e.g., `src/components/workflows`).
- **Layouts**: Use `layout.tsx` for persistent UI (sidebars, providers).
- **Utilities**: Shared logic in `src/lib/utils.ts`.

## 4. Styling & Theming (Crucial)

### Color System

- **Format**: MUST USE **OKLCH** for all color definitions.
- **Variables**: Use CSS variables defined in `.root` and `.dark` blocks in `globals.css` (e.g., `--primary`, `--sidebar-bg`).
- **Tailwind v4**: Use the new `@theme inline` syntax in CSS or standard utility classes.

### Typography

- **Headings**: class `font-medium tracking-tighter text-balance`.
- **Body**: class `text-muted-foreground/relaxed` for readability.
- **Font Stack**:
  - Sans: `var(--font-roobert)`
  - Mono: `var(--font-roobert-mono)`

### Visual Patterns

- **Grain/Noise**: Use background images with mix-blend-modes (opacity ~0.4-0.6) to add depth.
- **Glassmorphism**: `backdrop-blur` with low-opacity backgrounds (`bg-background/80`).
- **Borders**: Subtle borders (`border-border`) often with `rounded-2xl` or `rounded-xl`.

## 5. Component Development

- **Naming**: PascalCase for files (`MyComponent.tsx`) and directories if they contain a single main component.
- **Props**: Define explicit interfaces. e.g. `interface ButtonProps extends React.ComponentProps<"button">`.
- **Server vs Client**:
  - Default to **Server Components**.
  - Add `"use client"` ONLY when state (`useState`, `useEffect`) or event listeners are needed.
- **ShadCN**:
  - Do NOT modify `components/ui` primitives unless strictly necessary.
  - Composition > Modification. Wrap primitives to create complex UI.

## 6. Motion & Animation

- **Library**: `framer-motion` is preferred for layout changes, drag-and-drop, and complex sequences.
- **CSS Animations**: Use `globals.css` defined animations for simple effects:
  - `animate-shimmer` (loading states)
  - `animate-shiny-text` (highlight effects)
  - `animate-accordion-down/up`
  - `animate-enter/exit`
- **Performance**: Use `will-change` sparingly. Prefer `transform` and `opacity` changes.

## 7. SEO & Metadata

- **Next.js Metadata**: Export `metadata` object in `page.tsx`.
- **JSON-LD**: Use `<script type="application/ld+json">` for structured data (Organization, Product, Breadcrumbs).
- **Tags**: Ensure descriptive `title`, `description`, and OpenGraph images (`/banner.png`) are present.

## 8. Best Practices

- **Do**:
  - Use `cn()` helper to merge Tailwind classes.
  - Use `text-muted-foreground` for secondary text instead of gray-500.
  - Lazy load heavy components with `next/dynamic` or `React.lazy`.
- **Don't**:
  - Hardcode hex colors (always use variables).
  - Use `z-index` arbitrarily (establish a stacking context system).
  - Create large "God Components" (split into smaller chunks).

## 9. Example: Premium Card Component

```tsx
import { cn } from "@/lib/utils"

export function PremiumCard({ className, children }: { className?: string, children: React.ReactNode }) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-border/50 bg-background/50 p-6 backdrop-blur-sm transition-all hover:border-border/80",
      className
    )}>
      {/* Grain Overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply" 
           style={{ backgroundImage: "url('/noise.png')" }} />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
