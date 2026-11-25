// ambient: what is drawn and moves without being asked. The ground (sea or grass) covers the whole
// view at every window shape, the sea moves a little and holds still under reduced motion, and the
// character stands in the cottage, plays the frames his sprite sheet lists, waves, and opens his dialog.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CHARACTER, GROUND_SHAPES, STEP_MS, groundFor } from '../config.mjs';
import { fmt, sleep, summarize } from '../util.mjs';
import { checkPointer, focusInfo, pressKey } from './common.mjs';

const TITLE = { route: '/', scene: 'title' };
const WORLD = { route: '/world', scene: 'world' };

/** The four strips of the view around the stage, below the HUD, in CSS px. Empty ones are left out. */
function bandsAround(facts) {
  const { w: vw, h: vh } = facts.viewport;
  const top = facts.hud && facts.hud.visible ? facts.hud.rect.y + facts.hud.rect.h : 0;
  const s = facts.stage.rect;
  return [
    { name: 'left of the stage', x: 0, y: top, w: s.x, h: vh - top },
    { name: 'right of the stage', x: s.x + s.w, y: top, w: vw - s.x - s.w, h: vh - top },
    { name: 'above the stage', x: s.x, y: top, w: s.w, h: s.y - top },
    { name: 'below the stage', x: s.x, y: s.y + s.h, w: s.w, h: vh - s.y - s.h },
  ].filter((band) => band.w >= 1 && band.h >= 1);
}

const inDevicePx = (band, dpr) => ({ name: band.name, x: band.x * dpr, y: band.y * dpr, w: band.w * dpr, h: band.h * dpr });
const sized = (band) => `${fmt(band.w)}x${fmt(band.h)} px`;

/**
 * The ground reaches every edge of the window. Its tiles are swapped for a loud test pattern, a
 * screenshot is taken, and the strips around the stage (where the old pictures ended and a flat
 * color began) are searched for the ground's plain base color: any of it is ground with no tile.
 */
async function groundCovers(s, page, stop, scene) {
  const facts = stop.facts;
  const ground = s.run.art?.grounds?.[groundFor(scene)];
  if (!facts?.stage || !ground) return; // the generic ground check has already said why
  const bands = bandsAround(facts);
  if (!bands.length) {
    stop.pass('ground-covers', 'the stage fills the view: there is no room around it for a flat band');
    return;
  }
  const regions = bands.map((band) => inDevicePx(band, facts.viewport.dpr));
  let probe = null;
  let png = null;
  let stats = null;
  let flat = [];
  try {
    probe = await page.evaluate(() => window.__qa.groundProbe(true)).catch(() => null);
    // The browser may paint the swapped tiles a piece at a time, so an early screenshot could
    // still show some of the plain color underneath. A band that is really bare stays bare: look
    // up to three times, and only what is still flat at the end counts.
    for (let look = 0; probe?.layers && look < 3; look++) {
      await sleep(look === 0 ? 60 : 300);
      png = await page.screenshot({ timeout: STEP_MS }).catch(() => null);
      stats = png ? await s.images.stats(png, regions, ground.color).catch(() => null) : null;
      if (!stats) continue;
      flat = [];
      stats.forEach((stat, i) => {
        if (stat.total && stat.flat / stat.total > 0.01) {
          flat.push(`${bands[i].name} (${sized(bands[i])}) is ${fmt((100 * stat.flat) / stat.total)}% the plain ${ground.id} color ${ground.hex}: no tile is painted there`);
        }
      });
      if (!flat.length) break;
    }
  } finally {
    await page.evaluate(() => window.__qa.groundProbe(false)).catch(() => {});
  }
  if (!probe?.layers) {
    stop.fail('ground-covers', 'the ground paints no tile image that could be looked for in a screenshot: around the stage there is only a flat color');
    return;
  }
  if (!stats) {
    stop.fail('ground-covers', 'the screenshot of the ground could not be read');
    return;
  }
  if (flat.length) {
    const file = s.shotPath(stop.record.name, '-probe');
    await writeFile(file, png)
      .then(() => (stop.record.extraShots = [...(stop.record.extraShots ?? []), s.rel(file)]))
      .catch(() => {});
    stop.fail('ground-covers', `with the ground's tiles swapped for a test pattern: ${summarize(flat)}`, flat);
  } else {
    stop.pass('ground-covers', `the ${ground.id} is tiled to the edges of the window: no flat band in the ${bands.length} strip(s) around the stage (${bands.map(sized).join(', ')})`);
  }
}

/**
 * The same strips in the screenshot as the visitor sees it, where one is broad enough that a tile's
 * worth of waves or tufts must fall in it: it shows them, it is not one flat color.
 */
