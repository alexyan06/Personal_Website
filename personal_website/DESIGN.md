# DESIGN.md: alexyan.dev redesign brief

The source of truth for the visual redesign. Read it before any design or build work. Decisions marked **Decided** are settled, so don't relitigate them. Items under **Open** still need Alex.

## 1. Concept (Decided)

The whole site is **one zoomable pixel-art world** in the style of an old, cute console game. There are no pages and no scrolling between sections. The camera is the navigation.

- The landing view is an **overworld map**, a fictional land with six locations, one per section.
- Clicking a location makes the camera **dive into it**, revealing that section as its own scene. Clicking an item there opens its details.
- Every deeper level is drawn **inside** its parent: its layout and colors match its tiny version one level up. Zooming is one continuous camera move, never a cut to a new screen.
- **The zoom effect:** the parent grows smoothly, its ground with it, then resolves into the detailed child scene.

## 2. Levels and content (Decided)

| Level | Shows | Readable text |
|---|---|---|
| 0: Overworld | The whole map and its six locations | Name, one-line role (current: SWE intern at Shopify), location names, resume link |
| 1: Location | A full scene for one section; its items are objects in it | Item names |
| 2: Item | A zoom onto one object plus an NES dialog box with its details | Full details |
| 3: Projects only | A screenshot shown "on the monitor" inside the project's dialog | — |

| Location (fictional map) | Section | Level-1 scene | Items (from `src/constants/index.tsx`) |
|---|---|---|---|
| A house | About | Inside the house: Alex himself, who opens About me (name, headline, bio, links), and objects for GitHub, LinkedIn, email, resume and education | — |
| A town | Experience | A street of four storefronts | Shopify, PNC, Purdue Stack, Rooh |
| A workshop or lab | Projects | Workbenches, one object per project (e.g. a server rack for Raft, a bird for Perch, a fire for PyroTech) | All 9 projects, equal size (see §2b) |
| An armory or item shop | Skills | Shelves of items grouped by category | Languages, frameworks, infrastructure, tools |
| A library or tower | Currently learning | Open books on desks | Entries from the `currently` array |
| A trophy hall or arcade | Misc | Trophies and memorabilia | YC Startup School, Capital One Tech Summit (3rd place), hackathons, personal items (**Open**) |

The world is **fictional** and does not follow real geography. Lay it out for balance and readability.

## 2a. Overworld (Decided)

- **Land:** a single green island surrounded by ocean. The sea covers the whole view, to every edge of the window, and its waves move a little (§5).
- **Mood:** bright day, saturated colors (blue water, saturated greens).
- **Layout:** Alex's house at the center, with paths branching out to the other five locations:
  ```
  ┌────────────────────────────┐
  │  [Library]       [Workshop]│
  │       \           /        │
  │  [Shop]──[HOUSE]──[Town]   │
  │              |             │
  │        [Trophy hall]       │
  └────────────────────────────┘
  ```
- **Approved art:** `art/approved/hd/overworld.webp`, the island cut out of its sea. `overworld.raw.jpg` is the model output it is made from, also the reference for child scenes. Each location's bounding box, and each Experience building's box, is in `art/approved/overworld.regions.json`, the single source for click areas, label positions and zoom crops. Prompts: `art/prompts/overworld.md`, then the `overworld-edit-trophy-path.md` edit.
- **Density:** sparse. Terrain, paths and a few trees and rocks only, so the six locations are clearly the things to click.
- **Labels:** an always-visible pixel-font label under each location (ABOUT, EXPERIENCE, PROJECTS, SKILLS, LEARNING, MISC). Labels are rendered as real text over the art, never generated into the image.
- **Clickable:** the six locations. (Alex stands inside the cottage, not on the map: §2b.)
- **Status bar:** a thin black NES-style HUD bar across the top, visible at every zoom level: `ALEX YAN  SWE INTERN @ SHOPIFY` on the left; `RESUME  GITHUB  LINKEDIN  LIST` on the right. It is HTML with real links, set in the pixel font, and sits above the scene rather than being painted into it.
- **Opening:** an NES-style **title screen**: `ALEX YAN` and a blinking `▶ PRESS START` over the same island seen small in a wide ocean. Click, Enter or Space zooms straight into the island, so the title screen acts as level −1 of the zoom. It is **built, not generated**, and has no picture of its own: it is the sea, with the overworld's own picture drawn at a quarter of its size in the box `art/approved/title.json` gives (`overworldRect`; the file also holds the text areas). The zoom therefore ends on exactly the picture the overworld shows. Deep links (`/#/...`) and the list view skip the title screen.

