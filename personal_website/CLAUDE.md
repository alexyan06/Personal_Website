# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type check (tsc -b) then production build
npm run lint      # ESLint on all TypeScript/TSX files
npm run preview   # Preview production build locally
```

## Architecture

Single-page portfolio built with React 19 + TypeScript + Vite 7. Deployed to Vercel (alexyan.dev). Client-rendered; `index.html` only has the root div plus an inline script that sets the `.dark` class before first paint to avoid a theme flash.

**Layout:** `src/App.tsx` stacks `Hero` and `ExperienceProjects` in a centered `max-w-4xl` column, with a footer. `ThemeToggle`, `Cursor` (a custom pointer) and `BackgroundOrbs` (animated blurred blobs) are fixed overlays. There is no router, sidebar or mobile menu.

**Components (`src/components/`):** `Hero` (photo, name, bio, social links), `ExperienceProjects` (two-column experience and project lists; it also renders `Currently`, a collapsible "currently learning" list), `ThemeToggle`, `Cursor`, `BackgroundOrbs`.

**Data layer:** All portfolio content (projects, experience, `currently`) lives in `src/constants/index.tsx`. Types are in `src/types/index.ts`. Edit content there, not in components.

**Styling:** Tailwind CSS 4 via `@tailwindcss/vite`. Color tokens are hex CSS custom properties in `src/index.css` (`:root` for light and `.dark` for dark), exposed to Tailwind through `@theme inline`. Dark mode is class-based (`@custom-variant dark`). Fonts are Playfair Display and Inter, loaded from Google Fonts in `index.html`. `src/index.css` also sets `cursor: none` globally for the custom cursor.

**Motion:** The `motion` library (`motion/react`). Animation variants are defined inline in each component; there is no shared animation module.

**Analytics:** `@vercel/analytics` and `@vercel/speed-insights` are mounted in `src/main.tsx`.

**Not present, despite installed packages:** there are no shadcn/ui components, no `src/lib/` (`cn()` helper) and no contact form. `react-hook-form`, `zod`, `@hookform/resolvers` and `@radix-ui/*` are currently unused. `components.json` is leftover shadcn config.

**Assets:** `public/images/` holds the profile photo, project screenshots and the resume (`Alex_Yan_Resume.pdf`, linked from `Hero`).

## Redesign

A visual redesign is in progress on the `redesign` branch. Design skills are in `.agents/skills/` (installed with `npx skills`, pinned in `skills-lock.json`) and symlinked into `.claude/skills/`. `frontend-design` comes from the `example-skills` plugin. Set the design direction with `frontend-design` before using the `better-*` skills, which keep whatever conventions the project already has.

## TypeScript

Strict mode is on (`strict`, `noUnusedLocals`, `noUnusedParameters`). Use `@/` for imports (resolves to `src/`). Target is ES2022.