async function groundTexture(s, stop, scene, shape) {
  const facts = stop.facts;
  const ground = s.run.art?.grounds?.[groundFor(scene)];
  if (!facts?.stage || !ground || !stop.record.screenshot) return;
  const k = Number(facts.stage.dataK);
  if (!(k > 0)) return;
  const tileArea = ground.tile[0] * ground.tile[1] * k * k;
  const broad = bandsAround(facts).filter((band) => Math.min(band.w, band.h) >= 48 * k && band.w * band.h >= tileArea);
  if (!broad.length) {
    stop.fail('ground-texture', `at ${shape.width}x${shape.height} no strip around the stage is broad enough to judge the ground's texture in: the shape no longer suits the stage`);
    return;
  }
  let stats = null;
  try {
    const png = await readFile(path.join(s.run.dir, stop.record.screenshot));
    stats = await s.images.stats(png, broad.map((band) => inDevicePx(band, facts.viewport.dpr)));
  } catch {
    stats = null;
  }
  if (!stats) {
    stop.fail('ground-texture', 'the screenshot of the ground could not be read');
    return;
  }
  const bare = [];
  stats.forEach((stat, i) => {
    if (!stat.total || stat.other / stat.total < 0.0005) bare.push(`${broad[i].name} (${sized(broad[i])}) is one flat color: none of the ${ground.id}'s ${ground.id === 'ocean' ? 'waves' : 'tufts'} show there`);
  });
  if (bare.length) stop.fail('ground-texture', summarize(bare), bare);
  else stop.pass('ground-texture', `the ${ground.id}'s own texture shows in the ${broad.length} broad strip(s) around the stage (${stats.map((stat) => `${fmt((100 * stat.other) / stat.total)}% of pixels`).join(', ')})`);
}

/** A part of the view that only ever shows sea: the largest strip around the stage, or the stage's top left corner. */
function seaWindow(facts) {
  const bands = bandsAround(facts).sort((a, b) => b.w * b.h - a.w * a.h);
  const { w: vw, h: vh } = facts.viewport;
  let box = bands[0] && bands[0].w * bands[0].h >= 4000 ? bands[0] : null;
  if (!box) {
    const k = Number(facts.stage.dataK) || 1;
    box = { name: 'the top left corner of the stage', x: facts.stage.rect.x + k, y: facts.stage.rect.y + k, w: 48 * k, h: 14 * k };
  }
  // No more than is needed: a quarter of a million pixels of sea show plenty of waves.
  const w = Math.min(box.w, 640);
  const h = Math.min(box.h, 400);
  const clip = { x: Math.max(0, Math.round(box.x)), y: Math.max(0, Math.round(box.y)), width: Math.floor(Math.min(w, vw - box.x)), height: Math.floor(Math.min(h, vh - box.y)) };
  return clip.width > 4 && clip.height > 4 ? { clip, name: box.name } : null;
}

/** The sea moves between two screenshots; under reduced motion it does not. */
async function seaMotion(s, page, stop) {
  const facts = stop.facts;
  if (!facts?.stage) return;
  const window = seaWindow(facts);
  if (!window) return;
  const shoot = () => page.screenshot({ clip: window.clip, timeout: STEP_MS }).catch(() => null);
  const dpr = facts.viewport.dpr;
  const region = { x: 0, y: 0, w: window.clip.width * dpr, h: window.clip.height * dpr };
  const first = await shoot();
  if (!first) return;
  const reduced = !!facts.env.reducedMotion;
  // Under reduced motion one long look is enough. Otherwise look every half second for a few
  // seconds: the sea rests at each end of its sway, so one short gap may show nothing.
  const waits = reduced ? [1200] : [500, 500, 500, 500, 500, 500];
  let waited = 0;
  let most = 0;
  for (const ms of waits) {
    await sleep(ms);
    waited += ms;
    const next = await shoot();
    const diff = next ? await s.images.diff(first, next, region).catch(() => null) : null;
    if (!diff) continue;
    most = Math.max(most, diff.changed);
    if (!reduced && diff.changed >= 20 * dpr * dpr) break;
  }
  if (reduced) stop.expect('sea-still', most === 0, `under reduced motion the sea did not change in ${waited} ms (${window.name})`, `under reduced motion the sea changed: ${most} pixels differ after ${waited} ms in ${window.name}`);
  else {
    stop.expect(
      'sea-moves',
      most >= 20 * dpr * dpr,
      `the sea moves: ${most} pixels changed within ${waited} ms in ${window.name}`,
      `the sea does not move: at most ${most} pixels changed in ${waited} ms in ${window.name}`,
    );
  }
}

/**
 * Watches the character play one animation and compares what he showed with mascot.json: only
 * frames from its list, all of them, in its order, at about its rate. Under reduced motion: one frame.
 */
