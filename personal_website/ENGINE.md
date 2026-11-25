# ENGINE.md: how the world is built (MVP)

The implementation contract for the redesign. `DESIGN.md` says what the site is; this file says how the code is organized and what the headless QA expects. If the two disagree, `DESIGN.md` wins and this file gets fixed.

## 1. MVP scope

**In:** title screen → overworld → six rooms with the zoom transitions; clickable objects that open NES dialog boxes or links; the status bar (HUD) with breadcrumb; Back/Escape/doorway navigation; a URL for every stop; keyboard support; reduced motion; the list view; the gate screen ("rotate your device" on phones held upright, "make this window larger" in small windows).

**Also in:** high-definition art scaled smoothly, a ground that covers the whole view behind every scene, the sea's idle motion, the smoke of the two chimneys on the overworld, and Alex's character in the cottage (he opens About me).

**Later (do not build now):** more ambient animation (fire), screenshots inside dialogs, sound, prerendering.

## 2. Stack rules

- React 19, TypeScript strict, Vite 7, Tailwind 4, `motion` for animation. Plain DOM and CSS: no canvas, no router library. Do not add or remove npm packages; report what you need instead.
- Fonts (installed): `@fontsource/press-start-2p` for titles, labels and the HUD; `@fontsource/vt323` for dialog body text and list-view body text. Pixel fonts must look crisp: no blur, no faux bold, no synthesized italics.
- Every UI color comes from the NES palette in `art/scripts/nes-palette.mjs`. Tokens live in `src/index.css`. There is no dark mode and no theme toggle. The art brings its own colors: the two grounds (`backdrops.json`) and the `--color-plate-*` tokens, measured from the plates painted in the rooms, which only label chips use.
- All displayed content comes from `src/constants/index.tsx` through `src/world/scenes.ts`. Never invent facts, numbers or copy about Alex.
- Art is always scaled smoothly: no picture, tile or sprite has `image-rendering: pixelated`. The pixel UI over it (type, chips, HUD, dialog, pointer) stays on whole device pixels.

## 3. Routes

Hash routes, so the browser Back button and shared links work with static hosting.

| Hash | View |
|---|---|
| *(empty)*, `#`, `#/` | Title screen |
| `#/world` | Overworld |
| `#/about`, `#/experience`, `#/projects`, `#/skills`, `#/learning`, `#/misc` | A room |
| `#/<room>/<item>` | That room with the item's dialog open, e.g. `#/experience/shopify` |
| `#/list` | List view |

