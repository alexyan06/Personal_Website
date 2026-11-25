// keyboard: the whole trip (title, overworld, a room, a dialog, back out) with only Tab, Enter, Space and Escape.
import { clip, sleep, summarize } from '../util.mjs';
import { checkSceneFocus, firstDialog, focusInfo, pressKey } from './common.mjs';

const TITLE = { route: '/', scene: 'title' };
const WORLD = { route: '/world', scene: 'world' };
const ROOM = 'experience';

/** Presses Tab until `test(focus)` is true. Returns the keys' trail so a failure can say where focus went. */
async function tabUntil(s, page, test, max = 60) {
  const trail = [];
  for (let i = 0; i < max; i++) {
    s.guard();
    await page.keyboard.press('Tab');
    const info = await focusInfo(page);
    trail.push(info ? info.desc : '?');
    if (info && !info.none && test(info)) return { ok: true, info, presses: i + 1, trail };
  }
  return { ok: false, trail };
}

const short = (trail) => summarize([...new Set(trail)], 8);

/**
 * Is the focus indicator visible? Moves focus away with Shift+Tab and back with Tab, and compares
 * the pixels around the element between the two screenshots.
 */
async function checkFocusVisible(s, page, stop, id = 'focus-visible') {
  const target = await focusInfo(page);
  if (!target || target.none) {
    stop.fail(id, 'nothing is focused, so there is no focus indicator to look for');
    return;
  }
  const sameSpot = (a, b) => !!a && !!b && !a.none && !b.none && a.desc === b.desc && Math.abs(a.rect.x - b.rect.x) < 1 && Math.abs(a.rect.y - b.rect.y) < 1;
  await page.keyboard.press('Shift+Tab');
  await sleep(80);
  const away = await focusInfo(page);
  const before = await page.screenshot().catch(() => null);
  await page.keyboard.press('Tab');
  await sleep(150);
  const back = await focusInfo(page);
  let after = await page.screenshot().catch(() => null);
  const styles = [back?.outline ? `outline ${back.outline}` : null, back?.boxShadow ? 'a box-shadow' : null, back?.pointer ? 'the pointer' : null].filter(Boolean);
  // No comparison is possible when focus could not leave (a dialog with one control) or did not come back.
  const same = sameSpot(back, target) && !sameSpot(away, target);

  if (!same || !before || !after) {
    // Could not compare pictures; fall back to what the styles say.
    if (styles.length) stop.pass(id, `${target.desc} shows ${styles.join(' and ')} when focused (judged from styles)`);
    else stop.fail(id, `${target.desc} has no outline, box-shadow or pointer when focused`);
    return;
  }
  const dpr = s.profile.dpr;
  const pad = 16;
  let x0 = back.rect.x - pad;
  let y0 = back.rect.y - pad;
  let x1 = back.rect.x + back.rect.w + pad;
  let y1 = back.rect.y + back.rect.h + pad;
  if (back.pointer) {
    x0 = Math.min(x0, back.pointer.x - 2);
    y0 = Math.min(y0, back.pointer.y - 2);
    x1 = Math.max(x1, back.pointer.x + back.pointer.w + 2);
    y1 = Math.max(y1, back.pointer.y + back.pointer.h + 2);
  }
  const region = { x: x0 * dpr, y: y0 * dpr, w: (x1 - x0) * dpr, h: (y1 - y0) * dpr };
  let diff = await s.images.diff(before, after, region).catch(() => null);
  if (diff && diff.changed < 8 * dpr * dpr) {
    // A blinking pointer may have been in its hidden half: look once more.
    await sleep(520);
    after = await page.screenshot().catch(() => null);
    const second = after ? await s.images.diff(before, after, region).catch(() => null) : null;
    if (second && second.changed > diff.changed) diff = second;
  }
  if (!diff) {
    if (styles.length) stop.pass(id, `${target.desc} shows ${styles.join(' and ')} when focused (judged from styles)`);
    else stop.fail(id, `${target.desc} has no outline, box-shadow or pointer when focused`);
    return;
  }
  const enough = diff.changed >= 8 * dpr * dpr;
  stop.expect(
    id,
    enough,
    `${target.desc} looks different when focused (${diff.changed} pixels change${styles.length ? `: ${styles.join(' and ')}` : ''})`,
    `${target.desc} looks the same focused and unfocused (${diff.changed} pixels differ), so keyboard users cannot see where they are`,
  );
}