async function watchFrames(s, page, stop, pose) {
  const sprite = s.run.art?.mascot;
  if (!sprite) return;
  const animation = sprite.animations[pose];
  const reduced = !!stop.facts?.env.reducedMotion;
  const cycle = (animation.frames.length / animation.fps) * 1000;
  const ms = Math.min(4000, Math.max(900, Math.round(1.6 * cycle)));
  const seen = await page.evaluate((t) => window.__qa.watchCharacter(t), ms).catch(() => null);
  const id = `character-${pose}-frames`;
  if (!seen || !seen.found) {
    stop.fail(id, 'the character could not be watched: no visible [data-character] with a sprite sheet');
    return;
  }
  const list = seen.frames.join(', ');
  if (reduced) {
    const rest = sprite.animations.idle.frames[0];
    stop.expect(id, seen.frames.length === 1 && seen.frames[0] === rest, `under reduced motion he stood still on frame ${rest} for ${ms} ms`, `under reduced motion he showed frames ${list} in ${ms} ms, expected only frame ${rest}`);
    return;
  }
  const problems = [];
  const wanted = [...new Set(animation.frames)];
  const stray = [...new Set(seen.frames.filter((frame) => !animation.frames.includes(frame)))];
  if (seen.poses.some((p) => p !== pose)) problems.push(`his pose changed while he was watched (${seen.poses.join(', ')})`);
  if (stray.length) problems.push(`he showed frame(s) ${stray.join(', ')}, which are not in mascot.json's ${pose} list (${animation.frames.join(', ')})`);
  const missing = wanted.filter((frame) => !seen.frames.includes(frame));
  if (missing.length) problems.push(`he never showed frame(s) ${missing.join(', ')} of mascot.json's ${pose} list (${animation.frames.join(', ')}) in ${ms} ms; he showed ${list}`);
  if (!stray.length && wanted.length > 1) {
    // Each change of frame is a step along the list (which loops).
    const steps = new Set(animation.frames.map((frame, i) => `${frame}>${animation.frames[(i + 1) % animation.frames.length]}`));
    const wrong = [];
    for (let i = 1; i < seen.frames.length; i++) if (!steps.has(`${seen.frames[i - 1]}>${seen.frames[i]}`)) wrong.push(`${seen.frames[i - 1]} to ${seen.frames[i]}`);
    if (wrong.length) problems.push(`the frames did not follow mascot.json's order (${animation.frames.join(', ')}): he went from ${[...new Set(wrong)].join(', ')}`);
    // The rate: about fps changes a second. Loose, because the watch starts and ends mid-frame.
    const changes = seen.frames.length - 1;
    const repeats = animation.frames.filter((frame, i) => frame === animation.frames[(i + 1) % animation.frames.length]).length;
    const expected = (ms / 1000) * animation.fps * (1 - repeats / animation.frames.length);
    if (changes < 0.5 * expected - 1 || changes > 1.6 * expected + 1) problems.push(`he changed frame ${changes} times in ${ms} ms, but ${animation.fps} frames a second would be about ${fmt(expected)}`);
  }
  if (problems.length) stop.fail(id, summarize(problems), problems);
  else stop.pass(id, `the ${pose} animation shows mascot.json's frames (${animation.frames.join(', ')}) in order at about ${animation.fps} a second: ${list}`);
}

async function grounds(s) {
  const touch = !!s.profile.touch;
  const own = { width: s.profile.width, height: s.profile.height };

  // The title screen: the sea, moving.
  {
    const page = await s.fresh('/');
    const stop = await s.stop(page, 'title', { expect: TITLE });
    await groundCovers(s, page, stop, 'title');
    await seaMotion(s, page, stop);
  }

  // The overworld (sea) and a room (grass), at the profile's own shape and, where a window can
  // change shape, much wider and much taller than the stage.
  const places = [
    ['world', WORLD],
    ['room', { route: `/${CHARACTER.scene}`, scene: CHARACTER.scene, dialog: null }],
  ];
  for (const [name, expect] of places) {
    s.guard();
    const page = await s.fresh(expect.route);
    const stop = await s.stop(page, name, { expect });
    await groundCovers(s, page, stop, expect.scene);
    if (expect.scene === 'world') await seaMotion(s, page, stop);
    if (touch) continue; // a phone has the one shape
    for (const [shapeName, shape] of Object.entries(GROUND_SHAPES)) {
      s.guard();
      await page.setViewportSize(shape).catch(() => {});
      const at = await s.stop(page, `${name}-${shapeName}`, { expect, resized: true });
      at.record.viewport = shape;
      await groundCovers(s, page, at, expect.scene);
      await groundTexture(s, at, expect.scene, shape);
    }
    await page.setViewportSize(own).catch(() => {});
    await s.settle(page, expect);
  }
}

