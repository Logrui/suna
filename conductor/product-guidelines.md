# Product Guidelines

This document defines the visual, user experience, and technical standards for this soft fork of Kortix.

## 1. Visual & UX Design Philosophy
The primary goal is strict **Upstream Alignment** with the native Suna Kortix design patterns. All frontend work must adhere to the core principles of a premium, "rich" aesthetic that avoids generic, flat designs.

### Core Principles
- **Premium Feel**: Use purposeful textures (grain/noise overlays), subtle gradients, and glassmorphism.
- **Motion-First**: Utilize `framer-motion` for complex interactions and CSS animations for simple states to make the interface feel "alive."
- **Typography-Driven**:
  - **Font Sans**: Roobert (`var(--font-roobert)`)
  - **Font Mono**: Roobert Mono (`var(--font-roobert-mono)`)
  - **Styling**: Headings should use `font-medium tracking-tighter text-balance`. Secondary text should use `text-muted-foreground`.
- **Theme-Aware**: Seamless support for Dark and Light modes using OKLCH color spaces.

## 2. Technical Standards

### Frontend Stack
- **Framework**: Next.js 15 (App Router).
- **Language**: TypeScript (Strict Mode).
- **Styling**: Tailwind CSS v4 (Utility-first, avoiding CSS Modules).
- **UI Library**: ShadCN UI (Radix Primitives + Tailwind).
- **Icons**: `lucide-react` (primary), `react-icons` (fallback).

### Component Development
- **Server Components**: Default to Server Components; use `"use client"` only when necessary for state or event listeners.
- **ShadCN**: Favor composition over direct modification of `components/ui` primitives.
- **Color System**: All color definitions **MUST USE OKLCH**. Use CSS variables defined in `globals.css`.
- **Patterns**: Use `backdrop-blur` for glassmorphism and background noise images for depth.

## 3. Reference Documentation
For detailed implementation rules, always refer to the primary frontend guidelines:
`d:\Homelab\suna\.\agent\rules\frontend-design-guidelines.md`

## 4. Development Workflow Reminders
- **Jujutsu ONLY:** Use `jj` for all version control. Do not use `git commit` or `git add`.
- **Semantic Commits:** All changes must be described using `jj describe -m` with semantic prefixes (e.g., `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`).