/** Tab order should follow reading order: never jump to something clearly above, or clearly to the left in the same row. */
function orderProblems(order, boxes) {
  const problems = [];
  for (let i = 1; i < order.length; i++) {
    const a = boxes.get(order[i - 1]);
    const b = boxes.get(order[i]);
    if (!a || !b) continue;
    const shared = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (b.y + b.h <= a.y + 0.5) problems.push(`"${order[i]}" comes after "${order[i - 1]}" but sits above it`);
    else if (shared > 0.5 * Math.min(a.h, b.h) && b.x + b.w <= a.x + 0.5) problems.push(`"${order[i]}" comes after "${order[i - 1]}" but sits to its left`);
  }
  return problems;
}

/** Tabs once round the scene and checks that every hotspot is reachable and the order reads left to right, top to bottom. */
async function surveyTabOrder(s, page, stop, scene) {
  const wanted = (s.run.regions[scene]?.hotspots ?? []).map((h) => h.id);
  const facts = stop.facts;
  const present = new Set((facts?.hotspots ?? []).filter((h) => h.visible).map((h) => h.id));
  const targets = wanted.filter((id) => present.has(id));
  if (!targets.length) return;
  const order = [];
  const limit = present.size + 16;
  for (let i = 0; i < limit && order.length < present.size; i++) {
    s.guard();
    await page.keyboard.press('Tab');
    const info = await focusInfo(page);
    if (info?.hotspot && !order.includes(info.hotspot)) order.push(info.hotspot);
    else if (info?.hotspot && order[0] === info.hotspot) break; // been all the way round
  }
  const missed = targets.filter((id) => !order.includes(id));
  stop.expect('tab-reaches-all', missed.length === 0, `Tab reaches all ${targets.length} hotspots: ${clip(order.join(', '), 200)}`, `Tab never reached: ${missed.join(', ')} (it visited ${order.join(', ') || 'no hotspots'})`);
  const boxes = new Map((facts?.hotspots ?? []).filter((h) => h.visible).map((h) => [h.id, h.rect]));
  const problems = orderProblems(order, boxes);
  if (problems.length) stop.warn('tab-order', `Tab order is not reading order: ${summarize(problems, 3)}`, { order, problems });
  else if (order.length > 1) stop.pass('tab-order', 'Tab order follows reading order (left to right, top to bottom)');
}

/**
 * A mouse left resting on one hotspot must not hold the pointer: when the keyboard moves focus on,
 * the pointer goes with it. Rests the mouse on another location, presses Tab, and looks at which of
 * the two the pointer is nearer to. Focus is put back where it was. Not on touch screens (no hover).
 */
async function checkPointerFollowsFocus(s, page, stop) {
  if (s.profile.touch) return;
  const before = await focusInfo(page);
  const parked = (s.run.regions.world?.hotspots ?? []).map((h) => h.id).find((id) => id !== before?.hotspot);
  if (!before?.hotspot || !parked) return;
  const rested = await s.hoverHotspot(page, parked);
  if (!rested.ok) return;
  await sleep(80);
  await page.keyboard.press('Tab');
  await sleep(120);
  const now = await focusInfo(page);
  const box = await page.evaluate((id) => (window.__qa ? window.__qa.hit({ hotspot: id }) : null), parked).catch(() => null);
  if (now?.hotspot && now.hotspot !== parked && box?.x != null) {
    const gap = (rect, x, y) => Math.hypot(Math.max(0, rect.x - x, x - (rect.x + rect.w)), Math.max(0, rect.y - y, y - (rect.y + rect.h)));
    const p = now.pointer;
    const toFocused = p ? gap(now.rect, p.x + p.w / 2, p.y + p.h / 2) : Infinity;
    const toParked = p ? Math.hypot(box.x - (p.x + p.w / 2), box.y - (p.y + p.h / 2)) : Infinity;
    stop.expect(
      'pointer-follows-focus',
      !!p && toFocused < toParked,
      `with the mouse resting on "${parked}", Tab to "${now.hotspot}" took the pointer along`,
      p
        ? `with the mouse resting on "${parked}", Tab moved focus to "${now.hotspot}" but the pointer stayed by "${parked}"`
        : `with the mouse resting on "${parked}", Tab moved focus to "${now.hotspot}" and no pointer shows`,
    );
  }
  const size = page.viewportSize();
  if (size) await page.mouse.move(0, size.height - 1).catch(() => {});
  if (now?.hotspot !== before.hotspot) await page.keyboard.press('Shift+Tab');
  await sleep(80);
}

