// title: title screen, press start, frames of the zoom, overworld.
import { fmtRect } from '../util.mjs';
import { historyBack, recordFilm } from './common.mjs';

const TITLE = { route: '/', scene: 'title' };
const WORLD = { route: '/world', scene: 'world' };

/**
 * The zoom ends on exactly the picture the overworld shows: at its largest, the title screen's
 * small island lies on the stage, where the overworld's own picture is. Then nothing jumps when
 * the overworld takes over. Read from the per-frame samples of the film.
 */
function checkZoomLands(stop, film) {
  const stage = stop.facts?.stage?.rect;
  const sampling = film.sampling;
  if (!stage || !sampling?.samples?.length) return;
  const ids = new Set(
    Object.entries(sampling.pictures ?? {})
      .filter(([, scene]) => scene === 'title')
      .map(([id]) => Number(id)),
  );
  let largest = null;
  for (const sample of sampling.samples) {
    for (const [id, , , , , , x, y, w, h] of sample.els) if (ids.has(id) && w > (largest?.w ?? 0)) largest = { x, y, w, h };
  }
  if (!largest) {
    stop.fail('zoom-lands', 'the title screen has no picture that could be followed through the zoom');
    return;
  }
  const off = Math.max(Math.abs(largest.x - stage.x), Math.abs(largest.y - stage.y), Math.abs(largest.w - stage.w), Math.abs(largest.h - stage.h));
  stop.expect(
    'zoom-lands',
    off <= 1.5,
    `the title screen's island grew until it lay exactly on the stage (${fmtRect(largest)}), where the overworld's picture is`,
    `at its largest the title screen's island was at ${fmtRect(largest)}, but the overworld's picture is at ${fmtRect(stage)}: the island jumps when the overworld takes over`,
  );
}

export async function title(s) {
  const page = await s.fresh('/');
  const stop = await s.stop(page, 'title', { expect: TITLE });
  const facts = stop.facts;
  if (facts) {
    const headings = facts.h1.filter((h) => h.visible);
    stop.expect(
      'title-heading',
      headings.some((h) => /alex\s*yan/i.test(h.text)),
      'the page <h1> reads ALEX YAN',
      headings.length ? `the <h1> reads "${headings[0].text}", expected ALEX YAN` : 'no visible <h1> on the title screen',
    );
    const start = facts.pressStart;
    if (!start) stop.fail('press-start', 'no [data-press-start] control on the title screen');
    else {
      const good = start.visible && (start.tag === 'BUTTON' || start.tag === 'A') && !!start.name;
      stop.expect(
        'press-start',
        good,
        `PRESS START is a <${start.tag.toLowerCase()}> named "${start.name}"`,
        `[data-press-start] is a <${start.tag.toLowerCase()}>${start.visible ? '' : ' that is not visible'}${start.name ? '' : ' with no accessible name'}; expected a visible button with a name`,
      );
    }
  }

  // PRESS START, filming the zoom into the island.
  const film = await s.film(page, 'zoom', async () => {
    const hit = await s.clickTarget(page, { selector: '[data-press-start]' }, '[data-press-start]');
    if (hit.ok || !facts?.state.scenes.includes('title')) return hit;
    const size = page.viewportSize(); // "click anywhere" starts too
    await page.mouse.click(size.width / 2, size.height / 2);
    return { ok: true, how: 'click anywhere' };
  });
  const started = film.result?.ok === false ? { ok: false, message: film.result.message } : await s.settle(page, WORLD);
  await s.finishFilm(page, film, 'title to overworld');
  if (!started.ok) await s.setHash(page, '/world');

  const world = await s.stop(page, 'overworld', { expect: WORLD });
  world.expect('press-start-works', started.ok, `PRESS START led to the overworld (${started.ms} ms)`, `PRESS START did not lead to the overworld: ${started.message}; set #/world directly instead`);
  recordFilm(world, film, { reduced: !!s.profile.reducedMotion, what: 'title to overworld zoom', expectZoom: true });
  if (started.ok && !s.profile.reducedMotion) checkZoomLands(world, film);

  // Browser Back reverses to the title screen.
  const back = await s.travel(page, historyBack(page), TITLE);
  const again = await s.stop(page, 'back-to-title', { expect: TITLE });
  again.expect('browser-back', back.ok, 'browser Back from the overworld returns to the title screen', `browser Back from the overworld did not return to the title screen: ${back.problem}`);

  await s.debugShot('/', 'debug-hotspots');
}
