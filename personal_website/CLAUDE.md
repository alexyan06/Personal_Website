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

Single-page portfolio built with React 19 + TypeScript + Vite. Deployed to Vercel.

**Layout:** Desktop uses `lg:flex` with a fixed Sidebar + Profile panel alongside scrollable main content. Mobile collapses to a FloatingMenu for navigation.

**Data layer:** All portfolio content (projects, experience, tools, social links) lives in `src/constants/index.tsx`. Types for these structures are in `src/types/index.ts`. To add/edit portfolio content, start here.

**Styling:** Tailwind CSS 4 via the Vite plugin. Color system uses CSS custom properties with oklch color space defined in `src/index.css`. Components use the `cn()` utility from `src/lib/utils.ts` (clsx + tailwind-merge). Animations use the Motion library; reusable animation configs are in `src/lib/animation.ts`.

**UI components:** shadcn/ui components live in `src/components/ui/`. Configured via `components.json` with `@/` path alias resolving to `src/`.

**Contact form:** Built with React Hook Form + Zod validation (`src/components/Contact.tsx`).

**Analytics:** `@vercel/analytics` and `@vercel/speed-insights` are wired into `src/main.tsx`.

## TypeScript

Strict mode is on (`strict`, `noUnusedLocals`, `noUnusedParameters`). Use `@/` for imports (e.g., `import { cn } from "@/lib/utils"`). Target is ES2022.