export async function keyboard(s) {
  const page = await s.fresh('/');
  const title = await s.stop(page, 'title', { expect: TITLE });

  // The first Tab stop is the "View as a list" skip link.
  await page.keyboard.press('Tab');
  const first = await focusInfo(page);
  const isSkip = !!first && !first.none && first.tag === 'A' && /#\/list$/.test(first.href || '');
  title.expect('skip-link-first', isSkip, `the first Tab stop is the "${first?.name}" link to #/list`, `the first Tab stop is ${first?.desc ?? 'nothing'}, expected the "View as a list" skip link`);

  // Tab to PRESS START and press Enter.
  const start = first?.pressStart ? { ok: true, info: first, trail: [first.desc] } : await tabUntil(s, page, (f) => f.pressStart, 20);
  const focused = await s.stop(page, 'title-focus', { expect: TITLE, keepMouse: true });
  focused.expect('tab-reaches', start.ok, 'Tab reaches PRESS START', `Tab did not reach PRESS START in 20 presses; focus went through ${short(start.trail)}`);
  let go;
  if (start.ok) {
    await checkFocusVisible(s, page, focused);
    go = await s.travel(page, pressKey(page, 'Enter'), WORLD, { fallback: '/world' });
  } else {
    go = { ok: false, problem: 'PRESS START could not be focused', repaired: true };
    await s.setHash(page, '/world');
  }
  if (go.repaired) await s.settle(page, WORLD);

  const world = await s.stop(page, 'world', { expect: WORLD, keepMouse: true });
  world.expect('enter-starts', go.ok, `Enter on PRESS START went to the overworld (${go.ms} ms)`, `Enter on PRESS START did not go to the overworld: ${go.problem}`);
  if (go.ok) checkSceneFocus(world, 'world');
  await surveyTabOrder(s, page, world, 'world');

  // Tab to a room and press Space.
  const toRoom = await tabUntil(s, page, (f) => f.hotspot === ROOM);
  const worldFocus = await s.stop(page, 'world-focus', { expect: WORLD, keepMouse: true });
  worldFocus.expect('tab-reaches', toRoom.ok, `Tab reaches the "${ROOM}" location`, `Tab did not reach the "${ROOM}" location; focus went through ${short(toRoom.trail)}`);
  let enter;
  if (toRoom.ok) {
    await checkFocusVisible(s, page, worldFocus);
    worldFocus.expect('pointer-on-focus', !!worldFocus.facts?.pointer?.visible, 'the pointer shows on the focused location', 'no visible [data-pointer] while a location has keyboard focus');
    await checkPointerFollowsFocus(s, page, worldFocus);
    enter = await s.travel(page, pressKey(page, 'Space'), { route: `/${ROOM}`, scene: ROOM, dialog: null }, { fallback: `/${ROOM}` });
  } else {
    enter = { ok: false, problem: 'the location could not be focused', repaired: true };
    await s.setHash(page, `/${ROOM}`);
  }
  const inRoom = { route: `/${ROOM}`, scene: ROOM, dialog: null };
  if (enter.repaired) await s.settle(page, inRoom);

  const room = await s.stop(page, 'room', { expect: inRoom, keepMouse: true });
  room.expect('space-enters', enter.ok, `Space on the location opened the room (${enter.ms} ms)`, `Space on the location did not open the room: ${enter.problem}`);
  if (enter.ok) checkSceneFocus(room, ROOM);
  await surveyTabOrder(s, page, room, ROOM);

  // Tab to an object and press Enter: the dialog.
  const item = firstDialog(room.facts, s.run.regions, ROOM);
  if (!item) {
    room.fail('keyboard-dialog', `no dialog hotspot was found in the ${ROOM} room, so the dialog part of the trip could not run`);
  } else {
    const open = { route: `/${ROOM}/${item.id}`, scene: ROOM, dialog: item.id };
    const toItem = await tabUntil(s, page, (f) => f.hotspot === item.id);
    const roomFocus = await s.stop(page, 'room-focus', { expect: inRoom, keepMouse: true });
    roomFocus.expect('tab-reaches', toItem.ok, `Tab reaches "${item.id}"`, `Tab did not reach "${item.id}"; focus went through ${short(toItem.trail)}`);
    if (toItem.ok) {
      await checkFocusVisible(s, page, roomFocus);
      const opened = await s.travel(page, pressKey(page, 'Enter'), open);
      const dialog = await s.stop(page, 'dialog', { expect: open, keepMouse: true });
      dialog.expect('enter-opens', opened.ok, `Enter on "${item.id}" opened its dialog (${opened.ms} ms)`, `Enter on "${item.id}" did not open its dialog: ${opened.problem}`);

      if (opened.ok) {
        const inside = dialog.facts?.focus;
        dialog.expect('focus-in-dialog', !!inside && !inside.none && inside.inDialog, `focus moved into the dialog (${inside?.desc})`, `with the dialog open focus is on ${inside?.desc ?? 'nothing'}, expected something inside the dialog`);

        // Focus trap: Tab and Shift+Tab never leave the dialog.
        const count = dialog.facts?.dialog?.focusables ?? 1;
        const escaped = [];
        const visited = new Set();
        const presses = [...Array(Math.min(count + 2, 12)).fill('Tab'), 'Shift+Tab', 'Shift+Tab', 'Shift+Tab'];
        for (const key of presses) {
          await page.keyboard.press(key);
          const f = await focusInfo(page);
          if (!f || f.none || !f.inDialog) escaped.push(`${key} moved focus to ${f?.desc ?? 'nothing'}`);
          else visited.add(f.desc);
        }
        dialog.expect('focus-trap', escaped.length === 0, `Tab and Shift+Tab stay inside the dialog (${visited.size} stop(s) in it)`, `focus left the open dialog: ${summarize([...new Set(escaped)], 3)}`);
        if (!escaped.length) await checkFocusVisible(s, page, dialog);

        // Escape closes it and focus goes back to the hotspot that opened it.
        const closed = await s.travel(page, pressKey(page, 'Escape'), inRoom, { fallback: inRoom.route });
        if (closed.repaired) await s.settle(page, inRoom);
        const after = await s.stop(page, 'dialog-closed', { expect: inRoom, keepMouse: true });
        after.expect('escape-closes', closed.ok, 'Escape closed the dialog', `Escape did not close the dialog: ${closed.problem}`);
        const returned = after.facts?.focus;
        if (closed.ok) {
          after.expect('focus-returns', returned?.hotspot === item.id, `focus returned to "${item.id}"`, `after closing the dialog focus is on ${returned?.desc ?? 'nothing'}, expected the "${item.id}" hotspot that opened it`);
        }

        // Once more, closing with the BACK button from the keyboard.
        if (closed.ok && returned?.hotspot === item.id) {
          const reopened = await s.travel(page, pressKey(page, 'Space'), open);
          if (!reopened.ok) after.fail('back-with-keyboard', `Space on "${item.id}" did not open the dialog again: ${reopened.problem}`);
          else {
            const now = await focusInfo(page);
            const isBack = (f) => f.inDialog && /\bback\b/i.test(f.name || '');
            const toBack = now && !now.none && isBack(now) ? { ok: true } : await tabUntil(s, page, isBack, count + 3);
            if (!toBack.ok) after.fail('back-with-keyboard', `Tab did not reach a BACK button in the dialog; focus went through ${short(toBack.trail)}`);
            const viaBack = await s.travel(page, pressKey(page, toBack.ok ? 'Enter' : 'Escape'), inRoom, { fallback: inRoom.route });
            if (viaBack.repaired) await s.settle(page, inRoom);
            if (toBack.ok) after.expect('back-with-keyboard', viaBack.ok, 'Enter on the BACK button closed the dialog', `Enter on the BACK button did not close the dialog: ${viaBack.problem}`);
          }
        }
      }
    }
  }

  // Back out: Tab to the doorway and press Enter.
  const settled = await s.settle(page, inRoom, { timeout: 1500 });
  if (!settled.ok) {
    await s.setHash(page, inRoom.route);
    await s.settle(page, inRoom);
  }
  const toDoor = await tabUntil(s, page, (f) => f.hotspot === 'door');
  const out = await s.travel(page, pressKey(page, toDoor.ok ? 'Enter' : 'Escape'), WORLD, { fallback: '/world' });
  if (out.repaired) await s.settle(page, WORLD);
  const exit = await s.stop(page, 'exit', { expect: WORLD, keepMouse: true });
  exit.expect('tab-reaches', toDoor.ok, 'Tab reaches the doorway', `Tab did not reach the doorway ("door"); focus went through ${short(toDoor.trail)}. Escape was used to leave instead`);
  exit.expect('keyboard-exit', out.ok, `${toDoor.ok ? 'Enter on the doorway' : 'Escape'} led back to the overworld (${out.ms} ms)`, `${toDoor.ok ? 'Enter on the doorway' : 'Escape'} did not lead back to the overworld: ${out.problem}`);
  if (out.ok) checkSceneFocus(exit, 'world');
}