- Anything else is replaced with `#/world`. An unknown item in a valid room is replaced with the room. A segment with a broken percent escape (`#/%`, `#/experience/%E0%A4%A`) is read as typed, so it is unknown like any other and never an error.
- Every navigation pushes a history entry. "Up" (Escape, the dialog's BACK, the breadcrumb, a doorway) navigates to the parent route: item → room → world. Escape on the overworld does nothing.
- `PRESS START` goes to `#/world`: its button, Enter or Space, or a click anywhere below the HUD (on the stage or on the sea around it).
- Loading any route directly renders it immediately with no animation and no title screen.
- Pure helpers are in `src/world/routes.ts` (`parseRoute`, `formatRoute`, `parentRoute`, `crumbsFor`).

## 4. Data

- **Art:** `art/approved/hd/`, imported through `src/world/assets.ts`. One picture per scene: `overworld.webp` and `about`, `experience`, `projects`, `skills`, `learning`, `misc`. Each is 1376×768 with transparency (the island cut out of its sea, a room cut out of its background) and is drawn across the whole 320×180 scene. The title screen has no picture of its own: it shows `overworld.webp` in `overworldRect` from `art/approved/title.json`.
- **Grounds:** `hd/backdrops.json` has `ocean` (title screen and overworld) and `grass` (rooms): a base `color`, the `tile` size in scene units and the tile's `frames` (two for the sea, one for the grass).
- **Character:** `hd/mascot.json` describes the sprite sheet `mascot.webp`: one row of `count` frames of `frame` pixels, the `size` of a frame in scene units, the `anchor` (where the bottom center of a frame stands in the cottage) and two `animations`, `idle` and `wave`, each a list of `frames` and an `fps`. Nothing about the sheet is written in the code.
- **Regions:** `art/approved/<scene>.regions.json`. Every box is `[x, y, w, h]` in scene units. A region has `box` (the click area) and optionally `plate` (a blank label plate drawn in the art for that object) and `items` (the individual things on a Skills shelf, left to right). The cottage's `me` is the character's click area.
- **Scenes:** `src/world/scenes.ts` joins regions with content: each scene has a picture, a ground, a flash color and a list of hotspots, and the cottage has its character. Types are in `src/world/types.ts`.
- **Hotspot kinds:** `scene` (navigates: overworld locations and doorways), `dialog` (opens `#/<room>/<id>`), `link` (a real `<a>`: GitHub, LinkedIn, resume, email), `item` (a Skills shelf item: its name shows on hover and focus; activating it opens its shelf's dialog).
- A hotspot's accessible name contains its visible label (WCAG 2.5.3); `scenes.ts` logs an error when one does not. Where the label is a short form (`Infra`, `DDIA`, `Rooh`, `Purity Test`, `???`) the hotspot also has `fullName`, which the tab title uses. A dialog whose title is not a word (`???`) has `spokenTitle`, read out in its place.
- The character is the look of the `dialog` hotspot `me`: an ordinary button over his click area, named `About me: Alex Yan`, labelled `ABOUT ME`, that opens `#/about/me`. The old address `#/about/portrait` is replaced with `#/about/me` (`MOVED_ITEMS` in `scenes.ts`).
- The contract files `src/world/{types,assets,scenes,routes}.ts`, `src/types/index.ts` and `src/constants/index.tsx` are written first. Component code builds against them; change them when the art or the content model changes, and say so.

## 5. Stage and scaling

- The stage is a 320×180 scene shown at scale `k`. One scene unit must cover a whole number of device pixels:
  `fit = min(availableWidth / 320, availableHeight / 180)`, `k = max(1 / dpr, floor(fit * dpr) / dpr)`.
  The available area is the viewport minus the HUD. Recompute on resize and when `devicePixelRatio` changes.
- The stage is centered. Scenes are clipped to the whole area below the HUD (`.stage-area`), not to the stage. A scene's picture is exactly the stage at rest; a camera that has zoomed (a dive, the title zoom, a room eased toward an object) fills the area to its edges. The dialog layer stays inside the stage.
- **Ground.** Every scene has a ground (`<Ground>`, `.ground` in `src/index.css`): its tile repeated across a box that is exactly the area below the HUD, so there is no flat band at any window shape and no seam at the stage's edge. The ground is a child of the scene, so the camera moves and scales it with the picture. Tiles are counted from the scene's corner and are `tile × k` large. A room's ground also reaches `groundBelow` units under the view, because the camera lifts a room to frame an opened object. Nothing is larger than about the view.
- The page background, the stage area's and `--page-bg` are the scene's ground color from `backdrops.json`. `index.html` repeats the two colors for the first paint and for `theme-color` (it cannot read the JSON); the harness fails if they differ.
- The stage sets `--k` (unitless), `--u` (`k` in CSS px: one scene unit) and `--area-x`, `--area-y`, `--area-w`, `--area-h` (the area below the HUD, seen from the stage). Everything positioned over the art (hotspots, labels, the pointer, dialogs) is sized in `--u` so it scales with the art.
- Layers, bottom to top: page background, ground, scene picture, chimney smoke, character, hotspots, labels and the ▶ pointer, dialog, the flash of a dive (it covers the whole area below the HUD), HUD, gate screen. Labels are above the hotspots so a focus ring never cuts through a neighbor's name; they take no pointer events.
- Pixel type is crisp only at whole device pixels per font pixel. Inside the stage: labels use `roomLabelPx` / `worldLabelPx`; dialog body text is `max(ceil(0.64 × dpr), floor(d / 4))` device px per VT323 dot, where `d = k × dpr` (rounded down, so a larger stage never shows less of a dialog).
- The dialog layer covers scene rows 68 to 174 (8 px in from each side). On a stage where those 106 rows hold fewer than ten lines of body text (`106 × d < 300 × dot`), it starts at row 8 instead: the dialog may then cover nearly the whole stage. A dialog is as tall as its content, anchored to the bottom.

## 6. Transitions

All camera moves are transforms on the scene layer, ground included. Timings are starting points to tune by eye.

| From → to | Move |
|---|---|
| Title → overworld | Scale the title scene 4× about `overworldRect` (~800 ms), sea and all, so the small island lies exactly on the stage: the same picture, in the same place, as the overworld's. Then cross-fade to the overworld (180 ms): the island does not change, only the waves do (they are 4× their size by then). Reverse on Back. |
| Overworld → room | Zoom toward the location's box, sea and all (~500 ms, ease-in), fill the area below the HUD with the room's flash color (~150 ms), reveal the room. The zoom starts at once; the flash holds until the room's art is decoded. Reverse on exit. |
| Room → item | Ease toward the object (~300 ms) and open the dialog. The scale is `round(1.3 × d) / d`, a whole number of device px per scene unit. The object's center goes to the middle of the band above the dialog: the stage rows from 0 to the dialog's top edge, at least 40. The camera never shows past the left, right or top edge of the picture, and the picture's bottom edge stays behind the dialog; grass shows wherever the view reaches past it. Reverse on close. |
| Room → room, anything ↔ list | Cross-fade (≤200 ms) or cut. |
| First load of any route | No animation. |

- **Reduced motion** (`prefers-reduced-motion: reduce`): every transition becomes an opacity cross-fade of at most 200 ms, with no scale or movement. The ▶ pointer does not blink, the sea is still, the chimney smoke is a still plume and the character stands on his first idle frame.
- A scene is shown, and the stage says idle, only when its picture, its ground tiles, its character's sheet and its smoke's sheet are decoded (`sceneReady` in `preload.ts`).

**Ambient motion.** All three loops are CSS animations of `transform` and `opacity` only, so the compositor runs them and nothing is painted again while the page is idle. They keep running through camera moves.

- **The sea** (a ground with two frames): the second frame fades in and out over the first while both sway from side to side. Both go in hard steps (a fade in four looks, a slide of one scene unit at a time), so a new frame is composed only a couple of times a second. The tile layers are wider than the view by the sway, nothing more. All of its timing is five properties on `:root` at the top of `src/index.css`: `--sea-fade-time`, `--sea-fade-steps`, `--sea-sway-time`, `--sea-sway-by` (scene units) and `--sea-sway-steps`. It runs wherever the sea shows: title screen, overworld, gate screen, the list view's way back.
- **The chimney smoke** (`<Smoke>`): the smoke the overworld's picture was drawn with, over the cottage and the workshop, is animated. `hires.mjs` (with `art/scripts/smoke.mjs`) paints it out of the island and cuts its three puffs into a sheet, `hd/smoke.webp`, described by `hd/smoke.json` (frame size, `count`, a frame's `size` in scene units, and the `mouth` of each chimney). A few puffs climb from each chimney in hard steps and fade; each is a window one frame large, and the sheet slides behind it as the puff ages. Every number (how long, how often, how many, how far, how large) is the `SMOKE` object at the top of `src/world/smoke.ts`, which also writes the keyframes. The layer (`[data-smoke]`) is the box of the picture, so the title screen shows the same smoke small, and all smoke runs on one clock (each animation's start time is set to the page's zero): the title's zoom ends on the overworld's own smoke. Its sheets are CSS backgrounds, not `<img>`, so the harness does not take them for pictures; the harness does not check the smoke itself.
- **The character** (`<Character>`): a window one frame large with the sheet sliding behind it in steps. The keyframes are written from `mascot.json` (`src/world/character.ts`). He plays `idle` at rest and `wave` while his hotspot is hovered, has keyboard focus (`:focus-visible`: focus that a click or a tap left on him does not count) or his dialog is open.
- While a transition runs, hotspots and PRESS START ignore input. A route change that arrives mid-transition is applied when it finishes (the latest one wins). The app must never end up showing a scene that does not match the URL.
- One navigation can take two moves (overworld → item is a dive, then the ease toward the object; item → overworld is the reverse). The stage comes to rest only after the last one.
- Every scene root has `data-ui`: `on` at rest (labels show, hotspots are live), `off` while the camera moves (no labels, no pointer, hotspots ignore the pointer), `zoom` at rest behind an open dialog (see Labels in §7). `transitions.ts` writes it while a move runs and React renders the same value at rest. Labels fade out as a move starts and fade back in before the stage reports idle; between two moves of one navigation they stay away.

## 7. Components and file ownership

```
src/
  world/
    types.ts  assets.ts  scenes.ts  routes.ts     contract files (see §4)
    useRoute.ts  useStageScale.ts  ...            engine hooks and helpers
  components/
    Stage.tsx        scaling, page background, layers
    World.tsx        which scene is shown and the camera transitions
    SceneView.tsx    ground, picture, character, labels and hotspots
    Ground.tsx       a ground from backdrops.json, tiled across its box
    Smoke.tsx        the smoke rising from a picture's chimneys
    Character.tsx    the sprite of someone standing in a scene
    Hotspot.tsx      one button or link over a region, plus the ▶ pointer
    TitleScreen.tsx  name and PRESS START over the sea and the small island
    Dialog.tsx       NES dialog box
    Hud.tsx          status bar and breadcrumb
    ListView.tsx     all content as a plain page
    RotateGate.tsx   "rotate your device" for phones held upright
  styles/            per-component CSS that Tailwind utilities cannot express
```

Component contracts (exact names and props):

- `<Dialog id={string} content={DialogContent} onClose={() => void} />`: rendered inside the stage's dialog layer when the route has an item. Dark fill, chunky white pixel border, title, optional subtitle and meta line, paragraphs and/or bullets, tags, links, and a `▶ BACK` button. Two columns (what it is, then its text) where the box is at least 72 letters of body text wide; otherwise stacked, with the tags after the text. Scrolls inside itself when the content is long, with a `MORE` cue while at least a row of text is hidden. It closes on BACK, Escape, browser Back, or a click outside it (on the stage or on the background around the stage). The second click of the double click that opened it (within 500 ms, on the same spot) is not counted, outside the box or on it.
- `<Hud route={Route} crumbs={Crumb[]} />`: a thin black bar across the top, 24–48 CSS px tall. Left: `ALEX YAN` and the current role. Right: `RESUME`, `GITHUB`, `LINKEDIN`, `LIST` as real links. The breadcrumb (`World › Experience › Shopify`) is part of the bar; every crumb except the last is a link. On narrow screens drop the role first, then shorten the links; never wrap to a second row. The type is the largest crisp size that fits the overworld's bar in full; it goes one size down where that keeps the links spelled out on item routes and is still 12 CSS px or more. The size depends on the width only, never on the route.
- `<ListView />`: `#/list`. A normal scrolling page with all content in reading order (About, Experience, Projects, Skills, Learning, Misc) under real headings, in the same palette and fonts, with a link back to the world. It must read well in portrait on a phone.
- `<RotateGate route={Route} />`: the gate screen. It covers the whole viewport, HUD included, except on `#/list`, in two cases. `rotate`: a touch device (coarse pointer) held in portrait with a viewport narrower than 600 CSS px; it says "Rotate your device", and rotating to landscape removes it. `window`: a fine pointer and a viewport under 640 CSS px wide or under 384 tall, where the stage would be under 2×; it says "Make this window larger". Both show the name, the role, a `View as a list` link to `#/list` and a `Resume` link. While it shows, the world behind it is inert and answers no keys.
- `<TitleScreen onStart={() => void} />`: `ALEX YAN` as the page's `<h1>` and a `▶ PRESS START` control, placed in the `textAreas` from `title.json`. PRESS START blinks once a second for as long as the title screen is up (not under reduced motion).

Labels: overworld locations always show their name. In rooms, every dialog and link hotspot shows its label on or under its object (on its `plate` when it has one), and the doorway is labelled `EXIT`. Skills shelves always show the shelf name; item names show on hover and focus only. Labels must not overlap each other or leave the stage.

- **Chips.** A label is a crisp chip on whole scene units. Off a plate it is black with white type. On a plate it takes the plate's color (`--color-plate-town`, `-workshop`, `-hall`) and, where the picture draws a black line round the plate, a one-unit black border; the chip is grown a unit past the plate box on the sides where that painted line reaches (`GROW` in `labels.ts`), so its hard edge covers the soft one.

- **Size.** One size per scene: the scale's natural size, stepped down a device pixel at a time until every label fits, but not below an 8 CSS px font. If nothing fits there, the scene stays at that size and only the labels that do not fit go smaller, each as little as it has to. A label that fits at no size shows on hover and focus only.
- **Clickable.** A label and the ▶ cell to its left belong to its hotspot: pointing at or clicking them does what the object does. A Skills item's name, while it shows, can be pointed at without vanishing.
- **Pointer.** The ▶ marks whichever of the mouse and the keyboard moved last.
- **Behind a dialog (`data-ui="zoom"`).** The always-on labels stay, laid out for the camera at rest on the object: position = label position at `d' = round(1.3 × d)` device px per scene px, plus the camera offset; type at the crisp size for `d'`. The label layer undoes the camera's scale, so label bitmaps are never stretched. They cut in when the move ends and cut out when it starts to leave. They run past the stage with the art, are covered by the dialog like the art, take no input and are hidden from assistive technology. Skills item names do not show.

## 8. Accessibility floor

- Every hotspot is a real `<button>` or `<a href>` with an accessible name, at least 24×24 CSS px, reachable by Tab in reading order (left to right, top to bottom). A hotspot grown to 24 px keeps the art of its own region clickable where grown neighbors overlap.
- Arrow keys move between hotspots. With focus on the page or on the scene heading, the first arrow key focuses a hotspot: on the overworld the room just left, otherwise the first in Tab order. Arrow keys pressed in the HUD or a dialog are left alone.
- Focus is always visible: the ▶ pointer plus a focus ring that contrasts with the art.
- After a scene change, focus moves to the new scene (its heading or container) and its name is announced. Closing a dialog returns focus to the hotspot that opened it.
- The dialog is `role="dialog"` with `aria-modal="true"`, labelled by its title, traps focus, and closes on Escape. Every Tab inside it is handled in script (Safari's own Tab skips buttons and links).
- A "View as a list" skip link is the first focusable element on the page.
- Text in dialogs, the HUD and the list view passes WCAG AA contrast.
- Never set `cursor: none`. Hover-only styling sits behind `@media (hover: hover)`.

## 9. QA contract

The headless harness finds things by these attributes. They are part of the product code, not test-only extras.

| Attribute | On | Value |
|---|---|---|
| `data-route` | the app root | canonical route, e.g. `/experience/shopify`, `/world`, `/` for the title, `/list` |
| `data-stage` | the stage element | present; also `data-k="<k>"` |
| `data-transition` | the stage element | `loading` until the first scene's image is decoded and the fonts are in, `running` while a camera transition runs, `idle` when the current scene is settled and its image is decoded |
| `data-scene` | the visible scene root | `title`, `world` or a room id |
| `data-hotspot` | each hotspot button or link | the region id (`shopify`, `door`); Skills items use `<shelf>-<index>` from 0 (`languages-0`) |
| `data-label-for` | each visible label | the hotspot id it names |
| `data-pointer` | the ▶ pointer | present while a hotspot is hovered or focused |
| `data-dialog` | the dialog root (`role="dialog"`) | the hotspot id |
| `data-ground` | the ground of each scene (and of the gate screen and the list view's picture) | `ocean` or `grass`; its tiles are CSS background images on it or inside it |
| `data-character` | the character's picture | the id of the hotspot he stands for (`me`); also `data-pose="idle"` or `"wave"`. It holds one `<img>`, the sprite sheet |
| `data-hud` | the HUD bar | present |
| `data-breadcrumb` | the breadcrumb `<nav>` | present |
| `data-view="list"` | the list view root | present on `#/list` |
| `data-rotate-gate` | the gate screen | present while it is showing; the value is `rotate` or `window` |
| `data-press-start` | the PRESS START control | present on the title screen |

- With `?debug=hotspots` in the URL (before the hash), every hotspot and label is outlined so screenshots show how they line up with the art.
- A hotspot's on-screen rectangle equals its region box times `k`, within 1 CSS px (it may be padded up to the 24 px minimum).
- At rest a scene's picture is exactly the stage (the title's is `overworldRect × k`), its ground covers the area below the HUD, and the character's box is `size × k` with its bottom center on `anchor × k`.

## 10. Headless QA harness

`npm run qa` runs `qa/walk.mjs`: Playwright with headless Chromium. It starts its own server on a free port, walks the site, saves screenshots and writes a report. Nothing opens on screen.

- Output: `qa/out/<run>/shots/*.png`, `qa/out/<run>/report.json`, `qa/out/<run>/report.md`. `qa/out/` is git-ignored. The exit code is 1 when any check fails.
- Options: `--mode dev|preview` (default `preview`: a production build into the run folder, then `vite preview`), `--only <profile[,profile]>`, `--flow <flow[,flow]>`, `--base <url>` to test a server that is already running, `--out <dir>`.
- Profiles: `desktop` 1440×900 @1x, `desktop-hd` 1920×1080 @1x, `retina` 1440×900 @2x, `small` 1024×640 @1x, `phone-landscape` 844×390 @3x touch (the bare screen), `phone-small` 750×340 @3x touch (what a browser leaves of that screen: `rooms`, `deeplinks`), `phone-se` 667×375 @2x touch (the smallest stage in use: `rooms`), `phone-portrait` 390×844 @3x touch, `reduced-motion` 1440×900 @1x with reduced motion.
- Flows: `title` (title screen, press start, frames of the zoom, the zoom landing on the overworld's picture, overworld), `world` (locations, labels, pointer, debug overlay), `rooms` (enter each room from the overworld, open every dialog, Escape, a double click, doorway), `deeplinks` (load every route directly; Back button; two moves from one navigation; unknown routes, broken escapes and moved items), `keyboard` (the whole trip without a mouse; focus trap and focus return; the pointer follows focus past a resting mouse), `list`, `gate`, `motion` (reduced motion has no moving transforms), `ambient` (the ground at the profile's shape and at a very wide and a very tall window, sampled from screenshots; the sea moves between two screenshots and does not under reduced motion; the character plays the frames `mascot.json` lists, waves, and opens `#/about/me` by mouse and by keyboard).
- Checks at every stop: no console errors, page errors or failed requests; no horizontal scrolling; the scaling rule in §5; the pictures are the high-definition ones, loaded, in place and scaled smoothly; the ground is the right one, covers the area below the HUD, uses the tiles `backdrops.json` lists at their size and animates only transform and opacity (nothing under reduced motion); the page background is the ground's color; fonts loaded; the scene matches the URL; every region in the scene's regions file has a hotspot at the right place and size with an accessible name; labels inside the stage and not overlapping; behind a dialog, labels not stretched with the camera; in the cottage the character is where and what `mascot.json` says, in the right pose; dialog text not clipped, and at least 6 lines of it showing where it scrolls; UI colors from the NES palette (label chips may also use the plate colors).
- What the harness expects of the art it reads from the art itself: `backdrops.json`, `mascot.json`, `title.json` and the regions files.
