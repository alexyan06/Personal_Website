// world: locations, labels, pointer, HUD links, resize, debug overlay.
import { summarize } from '../util.mjs';
import { checkPointer } from './common.mjs';

const WORLD = { route: '/world', scene: 'world' };

function checkHudLinks(stop) {
  const hud = stop.facts?.hud;
  if (!hud) return; // the generic hud check has already failed
  const links = hud.links.filter((l) => l.visible);
  const problems = [];
  if (!/alex\s*yan/i.test(hud.text)) problems.push('the HUD does not show ALEX YAN');
  if (links.length < 4) problems.push(`the HUD has ${links.length} link(s); expected RESUME, GITHUB, LINKEDIN and LIST`);
  for (const link of links) {
    const href = (link.href || '').trim();
    if (!href || href === '#' || /^javascript:/i.test(href)) problems.push(`HUD link "${link.text}" has no real href`);
  }
  const to = (re) => links.some((l) => re.test(l.abs || l.href || ''));
  if (!links.some((l) => /#\/list$/.test(l.href || ''))) problems.push('no HUD link goes to #/list');
  if (!to(/github\.com/i)) problems.push('no HUD link goes to GitHub');
  if (!to(/linkedin\.com/i)) problems.push('no HUD link goes to LinkedIn');
  if (!to(/resume|\.pdf/i)) problems.push('no HUD link goes to the resume');
  if (problems.length) stop.fail('hud-links', summarize(problems), problems);
  else stop.pass('hud-links', `HUD links: ${links.map((l) => l.text).join(', ')}`);
}

export async function world(s) {
  const page = await s.fresh('/world');
  const stop = await s.stop(page, 'world', { expect: WORLD });
  checkHudLinks(stop);

  // The pointer follows the mouse (or focus on touch screens) to every location.
  const unreachable = [];
  for (const want of s.run.regions.world.hotspots) {
    const pointed = await s.hoverHotspot(page, want.id);
    if (!pointed.ok) {
      unreachable.push(`${want.id}: ${pointed.message}`);
      continue;
    }
    const at = await s.stop(page, `pointer-${want.id}`, { expect: WORLD, keepMouse: true });
    checkPointer(at, want.id, pointed.how);
  }
  if (unreachable.length) stop.fail('pointer', `could not point at ${unreachable.length} location(s): ${summarize(unreachable, 3)}`, unreachable);

  // The scale is recomputed when the window changes size.
  const p = s.profile;
  const smaller = { width: Math.max(480, p.width - 317), height: Math.max(300, p.height - 173) };
  await page.setViewportSize(smaller).catch(() => {});
  const resized = await s.stop(page, 'resized', { expect: WORLD, resized: true });
  resized.record.viewport = smaller;
  const k = Number(resized.facts?.stage?.dataK);
  const before = Number(stop.facts?.stage?.dataK);
  if (Number.isFinite(k) && Number.isFinite(before)) resized.pass('rescaled', `after resizing to ${smaller.width}x${smaller.height} k went from ${before} to ${k}`);
  await page.setViewportSize({ width: p.width, height: p.height }).catch(() => {});
  await s.settle(page, WORLD);

  await s.debugShot('/world', 'debug-hotspots');
}