### How each location looks (Decided)

| Location | On the overworld | Inside (level 1) |
|---|---|---|
| About | **Cozy cottage**: small wooden house, red roof, chimney smoke, little garden. | The cottage interior, with Alex standing in it and objects for his links. |
| Experience | **A town of four buildings**, each shaped to hint at its company: a market stall (Shopify), a columned bank (PNC), a campus hall (Purdue Stack), a small startup garage (Rooh). | The town street. Each building's name is a **real-text sign overlay**. No drawn copies of real logos, and no brand-color takeover. |
| Projects | **Inventor's workshop**: wooden building with gears and a smoking chimney. | Workbenches, with each project as an object on a bench. |
| Skills | **RPG item shop**: a counter and shelves. | Skills as "items" on shelves grouped by category, each with a real-text label. |
| Learning | **Stone library** with tall bookshelves. | Each topic as an open book on a reading desk. No progress bars. |
| Misc | **Trophy hall**: pedestals and display cases. | Awards as trophies, hackathons as framed badges, personal items as curios. |

## 2b. Interiors (Decided)

Shared rules for every interior:
- One room or street on the 320×180 scene grid, in the same three-quarter overhead view as the overworld (NES RPG interiors).
- No people, except Alex himself in the cottage (below).
- Each clickable object is about 32–48 px, with clear floor below it for its real-text label.
- An open doorway at the bottom center exits back to the overworld (same as Escape).
- **Hand-off from the overworld:** the camera zooms into the building, sea and all, then a quick NES-style transition (a fade through the building's main color) reveals the interior. Only the title→overworld zoom is exact.
- Each interior is generated with its building's crop from `overworld.raw.jpg` as the reference, so materials and colors carry over.
- **Ground:** each interior is generated on a flat magenta background and cut out with an edge-connected chroma key. It stands on grass: a tile made from the overworld's own grass and tufts, which covers the whole view around the room (§5). The sea surrounds only the title screen and the overworld.
- **Approved:** `art/approved/hd/{about,experience,projects,skills,learning,misc}.webp` (cut out, transparent around the room), each made from its `.raw.jpg` (model output). Prompts are in `art/prompts/<id>.md`. Art may be revised after the MVP.

| Location | Room | Clickable objects → content |
|---|---|---|
| **About: cottage** | Warm wooden room: fireplace, rug, window, plant | **Alex, standing on the rug** → About me: name, headline, bio, links. He idles, and waves when pointed at. Desk with a computer → GitHub. Rolled scroll on the desk → Resume PDF. Mailbox by the door → Email. Corkboard with pinned notes → LinkedIn. Framed diploma → Purdue CS '28. |
| **Experience: town street** | Cobblestone street with lamp posts | Four storefronts matching the overworld: market stall with a green awning (Shopify), columned bank (PNC), brick clock-tower hall (Purdue Stack), startup garage with the door half open (Rooh). Real-text hanging signs. Click → zoom to the door and open a dialog. |
| **Projects: workshop** | Plank floor, tool wall, a gear mechanism turning in a corner | **Nine equal workbenches in a 3×3 grid**, one object each: Raft (three wired server towers, lights blinking in sync), Perch (a bird on a perch by a monitor), PyroTech (a glass case with a tiny landscape and flickering fire), K/V Server (a key cabinet), MapReduce (crates on a splitting conveyor), Iris (a microphone), Access Prep (a document stack), BoilerFit (a dumbbell), Boiler Purity Test (a clipboard checklist). Dialogs show a screenshot "on the monitor" when one exists. |
| **Skills: item shop** | Counter at the front, wooden shelves behind | One shelf per category, with an always-visible shelf label and item names shown under the ▶ pointer. The approved art holds 6 potions, 6 scrolls, 4 crates/barrels and 4 tools, so the list matches it. **Languages** (potions): Python, Java, TypeScript, Go, Ruby, SQL. **Frameworks** (scrolls): React, Next.js, Spring Boot, Rails, FastAPI, Node.js. **Infrastructure** (crates and barrels): PostgreSQL, AWS, Docker, GCP. **Tools** (rack): Git, GitHub Actions, GraphQL, JUnit. A skills list must be added to `src/constants`. |
| **Learning: library** | Tall bookshelves, an arched window with a light beam, a candle | Exactly three matching reading desks with open books, evenly spaced in one row, and nothing else on the floor: *AI Engineering* by Chip Huyen (red book, left), the MIT 6.5840 Distributed Systems course (light-blue book, center, in the window's light) and *Designing Data-Intensive Applications* (green book, right). |
| **Misc: trophy hall** | Marble floor, columns, a red carpet | Pedestals: YC Startup School (trophy), Capital One Tech Summit (bronze 3rd-place trophy). Three framed medals on the back wall, one per hackathon: LA Hacks (PyroTech), TartanHacks (Iris), BoilerMake (BoilerFit). Those five things only: the front of the room is empty marble. |

### Alex's character (Decided)
Generated from Alex's photo with **Alex's real clothes and hair**, not a costume. He stands in the cottage and **replaces the About Me frame on its wall**: clicking him opens the About me dialog (`#/about/me`), and his label reads `ABOUT ME`. He plays an idle animation at rest and waves while the pointer or keyboard focus is on him and while his dialog is open; under reduced motion he stands still. He is one sprite sheet, `art/approved/hd/mascot.webp`, described by `mascot.json` beside it (frame size, how many frames, size and place in the room, the frames and speed of each animation). The site reads everything from that file, so a new sheet needs no code.

## 3. Navigation (Decided)

- **Guided zoom:** clicks jump between defined stops. There is no free pan or pinch zoom. A scroll-wheel notch may step in or out one level.
- **▶ pointer:** a blinking arrow, like an NES menu cursor, marks the selectable thing under the mouse or keyboard focus. It replaces hover highlights and the current custom cursor (`Cursor.tsx` and global `cursor: none` go away; the system cursor stays visible).
- **Back:** Escape, the browser Back button, clicking outside the focused area, or the breadcrumb (`World › Experience › Shopify`).
- **Deep links:** every stop has a URL (`/#/experience/shopify`). Loading one flies the camera there.
- **Keyboard:** Tab or arrow keys move the ▶ between items, Enter zooms in, Escape zooms out. Focus is always visible.

## 4. UI chrome (Decided)

- **Dialog boxes** for all level-2 detail: a dark fill, a chunky white pixel border, text inside, and a `▶ BACK` action. No modern floating cards.
- **Type:** a pixel font for titles and labels. Body text in dialogs uses a pixel font that stays legible at a large size; legibility beats authenticity. The exact faces are **Open**.
- **Dialog copy** comes only from `src/constants/index.tsx`. Never invent facts.

## 5. Art rules (Decided)

- **Original world in an old console game's style.** Do not recreate any existing game's maps, characters, tiles, UI or music (no Zelda, Pokémon, Mario and so on).
- **High-definition art.** The pictures are the image model's own drawings (1376×768), not reduced to 320×180 or to the NES palette: the reduced versions looked harsh. They are **scaled smoothly**, down or up, never with `image-rendering: pixelated`.
- **Scene grid:** a scene is still **320×180 scene units**. Every picture is drawn across exactly that, and every region box is measured in it. The stage shows it at a whole number of device pixels per unit.
- **Pixel UI over smooth art.** The fonts, the HUD, the dialog boxes, the label chips and the ▶ pointer stay crisp pixel work in the **NES master palette**, with no anti-aliasing, gradients or blur. A label chip that lies on a blank plate painted in a room takes that plate's color, measured from the picture.
- **The ground covers the whole view.** Behind every picture lies a ground that reaches every edge of the window below the HUD: the **sea** behind the title screen and the overworld, **grass** behind a room. Each is a tile made from the overworld's own colors, wave marks and grass tufts (`art/approved/hd/backdrops.json`: base color, tile size, tile images). It belongs to the scene's world: it zooms and moves with the camera. The page background and the browser's theme color are the same base colors.
- **Ambient motion is sparse and calm:** the sea (its two wave frames fade into each other while the pattern sways slowly from side to side, both in a few hard steps like an old game's frames), the smoke of the two chimneys on the overworld (the cottage's and the workshop's: the picture's own puffs, rising and fading in the same hard steps; tuned in `src/world/smoke.ts`) and Alex's idle and wave. Nothing else moves for decoration. Under `prefers-reduced-motion`, all ambient motion stops and zooms become short cross-fades.

## 6. Asset pipeline (Decided)

This follows Perch's mascot pipeline (`Perch` repo, mascot generation doc).

**Scenes, generated top-down so the zoom lines up:**
1. Generate the overworld. Review and approve it (`overworld.raw.jpg`).
2. For each location, crop its region of the approved overworld and pass that crop as the reference image: *"expand this into a detailed scene, keep its layout and colors."* Review and approve each one.
3. `art/scripts/hires.mjs` turns the approved raw pictures into what the site shows, in `art/approved/hd/`: the island cut out of its sea, each room cut out of its magenta background (a soft edge, feathered inward only), a sea tile in two frames and a grass tile drawn from the overworld's own colors and marks, and `backdrops.json`, which describes the two grounds.
4. Region boxes are measured on the 320×180 scene grid (`art/scripts/regions.mjs`) and do not depend on a picture's own size.

The earlier 320×180 NES-palette versions (`art/approved/*.png`, `title.png`) are kept but no longer shown.

**Alex's character** comes from one photo:
- cut-out frames of the same size, feet on the bottom edge, in `art/approved/mascot/` (`idle-1.png`, `wave-1.png` and so on, in the order they play)
- Perch's method: a flat `#FF00FF` background, hue-based chroma-key to real alpha, and reference chaining (later frames use the approved earlier frames as references)
- `art/scripts/mascot.mjs` lays the frames out in one row (`hd/mascot.webp`) and writes `hd/mascot.json`

**Budget:** 7 generated scenes (overworld and 6 locations) and the character's frames. The title screen and the grounds are built from the overworld. Level 2 does **not** get its own full scenes.

## 7. Phones and list view (Decided)

- **Portrait orientation on a phone** shows a full-screen pixel-art "Rotate your device" screen with a small rotating-phone animation, plus a **"View as a list"** link. Websites can't force rotation, so prompt instead.
- **Landscape** loads the world normally.
- **List view** is a plain, fast, accessible page with all content (About, Experience, Projects, Skills, Learning, Misc) in reading order, styled with the same palette and fonts. It is also linked from the overworld for recruiters in a hurry, and it is what screen readers and crawlers get.
- The rotate screen and the list view's way back to the world show the same island on the same moving sea as the title screen.

## 8. Quality floor

- Name, current role and the resume link are readable within 10 seconds of landing, without zooming.
- Every interactive object is a real `<button>` or `<a>` with an accessible name. The world has a text equivalent (the list view).
- Contrast inside dialog boxes passes WCAG AA.
- No layout shift while scenes load: preload the parent and its direct children.
- **Decided:** `PRESS START` blinks for as long as the title screen is up, as §2a asks. It is not stopped after five seconds for WCAG 2.2.2: the blink is 1 Hz (far below any flash threshold) and it is switched off under `prefers-reduced-motion`.

## 9. How to use the skills

The code is built against `ENGINE.md` (routes, scaling, transitions, file ownership, QA contract) and checked with the headless harness (`npm run qa`).

1. `frontend-design`: already applied; this file is its output. Don't override the decisions here.
2. `/variant`: for open UI choices such as dialog styling, pointer behavior or the rotate screen.
3. `better-motion`: zoom timing and easing, the sea's motion. `better-typography`: pixel font sizing and readability. `better-colors`: the NES palette mapped to tokens. `better-accessibility`: keyboard flow, focus and reduced motion.
4. `better-interface` and `/interface-review`: before merging.

## 10. Open

- (Decided: Press Start 2P for titles, labels and the HUD; VT323 for dialog and list body text.)
- Which photo to use for the sprite.
- Misc: personal items for the three placeholder display cases (Alex adds later).
- (Decided: all art uses Nano Banana Pro, `gemini-3-pro-image`, via `art/scripts/generate.mjs`.)
- (Decided: plain DOM and CSS transforms on the current stack, no canvas. The implementation contract is `ENGINE.md`.)
- (Decided: no dark/light toggle; the world has one fixed look.)
- The sea's motion is a first pass. Its timing is in one place (the `--sea-*` properties at the top of `src/index.css`) for Alex to tune.
- Sound (chiptune blips): off by default, or none at all.
