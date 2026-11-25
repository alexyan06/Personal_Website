# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type check (tsc -b) then production build
npm run lint      # ESLint on all TypeScript/TSX files
npm run preview   # Preview production build locally
npm run qa        # Headless walk of the whole site with screenshots and checks (see qa/README.md)
```

## Read first

- **`DESIGN.md`** is the design brief: what the world is, what each location looks like, the art rules. Read it before any design or build work.
- **`ENGINE.md`** is the implementation contract: routes, the scaling rule, transitions, components, the accessibility floor and the `data-*` attributes the QA harness reads.
- **`qa/README.md`** explains the headless harness (`npm run qa`). The owner tests by hand in the browser and has asked not to have the harness run after every change: run it only when asked, or for a change that is risky to check by eye.

## Architecture

The site is a zoomable pixel-art world: a title screen, an overworld island with six locations (About, Experience, Projects, Skills, Learning, Misc), a room behind each location, and objects in each room that open dialog boxes. React 19 + TypeScript + Vite 7, client-rendered, deployed to Vercel (alexyan.dev). There is no canvas and no router library: each scene is a picture laid over a 320x180 grid of scene units and moved with CSS transforms, and routing is the URL hash.

**Routes (`src/world/routes.ts`, `src/world/useRoute.ts`):** `#/` is the title screen, then `#/world`, `#/<room>`, `#/<room>/<item>` (a room with a dialog open) and `#/list`. Unknown routes are replaced, never pushed. Change the route only through `navigate()`.

**Data flow:** content lives in `src/constants/index.tsx` (types in `src/types/index.ts`). Art lives in `art/approved/`: `hd/<scene>.webp` (1376x768 cut-outs with transparency, scaled smoothly), `hd/backdrops.json` with the sea and grass tiles that cover the whole view behind a scene, `hd/mascot.webp` and `mascot.json` (the character in the cottage), and `<scene>.regions.json`, the click boxes measured in scene units. `src/world/assets.ts` imports both, and `src/world/scenes.ts` joins content and regions into scenes with hotspots. Edit content in `src/constants`, not in components. A hotspot whose region is missing from the art is dropped with a console error.

**Components (`src/components/`):** `App.tsx` picks the world or the list view and handles Escape and the tab title. `World` decides which scenes are mounted and runs the camera moves. `Stage` is the 320x180 stage, drawn at a whole number of device pixels per scene pixel. `SceneView` draws one scene: art, labels, hotspots. Also `Hotspot`, `TitleScreen`, `Dialog`, `Hud` (the status bar and breadcrumb), `Ground` (the tiled sea or grass, with the wave animation), `Character` (the waving figure in the cottage), `Smoke` (the chimney smoke on the overworld and title screen), `MusicPlayer` (top-left corner), `ListView` (`#/list`, the plain accessible version of all content), `RotateGate` (shown to phones held upright), `PixelArrow` and `BodyText`.

**Engine (`src/world/`):** `pixels.ts` (device-pixel maths that keeps pixel type crisp), `useStageScale.ts` (the scaling rule), `camera.ts` and `transitions.ts` (where the camera is for each view and how it moves; uses `animate` from `motion`), `labels.ts` (where every label and hotspot goes, in device pixels), `preload.ts` (art and fonts ready before they show), `smoke.ts` (the chimney smoke's motion: every number to tune is in its `SMOKE` object), `music.ts` (the song list and the one audio element).

**Styling:** Tailwind CSS 4 via `@tailwindcss/vite`, scanning only `src/` and `index.html`. Tailwind's own palette is removed: the only colors are the NES ones, as `--color-nes-*` tokens in `src/index.css`. Shared pixel primitives (`.text-pixel`, `.text-body`, `.pixel-box` and others) are in `src/index.css`; each component's CSS is in `src/styles/`. Fonts are Press Start 2P (titles, labels, HUD) and VT323 (body text), from `@fontsource`.

**Pixel rules that are easy to break:**
- Anything over the art is sized in `--u` (one scene pixel). Do not use plain `px` there.
- Pixel type is sized in `--px` (Press Start 2P: font-size is a whole multiple of `8 * var(--px)`) or `--dot` (VT323: `25 * var(--dot)`). Other sizes come out blurred.
- Neither font has an arrow or triangle glyph. Use `PixelArrow` and `BodyText`, never a character from a fallback font.
- The art is smooth (never `image-rendering: pixelated`), but the UI over it is crisp pixel UI: no radius, blur, gradient or soft shadow on labels, the HUD, dialogs or the music player.
- Keep the `data-*` attributes listed in `ENGINE.md` section 9: the harness finds everything through them.

**Art pipeline (`art/`):** `art/scripts/generate.mjs` generates scenes with Gemini (`GEMINI_API_KEY` in `.env`, which is git-ignored) into `art/raw/` (scratch, git-ignored); the chosen raw picture is kept as `art/approved/<scene>.raw.jpg`. `art/scripts/hires.mjs` turns the raw pictures into what the site shows (`art/approved/hd/`): cut-outs, the sea and grass tiles, and per-scene edits such as painting the old picture frame out of the cottage. `art/scripts/mascot-cut.mjs` then `mascot.mjs` build the character's sprite sheet from a generated sheet of poses. `art/scripts/smoke.mjs` (run by `hires.mjs overworld`) paints the drawn chimney smoke out of the island and cuts it into `hd/smoke.webp` for the animation. WebP is encoded by Playwright's Chromium (`art/scripts/webp.mjs`); there is no image library beyond `jimp`. New art needs new region boxes (`art/scripts/regions.mjs`). The 320x180 PNGs in `art/approved/` are the earlier NES-palette versions and are no longer shown.

**Music (`music/`):** the player plays the MP3 files in `music/published/` (committed, on the live site: only music the owner may publish) and `music/private/` (git-ignored, this computer only). `src/world/music.ts` finds them at build time, so adding a file is enough; `playlist.json` in each folder sets order and names. See `music/README.md`. Sound starts on PRESS START or the visitor's first click, never before.

**QA (`qa/`):** `qa/walk.mjs` drives headless Chromium (Playwright) through seven viewport profiles, screenshots every stop into `qa/out/<run>/shots/` and writes `report.md`. `qa/out/` is git-ignored.

**Analytics:** `@vercel/analytics` and `@vercel/speed-insights` are mounted in `src/main.tsx`.

**Leftovers from the old site:** `react-hook-form`, `zod`, `@hookform/resolvers`, `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` and `tw-animate-css` are installed but not imported. `components.json` is leftover shadcn config. Most files in `public/images/` are no longer referenced; the resume (`public/images/Alex_Yan_Resume.pdf`) is.

## Skills

Design skills are in `.agents/skills/` (installed with `npx skills`, pinned in `skills-lock.json`) and symlinked into `.claude/skills/`. `frontend-design` comes from the `example-skills` plugin. Set the design direction with `frontend-design` before using the `better-*` skills, which keep whatever conventions the project already has.

## TypeScript

Strict mode is on (`strict`, `noUnusedLocals`, `noUnusedParameters`). Use `@/` for imports (resolves to `src/`). Target is ES2022.
