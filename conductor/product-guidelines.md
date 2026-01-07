# Product Guidelines

This document defines the visual, user experience, and technical standards for this soft fork of Kortix.

## 1. Visual & UX Design Philosophy
The primary goal is strict **Upstream Alignment** with the native Suna Kortix design patterns. Interfaces must feel professional, high-density, and "premium."

### Core Principles: "The Rich Aesthetic"
Kortix avoids the generic "flat" SaaS look by layering textures and using high-fidelity color spaces.

1.  **High-Density Premium**: Designed as an AI "Workplace." Information density is high, favoring `text-xs` or `text-sm` for administrative and secondary UI to keep the focus on the workflow.
2.  **Layered Depth**:
    *   **Layer 0 (Background)**: Sub-tle grid patterns (`bg-grid`) or gradients defined in OKLCH.
    *   **Layer 1 (Texture)**: A persistent film grain/noise overlay (`opacity: 0.05`) used with `mix-blend-mode: multiply`.
    *   **Layer 2 (Glassmorphism)**: Panes use `backdrop-blur-xl` and `bg-background/50` to create a translucent workspace feel.
3.  **Motion-First Architecture**:
    *   **Active States**: Use "Border Beams" (rotating conic gradients) for active loading or processing states.
    *   **Micro-animations**: Scale-down on click (`0.97`), layout transitions via `framer-motion`, and `animate-shiny-text` for highlight effects.

### Typography
- **Font Sans**: Roobert (`var(--font-roobert)`).
- **Font Mono**: Roobert Mono (`var(--font-roobert-mono)`) for code and technical data.
- **Styling**: Headings use `font-medium tracking-tighter text-balance`.

## 2. Technical Standards

### Frontend Stack
- **Framework**: Next.js 15 (App Router).
- **Styling**: Tailwind CSS v4.
- **Color System**: **MUST USE OKLCH**. Define tokens in `globals.css` variables.
- **Icons**: `lucide-react` (primary).

### Information Architecture
1.  **Collapsible Navigation**: Use the `SidebarLeft` pattern supporting expanded and icon-only states.
2.  **Command-First Workflow**: Support `Cmd+K` (Global Search) and `Cmd+J` (New Task) shortcuts.
3.  **View Hierarchy**: Maintain the domain split: `Chats`, `Workers`, `Workflows`, `Knowledge Base`.

## 3. Implementation Patterns

### The Premium Card
All surface elements should follow the Premium Card pattern to ensure consistency:

```tsx
<div className="relative group overflow-hidden rounded-2xl border border-border/50 bg-background/40 backdrop-blur-md p-6">
  {/* Layered texture overlay */}
  <div className="absolute inset-0 opacity-5 mix-blend-multiply pointer-events-none bg-[url('/noise.png')]" />
  {/* Content */}
  <div className="relative z-10">{children}</div>
</div>
```

## 4. Reference Documentation
For detailed implementation rules, refer to:
`d:\Homelab\suna\.\agent\rules\frontend-design-guidelines.md`

## 5. Development Workflow
- **Jujutsu ONLY:** Use `jj` for all version control (`jj describe -m "..."`).
- **Semantic Commits:** Use prefixes like `feat:`, `fix:`, `style:`.
- **Pre-deployment**: Run `npx lint` and verify Docker builds before pushing.

