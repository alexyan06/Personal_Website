# Headless QA harness

`npm run qa` walks the site in headless Chromium (Playwright), takes a screenshot at every stop, checks
each stop against the contract in `ENGINE.md` (sections 3, 5, 8, 9, 10) and writes a report. It starts
its own server on a free port and stops it again. Nothing opens on screen.

```bash
npm run qa                                    # everything: production build, all profiles, all flows
npm run qa -- --mode dev --only desktop       # quickest full loop while building
npm run qa -- --mode dev --only desktop --flow rooms
node qa/walk.mjs --help
```

The last two lines printed are the report path and the totals. The exit code is `0` when nothing
failed, `1` when any check failed, `2` for a bad option and `130` when interrupted (the report is
still written).

## Options

| Option | Meaning |
|---|---|
| `--mode preview` | Default. `vite build --outDir <run>/dist`, then `vite preview --outDir <run>/dist --port <free> --strictPort`. What visitors get. |
| `--mode dev` | The Vite dev server: `vite --port <free> --strictPort`. No build, so it starts faster. |
| `--base <url>` | Test a server that is already running. No server is started or stopped. |
| `--only <profiles>` | Comma-separated profiles (table below). Default: all. |
| `--flow <flows>` | Comma-separated flows (table below). Default: all that the profile runs. |
| `--out <dir>` | Write this run into `<dir>`. Default: `qa/out/<timestamp>`. |
| `--run <name>` | Name the run folder under `qa/out/` yourself. |
| `--jobs <n>` | Walk `n` profiles at the same time (default 1). `--jobs 3` roughly halves a full run. |
| `--regions <dir>` | Read `*.regions.json` from another folder (default `art/approved`). |
| `--max-minutes <n>` | Hard stop for the whole walk (default 30). The report is still written. |
| `--quiet` | Print only the result. |

Several runs can go at once: each picks its own port and its own run folder. The server is the
project's own Vite (`node_modules/.bin/vite`, what `npx vite` runs), bound to `127.0.0.1`, and it is
stopped when the run ends, also on errors, Ctrl-C and SIGTERM.

## Profiles and flows

| Profile | Viewport | Flows it runs |
|---|---|---|
| `desktop` | 1440x900 @1x | title, world, rooms, deeplinks, keyboard, list, ambient |
| `desktop-hd` | 1920x1080 @1x | same |
| `retina` | 1440x900 @2x | same |
| `small` | 1024x640 @1x | same |
| `phone-landscape` | 844x390 @3x, touch | same, plus gate |
| `phone-small` | 750x340 @3x, touch | rooms, deeplinks |
| `phone-se` | 667x375 @2x, touch | rooms |
| `phone-portrait` | 390x844 @3x, touch | gate, list |
| `reduced-motion` | 1440x900 @1x, `prefers-reduced-motion: reduce` | title, rooms, motion, ambient |

`--flow` narrows what a profile runs; it never adds a flow to a profile that does not run it.

| Flow | What it does |
|---|---|
| `title` | Title screen, PRESS START with a film strip of the zoom, the overworld, browser Back to the title. The zoom must end with the title's island exactly on the stage (`zoom-lands`), so nothing jumps when the overworld takes over. |
| `world` | Overworld loaded directly: HUD links, the pointer on each location, a window resize, the debug overlay. |
| `rooms` | Enters each room by clicking its location (film strip for `experience`), opens every dialog hotspot and closes it with Escape (the first one also with BACK), opens the first item of each Skills shelf, checks link hotspots, takes the debug overlay, leaves through the doorway. |
| `deeplinks` | Loads `#/world`, every room and one item per room straight from the URL (no title screen, no animation). Escape and the browser Back/Forward buttons from a deep-linked item, the whole way in by clicking and Back three times, the breadcrumb, unknown routes, and the old address of an item that has moved (`#/about/portrait` leads to `#/about/me`). |
| `keyboard` | Title, overworld, a room, a dialog and back out with only Tab, Enter, Space and Escape: skip link first, visible focus at each step, focus moved into each new scene, Tab order, focus trap, focus returned to the hotspot. |
| `list` | `#/list`: full-page screenshot, every experience entry and project from `src/constants/index.tsx` is named, headings, link back to the world. |
| `gate` | The rotate screen: shown in portrait on a phone (title and world), its list link works, not shown on `#/list`, goes away and comes back when the device is turned. |
| `motion` | Under reduced motion, samples the stage, scene roots, layers and scene images every frame during five transitions: nothing may scale or move, cross-fades stay short, the pointer does not blink. |
| `ambient` | What is drawn and moves unasked. **The ground:** title screen, overworld and a room at the profile's own shape, then (not on phones) in a 2200x600 and a 720x1200 window: the ground's tiles are swapped for a test pattern and a screenshot is searched for any band of plain ground color around the stage (`ground-covers`); in the broad bands of the two extra shapes the real screenshot must show the ground's own waves or tufts (`ground-texture`). **The sea:** screenshots of a piece of open sea half a second apart must differ (`sea-moves`), or under reduced motion be identical (`sea-still`). **The character:** he is watched frame by frame and must show exactly the frames `mascot.json` lists for the pose, in its order, at about its rate (`character-idle-frames`, `character-wave-frames`), one frame under reduced motion; he waves when pointed at, opens `#/about/me` by click and by Tab and Enter, and keeps waving behind his dialog. |

