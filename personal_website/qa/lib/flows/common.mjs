// Helpers shared by the flows.
import { analyzeSamples } from '../sampling.mjs';
import { fmt, summarize } from '../util.mjs';

export const pressKey = (page, key) => async () => {
  await page.keyboard.press(key);
  return { ok: true };
};
export const historyBack = (page) => async () => {
  await page.evaluate(() => history.back());
  return { ok: true };
};
export const historyForward = (page) => async () => {
  await page.evaluate(() => history.forward());
  return { ok: true };
};

export const focusInfo = (page) => page.evaluate(() => (window.__qa ? window.__qa.focusInfo() : null)).catch(() => null);

/**
 * The hotspots of a room, from its regions file and from the page, each with a kind:
 * door, link (a real <a>), item (a Skills shelf item) or dialog.
 */
export function roomHotspots(facts, regions, room) {
  const expected = regions[room]?.hotspots ?? [];
  const dom = facts ? facts.hotspots.filter((h) => h.sceneVisible && (h.scene === room || h.scene === null)) : [];
  const ids = [...new Set([...expected.map((h) => h.id), ...dom.map((h) => h.id)])];
  const items = new Set(expected.filter((h) => h.kind === 'item').map((h) => h.id));
  return ids.map((id) => {
    const el = dom.find((h) => h.id === id && h.visible) || dom.find((h) => h.id === id) || null;
    const shelf = id.replace(/-\d+$/, '');
    let kind = 'dialog';
    if (/^(door|exit)$/.test(id)) kind = 'door';
    else if (el && el.tag === 'A') kind = 'link';
    else if (items.has(id) || (shelf !== id && ids.includes(shelf))) kind = 'item';
    return { id, kind, el, shelf: kind === 'item' ? shelf : null, box: expected.find((h) => h.id === id)?.box ?? null };
  });
}

/** The first hotspot that is known, from the page, to open a dialog. */
export function firstDialog(facts, regions, room) {
  return roomHotspots(facts, regions, room).find((h) => h.kind === 'dialog' && h.el && h.el.visible && h.el.tag === 'BUTTON') ?? null;
}

/** Attaches a finished film strip to a stop and checks that the transition was reported and seen. */
export function recordFilm(stop, film, { reduced, what, expectZoom }) {
  const motion = analyzeSamples(film.sampling);
  stop.record.film = {
    name: film.name,
    sheet: film.sheet,
    frames: film.frames,
    samples: motion.count,
    runningMs: motion.everRunning ? motion.runningMs : null,
    largestScale: Math.round(motion.maxScale * 100) / 100,
  };
  if (!film.frames.length) stop.warn('film-strip', `no frames could be captured for the ${what}`);
  else if (!film.sheet) stop.warn('film-strip', `frames were saved but the contact sheet failed: ${film.sheetError ?? 'unknown error'}`);
  if (reduced || !motion.count) return motion; // reduced motion is judged by the motion flow
  stop.expect(
    'transition-reported',
    motion.everRunning,
    `data-transition said "running" for about ${motion.runningMs} ms during the ${what}`,
    `data-transition never said "running" during the ${what}, so nothing can wait for the camera to finish`,
  );
  if (expectZoom) {
    stop.expect(
      'zoom-seen',
      motion.maxScale >= 1.2,
      `the scene grew to ${fmt(motion.maxScale)}x its size during the ${what}`,
      `no zoom was seen during the ${what}: the scene changed size by at most ${fmt(motion.maxScale)}x`,
      'warn',
    );
  }
  return motion;
}

/** "Loading any route directly renders it immediately with no animation and no title screen." */
export async function checkImmediate(page, stop) {
  const data = await page.evaluate(() => (window.__qa ? { log: window.__qa.log, boot: window.__qa.bootSamples() } : null)).catch(() => null);
  if (!data) return;
  const problems = [];
  const soft = [];
  const log = data.log;
  const title = log.find((e) => e.scenes.includes('title') || e.pressStart);
  if (title) problems.push(`the title screen was shown ${title.t} ms into the load`);
  // The stage may say "running" until the first image has decoded, but once it has been idle
  // a direct load must not start a camera move.
  const appeared = log.findIndex((e) => e.transition !== null);
  const idleAt = log.findIndex((e) => e.transition === 'idle');
  const later = idleAt === -1 ? null : log.slice(idleAt).find((e) => e.transition === 'running');
  if (later) problems.push(`a transition started ${later.t} ms into the load, after the stage had already been idle`);
  if (appeared !== -1 && idleAt !== -1) {
    const waited = log[idleAt].t - log[appeared].t;
    if (waited > 1000) problems.push(`the stage took ${waited} ms to become idle after it appeared (an entrance animation?)`);
    else if (waited > 500) soft.push(`the stage took ${waited} ms to become idle after it appeared`);
  }
  const motion = analyzeSamples(data.boot);
  problems.push(...motion.animated.slice(0, 3));
  const message = problems.length
    ? summarize(problems)
    : soft.length
      ? summarize(soft)
      : `rendered directly: no title screen and no animation${idleAt !== -1 ? ` (idle ${log[idleAt].t} ms after navigation started)` : ''}`;
  stop.add('deeplink-immediate', problems.length ? 'fail' : soft.length ? 'warn' : 'pass', message);
}

/** After a scene change, focus should be in the new scene (ENGINE.md section 8). */
export function checkSceneFocus(stop, scene) {
  const focus = stop.facts?.focus;
  if (!focus) return;
  if (!focus.none && (focus.scene === scene || focus.inStage)) stop.pass('focus-in-scene', `after the scene change focus is on ${focus.desc}`);
  else if (!focus.none && focus.inApp && !focus.inHud) stop.warn('focus-in-scene', `after the scene change focus is on ${focus.desc}, which is outside the ${scene} scene`);
  else stop.fail('focus-in-scene', `after the scene change focus is on ${focus.none ? focus.desc : focus.desc}, expected it to move to the ${scene} scene`);
}

/** The pointer should be showing while `id` is hovered or focused. */
export function checkPointer(stop, id, how) {
  const facts = stop.facts;
  if (!facts) return;
  const pointer = facts.pointer;
  const verb = how === 'hover' ? 'hovered' : 'focused';
  if (!pointer || !pointer.visible) {
    stop.fail('pointer', `no visible [data-pointer] while "${id}" is ${verb}`);
    return;
  }
  const hotspot = facts.hotspots.find((h) => h.id === id && h.visible);
  const k = Number(facts.stage?.dataK) || 1;
  const soft = [];
  if (facts.stage) {
    const s = facts.stage.rect;
    const p = pointer.rect;
    if (p.x < s.x - 1 || p.y < s.y - 1 || p.x + p.w > s.x + s.w + 1 || p.y + p.h > s.y + s.h + 1) soft.push('the pointer is outside the stage');
  }
  if (hotspot) {
    const p = pointer.rect;
    const h = hotspot.rect;
    const gapX = Math.max(0, h.x - (p.x + p.w), p.x - (h.x + h.w));
    const gapY = Math.max(0, h.y - (p.y + p.h), p.y - (h.y + h.h));
    if (Math.hypot(gapX, gapY) > 24 * k) soft.push(`the pointer is ${fmt(Math.hypot(gapX, gapY))} px away from "${id}"`);
  }
  if (soft.length) stop.warn('pointer', summarize(soft));
  else stop.pass('pointer', `[data-pointer] shows while "${id}" is ${verb}`);
}
