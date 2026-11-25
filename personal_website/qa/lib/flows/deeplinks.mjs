// deeplinks: load every route directly; Escape and the Back button walk up; unknown routes.
import { MOVED_ROUTES, ROOMS } from '../config.mjs';
import { sleep, slug } from '../util.mjs';
import { checkImmediate, firstDialog, historyBack, historyForward, pressKey } from './common.mjs';

const WORLD = { route: '/world', scene: 'world' };

export async function deeplinks(s) {
  const items = {}; // room -> id of a hotspot that opens a dialog

  // Every route, loaded straight from the address bar.
  {
    const page = await s.fresh('/world');
    const stop = await s.stop(page, 'world', { expect: WORLD });
    await checkImmediate(page, stop);
  }
  for (const room of ROOMS) {
    s.guard();
    const page = await s.fresh(`/${room}`);
    const stop = await s.stop(page, room, { expect: { route: `/${room}`, scene: room, dialog: null } });
    await checkImmediate(page, stop);
    const item = firstDialog(stop.facts, s.run.regions, room);
    if (!item) {
      stop.fail('deeplink-item', `no dialog hotspot was found in the ${room} room, so an item deep link could not be tried`);
      continue;
    }
    items[room] = item.id;
    const route = `/${room}/${item.id}`;
    const itemPage = await s.fresh(route);
    const itemStop = await s.stop(itemPage, `${room}/${item.id}`, { expect: { route, scene: room, dialog: item.id } });
    await checkImmediate(itemPage, itemStop);
  }

  const room = items.experience ? 'experience' : ROOMS.find((r) => items[r]);
  if (room) {
    const item = items[room];
    const atItem = { route: `/${room}/${item}`, scene: room, dialog: item };
    const atRoom = { route: `/${room}`, scene: room, dialog: null };

    // "Up" from a deep-linked item: there is no history behind it, so Escape must go to the parent route.
    {
      const page = await s.fresh(atItem.route);
      await s.settle(page, atItem);
      const up1 = await s.travel(page, pressKey(page, 'Escape'), atRoom, { fallback: atRoom.route });
      if (up1.repaired) await s.settle(page, atRoom);
      const stop1 = await s.stop(page, 'up/escape-to-room', { expect: atRoom });
      stop1.expect('escape-up', up1.ok, `Escape on a deep-linked item went up to #${atRoom.route}`, `Escape on a deep-linked item did not go up to #${atRoom.route}: ${up1.problem}`);

      const up2 = await s.travel(page, pressKey(page, 'Escape'), WORLD, { fallback: '/world' });
      if (up2.repaired) await s.settle(page, WORLD);
      const stop2 = await s.stop(page, 'up/escape-to-world', { expect: WORLD });
      stop2.expect('escape-up', up2.ok, 'Escape in the room went up to #/world', `Escape in the room did not go up to #/world: ${up2.problem}`);

      await page.keyboard.press('Escape').catch(() => {});
      await sleep(300);
      const still = await s.settle(page, WORLD, { timeout: 1500 });
      stop2.expect('escape-on-world', still.ok, 'Escape on the overworld does nothing', `Escape on the overworld changed something: ${still.message}`);

      // Going up pushed history entries, so Back retraces them.
      const back1 = await s.travel(page, historyBack(page), atRoom);
      const stop3 = await s.stop(page, 'up/back-to-room', { expect: atRoom });
      stop3.expect('browser-back', back1.ok, `browser Back went to #${atRoom.route}`, `browser Back did not go to #${atRoom.route}: ${back1.problem}`);
      const back2 = await s.travel(page, historyBack(page), atItem);
      const stop4 = await s.stop(page, 'up/back-to-item', { expect: atItem });
      stop4.expect('browser-back', back2.ok, `browser Back went to #${atItem.route} and reopened the dialog`, `browser Back did not return to #${atItem.route}: ${back2.problem}`);
      const forward = await s.travel(page, historyForward(page), atRoom);
      stop4.expect('browser-forward', forward.ok, `browser Forward went to #${atRoom.route} again`, `browser Forward did not go to #${atRoom.route}: ${forward.problem}`);
    }

    // The whole way in by clicking, then Back three times.
    {
      const page = await s.fresh('/');
      await s.settle(page, { route: '/', scene: 'title' });
      const legs = [
        ['PRESS START', () => s.clickTarget(page, { selector: '[data-press-start]' }, '[data-press-start]'), WORLD],
        [`the ${room} location`, () => s.clickHotspot(page, room), atRoom],
        [`the "${item}" object`, () => s.clickHotspot(page, item), atItem],
      ];
      const broken = [];
      for (const [what, action, expect] of legs) {
        const leg = await s.travel(page, action, expect, { fallback: expect.route });
        if (leg.repaired) await s.settle(page, expect);
        if (!leg.ok) broken.push(`${what}: ${leg.problem}`);
      }
      const stop = await s.stop(page, 'journey/item', { expect: atItem });
      stop.expect('journey', broken.length === 0, 'title, overworld, room and item were reached by clicking', `the way in by clicking broke: ${broken.join('; ')}`);
      const backs = [
        ['journey/back-1-room', atRoom],
        ['journey/back-2-world', WORLD],
        ['journey/back-3-title', { route: '/', scene: 'title' }],
      ];
      for (const [name, expect] of backs) {
        const back = await s.travel(page, historyBack(page), expect);
        const at = await s.stop(page, name, { expect });
        at.expect('browser-back', back.ok, `browser Back went to #${expect.route}`, `browser Back did not go to #${expect.route}: ${back.problem}`);
      }
    }

    // The breadcrumb is another way up.
    {
      const page = await s.fresh(atRoom.route);
      await s.settle(page, atRoom);
      const up = await s.travel(page, () => s.clickTarget(page, { selector: '[data-breadcrumb] a[href$="#/world"]' }, 'the breadcrumb link to #/world'), WORLD);
      const stop = await s.stop(page, 'breadcrumb-to-world', { expect: WORLD });
      stop.expect('breadcrumb-up', up.ok, 'the World crumb went up to #/world', `the World crumb did not go up to #/world: ${up.problem}`);
    }

    // Two camera moves from one navigation. From an open item the World crumb closes the dialog and
    // then leaves the room; Back from there dives into the room and then opens the item. The stage
    // has to come to rest on each exactly as if it had got there one step at a time: the generic
    // checks at these stops (labels, scene, dialog) are the test.
    {
      s.guard();
      const page = await s.fresh(atRoom.route);
      await s.settle(page, atRoom);
      const opened = await s.travel(page, () => s.clickHotspot(page, item), atItem, { fallback: atItem.route });
      if (opened.repaired) await s.settle(page, atItem);
      const up = await s.travel(page, () => s.clickTarget(page, { selector: '[data-breadcrumb] a[href$="#/world"]' }, 'the breadcrumb link to #/world'), WORLD, { fallback: '/world' });
      if (up.repaired) await s.settle(page, WORLD);
      const out = await s.stop(page, 'twostep/item-to-world', { expect: WORLD });
      out.expect('breadcrumb-up', up.ok, 'the World crumb went from an open item to #/world', `the World crumb did not go from an open item to #/world: ${up.problem}`);
      const back = await s.travel(page, historyBack(page), atItem, { fallback: atItem.route });
      if (back.repaired) await s.settle(page, atItem);
      const again = await s.stop(page, 'twostep/world-to-item', { expect: atItem });
      again.expect('browser-back', back.ok, `browser Back went from the overworld to #${atItem.route} and reopened the dialog`, `browser Back did not go from the overworld to #${atItem.route}: ${back.problem}`);
    }
  }

  // Unknown routes are replaced, not pushed. A broken percent escape is an unknown route too.
  const unknown = [
    ['unknown-route', '/nowhere', WORLD],
    ['unknown-item', '/experience/nowhere', { route: '/experience', scene: 'experience', dialog: null }],
    ['unknown-escape', '/%', WORLD],
    ['unknown-item-escape', '/experience/%E0%A4%A', { route: '/experience', scene: 'experience', dialog: null }],
  ];
  for (const [name, bad, expect] of unknown) {
    s.guard();
    const page = await s.fresh(bad);
    const landed = await s.settle(page, expect);
    const stop = await s.stop(page, name, { expect });
    stop.expect('unknown-route', landed.ok, `#${bad} landed on #${expect.route}`, `#${bad} did not land on #${expect.route}: ${landed.message}`);
    await checkImmediate(page, stop);
  }

  // An item that has moved keeps its old address working: it leads to the new one, dialog open.
  for (const [from, to] of MOVED_ROUTES) {
    s.guard();
    const [room, item] = to.split('/').filter(Boolean);
    const expect = { route: to, scene: room, dialog: item };
    const page = await s.fresh(from);
    const landed = await s.settle(page, expect);
    const stop = await s.stop(page, `moved-${slug(from)}`, { expect });
    stop.expect('moved-route', landed.ok, `the old address #${from} leads to #${to}, with its dialog open`, `the old address #${from} did not lead to #${to}: ${landed.message}`);
    await checkImmediate(page, stop);
  }

  // An unknown URL that arrives later (a bad link, a typo in the address bar) is replaced as well,
  // so Back is not trapped by it. This has to happen after the page has loaded: browsers turn any
  // navigation made during the load into a replace by themselves.
  {
    s.guard();
    const home = { route: '/about', scene: 'about', dialog: null };
    const page = await s.fresh(home.route);
    await s.settle(page, home);
    const before = await page.evaluate(() => history.length).catch(() => null);
    const landed = await s.travel(
      page,
      async () => {
        await page.evaluate(() => {
          location.hash = '#/nowhere';
        });
        return { ok: true };
      },
      WORLD,
    );
    const stop = await s.stop(page, 'unknown-route-later', { expect: WORLD });
    stop.expect('unknown-route', landed.ok, 'going to #/nowhere from a room landed on #/world', `going to #/nowhere from a room did not land on #/world: ${landed.problem}`);
    const after = await page.evaluate(() => history.length).catch(() => null);
    if (landed.ok && before !== null && after !== null) {
      stop.expect(
        'unknown-route-replaced',
        after === before + 1,
        'the unknown URL was replaced in history, not pushed',
        `the unknown URL was pushed, not replaced: history grew by ${after - before} entries instead of 1`,
      );
      const back = await s.travel(page, historyBack(page), home);
      stop.expect('back-not-trapped', back.ok, 'browser Back from there returns to #/about', `browser Back did not return to #/about, so the unknown URL traps the Back button: ${back.problem}`);
    }
  }
}