## What happens at a stop

A run is a series of named stops such as `desktop/rooms/experience/dialog-shopify`. At each one the
harness:

1. waits until `[data-stage][data-transition="idle"]` (plus the expected URL, scene and dialog) has
   held for 120 ms, at most 5 s (the site says idle only once the scene's picture, ground tiles and
   character are decoded);
2. saves a screenshot to `shots/<profile>/<flow>-<stop>.png`;
3. runs the generic checks below;
4. adds the checks that belong to that step of the flow (for example `dialog-opens`, `escape-closes`).

A missing contract element is recorded as a failure and the walk goes on. If a click does not lead
where it should, the failure is recorded and the harness sets the URL itself so the rest of the room
can still be checked. A site with none of the `data-*` attributes fails fast instead of waiting 5 s at
every stop, and a stage that stops settling ends that flow early with a `flow-stopped` failure.

## Output

```
qa/out/<run>/
  report.md      for people: summary tables, repeated problems, every failure and warning
  report.json    for tools: every stop, check, status, message and screenshot path
  shots/<profile>/<flow>-<stop>.png
  shots/<profile>/<flow>-<name>-frame1..6.png and ...-strip.png   film strips
  dist/          the production build (preview mode only)
qa/out/latest -> the newest timestamped run
```

`qa/out/` is git-ignored.

### Reading report.md

- **Result line and Summary**: pass, warn and fail counts per profile and per flow.
- **Repeated problems**: the same check and message at several stops, most frequent first. Start
  here: one bug usually explains many lines.
- **Failures** and **Warnings**: grouped by stop, each stop with its screenshot path. Open the
  screenshot next to the message.
- **Film strips**: for the title zoom and for entering `experience`, six frames over the first second
  after the click. Open the `-strip.png` contact sheet to judge the motion; the table also says how
  long the stage reported `running` and the largest scale seen.
- **All stops**: every stop with its screenshot, including the ones that passed. Dialogs that scroll
  have a second `-end.png` shot of the bottom, and `list` has a `-full.png` of the whole page.

Only `fail` affects the exit code. `warn` marks things to look at: palette misses and items that are
in the brief but not on the hard checklist.

## Checks

At every stop:

| Check | Fails when |
|---|---|
| `settled` | The stage did not report idle at the expected route, scene and dialog within 5 s. |
| `console-clean` | Console errors, uncaught errors, failed or 4xx/5xx requests since the previous stop. |
| `no-horizontal-scroll` | The page is wider than the viewport. (`no-vertical-scroll` is a warning on world views.) |
| `fonts` | Press Start 2P or VT323 is not declared, failed to load, or is used by visible text but not loaded. Warns when one is declared but never loaded, and on faux bold or italic. |
| `route` | `data-route` is missing or differs from the URL. |
| `scene`, `scene-dialog` | Not exactly one visible `data-scene`, or it (or the open dialog) does not match the URL. |
| `scale` | `data-k` missing, `k x devicePixelRatio` not whole, stage not `320k x 180k`, outside the viewport or under the HUD. |
| `scale-fit` | `k` larger than the rule allows. Warns when `k` is smaller than it could be, the stage is off-center or does not start on a whole device pixel. |
| `art-smooth` | An `<img>` or background image in the stage is `image-rendering: pixelated` (the high-definition art is scaled smoothly), or has not loaded. |
| `art-hd`, `art-placed` | The scene does not have exactly one picture, or it is not the size `backdrops.json` gives (1376x768); at rest it is not drawn across the whole stage (on the title screen: in `overworldRect` of `title.json`). |
| `ground`, `ground-size` | The scene has no visible `[data-ground]`, it is the wrong one (sea for the title screen and the overworld, grass for a room), it leaves part of the area below the HUD uncovered, its base color or its tiles are not what `backdrops.json` lists (file, size in scene units x `k`, repeating, loaded, smooth); a tile layer is laid out much larger than the window. |
| `ground-motion` | A ground with two frames has no running animation, an animation changes anything but `transform` and `opacity` (that would paint the view again every frame), or anything runs under reduced motion. |
| `character`, `character-pose`, `character-motion` | In the cottage: no visible `[data-character]`, it does not name its hotspot (`me`), its sheet is not the size `mascot.json` describes, it is not drawn at `size` with its bottom center on `anchor`, it shows a frame that is not in the list for its pose; it does not wave with its dialog open or focus on it, or waves when nothing calls for it; its animation is missing, or runs under reduced motion. |
| `hud`, `breadcrumb` | No HUD bar across the top, not 24 to 48 px tall, content overflowing or wrapping; breadcrumb `<nav>` missing or without the links for this route. |
| `regions-file` | The scene's regions file is missing or invalid (placement is then unchecked). |
| `hotspots-present` | A region has no `[data-hotspot]`, has several, or it is not a real `<button>` or `<a href>`. |
| `hotspots-placed` | A hotspot is more than 1.5 px off its `box x k + stage offset` (small ones may be padded evenly up to 24 px). Skipped while a dialog is open, because the camera has moved. |
| `hotspots-size`, `hotspots-named` | A hotspot is under 24x24 CSS px, or has no accessible name. |
| `labels-inside`, `labels-overlap`, `labels-present` | A visible label leaves the stage, two overlap, or a location or object has no visible label (`EXIT` for the doorway). |
| `dialog-not-clipped`, `dialog-a11y` | Dialog content is cut off or spills out of the box (scrolling inside is fine); `role`, `aria-modal` or the label is missing. |
| `rotate-gate` | The rotate screen shows where it should not, or does not cover the screen where it should. |
| `cursor` | The page sets `cursor: none`. |
| `palette` (warning) | A text, background, border, outline or shadow color in the HUD, dialog, labels, list view or rotate screen is not in `art/scripts/nes-palette.mjs`, or is see-through. The art inside those (a ground, the character) is skipped, and a label may also use the colors the page declares for plates painted in the art (`--color-plate-*`). |
| `page-background` (warning) | The page behind the scene is not its ground's base color from `backdrops.json` (sea for the title screen and the overworld, grass for a room); `theme-color` is not the sea color; or the color `index.html` paints before the app loads is not the one for the address the page was opened at. |