async function character(s) {
  const { scene: room, hotspot: id } = CHARACTER;
  const here = { route: `/${room}`, scene: room, dialog: null };
  const open = { route: `/${room}/${id}`, scene: room, dialog: id };

  // At rest: there, named, labelled, idling.
  const page = await s.fresh(here.route);
  const rest = await s.stop(page, 'character', { expect: here });
  const hotspot = rest.facts?.hotspots.find((h) => h.id === id && h.visible);
  const label = rest.facts?.labels.find((l) => l.for === id && l.visible);
  rest.expect('character-label', !!label && /^about me$/i.test(label.text), 'his label reads ABOUT ME', label ? `his label reads "${label.text}", expected ABOUT ME` : `no visible label for "${id}"`);
  rest.expect(
    'character-name',
    !!hotspot && hotspot.tag === 'BUTTON' && /about me/i.test(hotspot.name),
    `he is a button named "${hotspot?.name}"`,
    hotspot ? `his hotspot is a <${hotspot.tag.toLowerCase()}> named "${hotspot.name}", expected a button whose name contains "About me"` : `no visible [data-hotspot="${id}"]`,
  );
  await watchFrames(s, page, rest, 'idle');

  // Pointed at (the mouse, or focus where there is no mouse): he waves.
  const pointed = await s.hoverHotspot(page, id);
  if (!pointed.ok) rest.fail('character-waves', `he could not be pointed at: ${pointed.message}`);
  else {
    const waving = await s.stop(page, 'character-pointed', { expect: here, keepMouse: true });
    const how = pointed.how === 'hover' ? 'the pointer is over him' : 'focus is on him';
    const pose = waving.facts?.characters.find((c) => c.visible)?.pose;
    if (!waving.facts?.env.reducedMotion) waving.expect('character-waves', pose === 'wave', `he waves while ${how}`, `while ${how} his pose is "${pose}", expected "wave"`);
    checkPointer(waving, id, pointed.how);
    await watchFrames(s, page, waving, 'wave');
  }

  // Clicked: his dialog opens at #/about/me, and he keeps waving behind it with the mouse gone.
  const opened = await s.travel(page, () => s.clickHotspot(page, id), open, { fallback: open.route });
  if (opened.repaired) await s.settle(page, open);
  const dialog = await s.stop(page, 'character-dialog', { expect: open });
  dialog.expect('character-opens', opened.ok, `clicking him opened #${open.route} (${opened.ms} ms)`, `clicking him did not open #${open.route}: ${opened.problem}`);
  const title = dialog.facts?.dialog?.labelText ?? '';
  dialog.expect('character-dialog-is-about', /alex\s*yan/i.test(title), `the dialog is the About Me one, titled "${title}"`, `the dialog is titled "${title}", expected the About Me dialog (the name)`);
  const closed = await s.travel(page, pressKey(page, 'Escape'), here, { fallback: here.route });
  if (closed.repaired) await s.settle(page, here);

  // By keyboard alone, from a page nothing has been clicked on: Tab reaches him, Enter opens him.
  const keys = await s.fresh(here.route);
  await s.settle(keys, here);
  let reached = false;
  const trail = [];
  for (let i = 0; i < 40 && !reached; i++) {
    s.guard();
    await keys.keyboard.press('Tab');
    const focus = await focusInfo(keys);
    trail.push(focus?.desc ?? '?');
    reached = focus?.hotspot === id;
  }
  const focused = await s.stop(keys, 'character-focus', { expect: here, keepMouse: true });
  focused.expect('character-tab', reached, `Tab reaches him (${trail.length} presses)`, `Tab did not reach him in ${trail.length} presses; focus went through ${summarize([...new Set(trail)], 8)}`);
  if (reached) {
    const ring = focused.facts?.focus;
    focused.expect('character-focus-visible', !!ring && (!!ring.outline || ring.boxShadow) && !!ring.pointer, 'focus on him shows a ring and the pointer', `focus on him shows ${ring?.outline ? 'a ring' : 'no ring'} and ${ring?.pointer ? 'the pointer' : 'no pointer'}`);
    const entered = await s.travel(keys, pressKey(keys, 'Enter'), open, { fallback: open.route });
    if (entered.repaired) await s.settle(keys, open);
    const viaKeys = await s.stop(keys, 'character-enter', { expect: open, keepMouse: true });
    viaKeys.expect('character-keyboard', entered.ok, `Enter on him opened #${open.route}`, `Enter on him did not open #${open.route}: ${entered.problem}`);
    const back = await s.travel(keys, pressKey(keys, 'Escape'), here, { fallback: here.route });
    if (back.repaired) await s.settle(keys, here);
    const after = await focusInfo(keys);
    viaKeys.expect('focus-returns', after?.hotspot === id, 'Escape closed his dialog and focus returned to him', `after his dialog closed focus is on ${after?.desc ?? 'nothing'}, expected him`);
  }
}

export async function ambient(s) {
  await grounds(s);
  await character(s);
}
