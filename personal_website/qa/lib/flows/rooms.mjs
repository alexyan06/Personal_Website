// rooms: enter each room from the overworld, open every dialog, Escape, link hotspots, doorway.
import { ROOMS, STEP_MS } from '../config.mjs';
import { clip, sleep, summarize } from '../util.mjs';
import { checkPointer, focusInfo, pressKey, recordFilm, roomHotspots } from './common.mjs';

const WORLD = { route: '/world', scene: 'world' };

/** Link hotspots must point somewhere real; links into the site itself are fetched. */
async function checkLinks(s, page, stop, links) {
  const problems = [];
  const good = [];
  const base = new URL(s.run.base);
  for (const link of links) {
    const href = (link.el.href || '').trim();
    if (!href || href === '#' || /^javascript:/i.test(href)) {
      problems.push(`"${link.id}" has no real href (${JSON.stringify(link.el.href)})`);
      continue;
    }
    const abs = link.el.abs || href;
    if (/^mailto:/i.test(abs)) {
      if (!/^mailto:[^@\s?]+@[^@\s?]+\.[^@\s?]+/i.test(abs)) problems.push(`"${link.id}" has a malformed mailto: ${abs}`);
      else good.push(`${link.id} → ${abs}`);
      continue;
    }
    let url;
    try {
      url = new URL(abs);
    } catch {
      problems.push(`"${link.id}" href "${href}" is not a valid URL`);
      continue;
    }
    if (url.origin === base.origin && !(url.pathname === base.pathname && url.hash)) {
      try {
        const response = await page.request.get(url.toString(), { timeout: STEP_MS, maxRedirects: 3 });
        const type = response.headers()['content-type'] || '';
        const file = /\.[a-z0-9]{2,5}$/i.test(url.pathname) && !/\.html?$/i.test(url.pathname);
        if (response.status() >= 400) problems.push(`"${link.id}" links to ${url.pathname}, which answers ${response.status()}`);
        else if (file && /text\/html/i.test(type)) problems.push(`"${link.id}" links to ${url.pathname}, but the server answers with the site's HTML page: the file is missing`);
        else good.push(`${link.id} → ${url.pathname} (${response.status()})`);
      } catch (error) {
        problems.push(`"${link.id}" links to ${url.pathname}, which could not be fetched: ${clip(error.message, 100)}`);
      }
    } else good.push(`${link.id} → ${url.origin === base.origin ? url.hash : url.host}`);
  }
  if (problems.length) stop.fail('links-real', summarize(problems), problems);
  else if (links.length) stop.pass('links-real', `${links.length} link hotspot(s) have a real href: ${good.join(', ')}`);
}

/** Opens a dialog by clicking `hotspotId`, records the stop, then closes it with Escape (and once more with BACK). */
async function openAndClose(s, page, room, hotspotId, dialogId, { name, alsoBack = false }) {
  const open = { route: `/${room}/${dialogId}`, scene: room, dialog: dialogId };
  const closed = { route: `/${room}`, scene: room, dialog: null };

  const opened = await s.travel(page, () => s.clickHotspot(page, hotspotId), open);
  const stop = await s.stop(page, name, { expect: open });
  stop.expect('dialog-opens', opened.ok, `clicking "${hotspotId}" opened dialog "${dialogId}" at #/${room}/${dialogId} (${opened.ms} ms)`, `clicking "${hotspotId}" did not open its dialog: ${opened.problem}`);
  if (opened.act?.how === 'keyboard' && !opened.act.coveredByHotspot) {
    stop.fail('hotspot-clickable', `${opened.act.message}, so it was activated with the keyboard instead`);
  }

  // A long dialog scrolls inside itself: also show its end.
  if (stop.facts?.dialog?.scrolls) {
    const scrolled = await page.evaluate(() => window.__qa.scrollDialogToEnd()).catch(() => false);
    if (scrolled) {
      const file = s.shotPath(name, '-end');
      await page.screenshot({ path: file, timeout: STEP_MS }).then(() => (stop.record.extraShots = [s.rel(file)])).catch(() => {});
    }
  }

  const escaped = await s.travel(page, pressKey(page, 'Escape'), closed, { fallback: `/${room}` });
  stop.expect('escape-closes', escaped.ok, `Escape closed the dialog and went back to #/${room}`, `Escape did not close the dialog: ${escaped.problem}`);
  if (escaped.repaired) await s.settle(page, closed);
  else if (opened.ok) {
    const focus = await focusInfo(page);
    stop.expect('focus-returns', focus?.hotspot === hotspotId, `focus returned to "${hotspotId}" after the dialog closed`, `after the dialog closed focus is on ${focus?.desc ?? 'nothing'}, expected the "${hotspotId}" hotspot that opened it`);
  }

  // A double click (or a second tap) on the object must leave its dialog open: the second click
  // lands where the first one was, which is no longer the object but whatever now covers it.
  // The site counts two clicks as a pair when they are under 500 ms apart. With several browsers
  // running at once this walk's own two clicks can drift further apart than that, and then the
  // second one is rightly a new click that closes the dialog. So the gap is measured in the page,
  // and a pair that came out too slow is not judged: the dialog is closed and the pair tried again.
  if (alsoBack && opened.ok && opened.act?.how === 'mouse') {
    const PAIR_MS = 400;
    let twice = null;
    let gap = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.evaluate(() => {
        window.__qaPair = [];
        const note = (event) => {
          window.__qaPair.push(event.timeStamp);
          if (window.__qaPair.length >= 2) window.removeEventListener('click', note, true);
        };
        window.addEventListener('click', note, true);
      });
      twice = await s.travel(
        page,
        async () => {
          await page.mouse.click(opened.act.x, opened.act.y);
          await sleep(150);
          await page.mouse.click(opened.act.x, opened.act.y);
          await sleep(700); // long enough for a dialog that closes again to have gone
          return { ok: true };
        },
        open,
        { fallback: `/${room}` },
      );
      const stamps = await page.evaluate(() => window.__qaPair ?? []).catch(() => []);
      gap = stamps.length >= 2 ? stamps[1] - stamps[0] : null;
      if (twice.ok || (gap !== null && gap < PAIR_MS)) break;
      // Too slow to be a double click: put the room back and try the pair again.
      await s.settle(page, closed);
      twice = null;
    }
    if (twice) {
      stop.expect('double-click-keeps', twice.ok, `a double click on "${hotspotId}" leaves its dialog open`, `a double click on "${hotspotId}" (clicks ${gap === null ? '?' : Math.round(gap)} ms apart) did not leave its dialog open: ${twice.problem}`);
      if (!twice.repaired) {
        const shut = await s.travel(page, pressKey(page, 'Escape'), closed, { fallback: `/${room}` });
        if (shut.repaired) await s.settle(page, closed);
      } else await s.settle(page, closed);
    } else {
      stop.warn('double-click-keeps', `could not click "${hotspotId}" twice within ${PAIR_MS} ms on this machine (last pair ${gap === null ? '?' : Math.round(gap)} ms apart), so the double click was not judged`);
    }
  }

  if (alsoBack && opened.ok) {
    const again = await s.travel(page, () => s.clickHotspot(page, hotspotId), open);
    if (!again.ok) stop.fail('back-button-closes', `the dialog did not open a second time to try its BACK button: ${again.problem}`);
    else {
      const viaBack = await s.travel(
        page,
        async () => {
          const hit = await page.evaluate(() => window.__qa.dialogBackPoint()).catch(() => null);
          if (!hit || !hit.found) return { ok: false, message: 'the dialog has no BACK button' };
          if (!hit.visible || hit.x === null) return { ok: false, message: 'the BACK button is hidden or covered' };
          await page.mouse.click(hit.x, hit.y);
          return { ok: true };
        },
        closed,
        { fallback: `/${room}` },
      );
      stop.expect('back-button-closes', viaBack.ok, 'the BACK button closed the dialog', `the BACK button did not close the dialog: ${viaBack.problem}`);
      if (viaBack.repaired) await s.settle(page, closed);
    }
  }
  return stop;
}