Flow checks have plain names: `press-start-works`, `transition-reported`, `zoom-lands`, `enter-room`,
`dialog-opens`, `escape-closes`, `back-button-closes`, `focus-returns`, `links-real`, `exit-door`,
`deeplink-immediate`, `escape-up`, `browser-back`, `unknown-route-replaced`, `moved-route`,
`skip-link-first`, `focus-visible`, `focus-trap`, `tab-reaches-all`, `list-names`, `gate-list-link`,
`no-moving-transforms`, `pointer-steady`, `ground-covers`, `ground-texture`, `sea-moves`, `sea-still`,
`character-waves`, `character-opens`, `character-keyboard` and so on. Each message says what was
expected and what was found.

## Where expectations come from

- Routes, profiles, flows, attributes: `ENGINE.md`.
- The art: `art/approved/hd/backdrops.json` (picture size; each ground's color, tile size and
  frames), `art/approved/hd/mascot.json` (the character's sheet, size, anchor and animations) and
  `art/approved/title.json` (`overworldRect`). Read at the start of every run (`qa/lib/art.mjs`), so
  new art is checked against its own description. The character's scene and hotspot (`about`, `me`),
  the moved address and the two extra window shapes are in `qa/lib/config.mjs`.
- Hotspots: `art/approved/overworld.regions.json` (top-level region ids) and
  `art/approved/<room>.regions.json` (every region id except those starting with `spare`, plus
  `<id>-<index>` for each entry of `items`). Whether a hotspot is a link, a dialog or the doorway is
  read from the page: `<a>` is a link, `door` is the doorway, the rest open dialogs.
- Names for the list view: `src/constants/index.tsx`, read as text.
- Colors: `art/scripts/nes-palette.mjs`.

## Testing the harness itself

`node qa/selftest/run.mjs` runs the harness against `qa/selftest/fixture.html`, a small stand-in app
that follows the contract (it is not the site). The clean fixture must pass every profile with no
failures and no warnings, about 45 seeded bugs must each be caught by the check meant for them
(among them old low-resolution pictures, a pixelated picture, a ground that stops at the old
picture's edge, a sea that stands still or moves under reduced motion, a missing or frozen
character), and a dead server and missing regions files must end in a report. Run it after changing
anything under `qa/lib/`. It takes about five minutes.

## Layout

```
qa/walk.mjs            entry point: options, server, profiles, report, exit code
qa/lib/config.mjs      profiles, flows, limits
qa/lib/server.mjs      free port, build, preview or dev server, shutdown
qa/lib/session.mjs     one profile: pages, waiting, stop(), clicking, film strips
qa/lib/inpage.mjs      script injected into every page: state log, per-frame sampler, inspect()
qa/lib/checks.mjs      the generic checks
qa/lib/flows/*.mjs     one file per flow
qa/lib/regions.mjs     expected hotspots      qa/lib/content.mjs   names from src/constants
qa/lib/art.mjs         the art's description  qa/lib/images.mjs    pixel diff, region stats, contact sheets
qa/lib/sampling.mjs    motion analysis
qa/lib/report.mjs      report.json and report.md
qa/selftest/           fixture app and the self-test runner
```
