// motion: under prefers-reduced-motion every transition is an opacity cross-fade of at most 200 ms.
// The scene layer's transform and on-screen box are sampled every frame and must never change.
import { analyzeSamples } from '../sampling.mjs';
import { sleep, summarize } from '../util.mjs';
import { firstDialog, pressKey } from './common.mjs';

const WORLD = { route: '/world', scene: 'world' };
const ROOM = 'experience';

function judge(stop, sampling, what) {
  const motion = analyzeSamples(sampling);
  if (!motion.count) {
    stop.warn('no-moving-transforms', `no frames could be sampled during ${what}`);
    return;
  }
  stop.record.motion = { frames: motion.count, sampledMs: motion.durationMs, runningMs: motion.everRunning ? motion.runningMs : null };
  if (motion.moved.length) stop.fail('no-moving-transforms', `under reduced motion the scene moved during ${what}: ${summarize(motion.moved, 3)}`, motion.moved);
  else stop.pass('no-moving-transforms', `nothing scaled or moved during ${what} (${motion.count} frames over ${motion.durationMs} ms)`);

  if (!motion.everRunning) stop.pass('cross-fade-length', `${what} was a cut: data-transition never left "idle"`);
  else if (motion.runningMs <= 260) stop.pass('cross-fade-length', `${what} took about ${motion.runningMs} ms`);
  else stop.add('cross-fade-length', motion.runningMs <= 400 ? 'warn' : 'fail', `${what} ran for about ${motion.runningMs} ms; under reduced motion a cross-fade may take at most 200 ms`);
}

export async function motion(s) {
  const page = await s.fresh('/');
  if (!s.profile.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' }).catch(() => {});
  const start = await s.stop(page, 'title', { expect: { route: '/', scene: 'title' } });
  start.expect('reduced-motion-on', start.facts?.env.reducedMotion === true, 'the page sees prefers-reduced-motion: reduce', 'the page does not see prefers-reduced-motion: reduce');

  let item = null;
  const inRoom = { route: `/${ROOM}`, scene: ROOM, dialog: null };
  const legs = [
    { name: 'title-to-world', what: 'title to overworld', act: () => s.clickTarget(page, { selector: '[data-press-start]' }, '[data-press-start]'), expect: WORLD },
    { name: 'world-to-room', what: 'overworld to room', act: () => s.clickHotspot(page, ROOM), expect: inRoom },
    { name: 'room-to-item', what: 'room to item', act: () => s.clickHotspot(page, item), expect: () => ({ route: `/${ROOM}/${item}`, scene: ROOM, dialog: item }), needsItem: true },
    { name: 'item-to-room', what: 'item to room', act: pressKey(page, 'Escape'), expect: inRoom, needsItem: true },
    { name: 'room-to-world', what: 'room to overworld', act: () => s.clickHotspot(page, 'door'), expect: WORLD },
  ];

  let last = start;
  for (const leg of legs) {
    s.guard();
    if (leg.needsItem && !item) continue;
    const expect = typeof leg.expect === 'function' ? leg.expect() : leg.expect;
    await page.evaluate(() => window.__qa && window.__qa.startSampling(3500)).catch(() => {});
    const moved = await s.travel(page, leg.act, expect, { fallback: expect.route });
    await sleep(150);
    const sampling = await page.evaluate(() => (window.__qa ? window.__qa.stopSampling() : null)).catch(() => null);
    if (moved.repaired) await s.settle(page, expect);
    const stop = await s.stop(page, leg.name, { expect });
    last = stop;
    stop.expect('transition-works', moved.ok, `${leg.what} worked (${moved.ms} ms)`, `${leg.what} did not happen: ${moved.problem}`);
    if (moved.ok) judge(stop, sampling, leg.what);
    if (leg.name === 'world-to-room') {
      item = firstDialog(stop.facts, s.run.regions, ROOM)?.id ?? null;
      if (!item) stop.fail('motion-item', `no dialog hotspot was found in the ${ROOM} room, so the item transitions could not be sampled`);
    }
  }

  // The pointer does not blink under reduced motion.
  if (!s.profile.touch) {
    const id = s.run.regions.world.hotspots[0]?.id ?? 'about';
    const pointed = await s.hoverHotspot(page, id);
    if (pointed.ok) {
      const blink = await page.evaluate(() => window.__qa.watchBlink('[data-pointer]', 1300)).catch(() => null);
      if (!blink || blink.states.every((state) => state === 'absent')) last.fail('pointer-steady', `no [data-pointer] appeared while "${id}" was hovered`);
      else if (blink.states.length > 1) last.fail('pointer-steady', `the pointer blinks under reduced motion (${blink.states.length} different looks in 1.3 s: ${blink.states.slice(0, 3).join(' then ')})`);
      else if (blink.animations > 0) last.fail('pointer-steady', `the pointer has ${blink.animations} animation(s) running under reduced motion`);
      else last.pass('pointer-steady', 'the pointer does not blink under reduced motion');
    }
  }
}