export async function rooms(s) {
  const page = await s.fresh('/world');

  for (const room of ROOMS) {
    s.guard();
    const here = { route: `/${room}`, scene: room, dialog: null };

    // Start from the overworld.
    const onWorld = await s.settle(page, WORLD, { timeout: 1500 });
    if (!onWorld.ok) {
      await s.setHash(page, '/world');
      await s.settle(page, WORLD);
    }

    // Enter by clicking the location. The experience room gets a film strip.
    let film = null;
    const click = () => s.clickHotspot(page, room);
    const entered = await s.travel(
      page,
      room === 'experience'
        ? async () => {
            film = await s.film(page, `enter-${room}`, click);
            return film.result;
          }
        : click,
      here,
      { fallback: `/${room}` },
    );
    if (film) await s.finishFilm(page, film, `overworld to ${room}`);
    if (entered.repaired) await s.settle(page, here);

    const stop = await s.stop(page, room, { expect: here });
    stop.expect('enter-room', entered.ok, `clicking "${room}" on the overworld opened the room (${entered.ms} ms)`, `clicking "${room}" on the overworld did not open the room: ${entered.problem}; set #/${room} directly instead`);
    if (film) recordFilm(stop, film, { reduced: !!s.profile.reducedMotion, what: `overworld to ${room} zoom`, expectZoom: true });

    const hotspots = roomHotspots(stop.facts, s.run.regions, room);
    await checkLinks(s, page, stop, hotspots.filter((h) => h.kind === 'link' && h.el));

    // Every dialog hotspot: open, look, Escape.
    let first = true;
    for (const h of hotspots.filter((x) => x.kind === 'dialog' && x.el)) {
      await openAndClose(s, page, room, h.id, h.id, { name: `${room}/dialog-${h.id}`, alsoBack: first });
      first = false;
    }

    // Skills shelf items: the first of each shelf shows its name and opens its shelf's dialog.
    for (const h of hotspots.filter((x) => x.kind === 'item' && x.el && /-0$/.test(x.id))) {
      const pointed = await s.hoverHotspot(page, h.id);
      if (pointed.ok) {
        const hover = await s.stop(page, `${room}/item-${h.id}-name`, { expect: here, keepMouse: true });
        const label = hover.facts?.labels.find((l) => l.for === h.id && l.visible);
        hover.expect('item-name', !!label && !!label.text, `the name "${label?.text}" shows while "${h.id}" is ${pointed.how === 'hover' ? 'hovered' : 'focused'}`, `no visible label ([data-label-for="${h.id}"]) while "${h.id}" is ${pointed.how === 'hover' ? 'hovered' : 'focused'}`);
        checkPointer(hover, h.id, pointed.how);
      }
      await openAndClose(s, page, room, h.id, h.shelf, { name: `${room}/item-${h.id}` });
    }

    await s.debugShot(`/${room}`, `${room}/debug-hotspots`);

    // Leave through the doorway.
    const door = hotspots.find((h) => h.kind === 'door');
    const left = await s.travel(page, () => s.clickHotspot(page, door?.id ?? 'door'), WORLD, { fallback: '/world' });
    if (left.repaired) await s.settle(page, WORLD);
    const exit = await s.stop(page, `${room}/exit`, { expect: WORLD });
    exit.expect('exit-door', left.ok, `the doorway led back to the overworld (${left.ms} ms)`, `the doorway did not lead back to the overworld: ${left.problem}; set #/world directly instead`);
  }
}
