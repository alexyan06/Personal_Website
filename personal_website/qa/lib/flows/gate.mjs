// gate: the rotate screen. Shown on a touch device in portrait under 600 px wide, except on #/list.
const WORLD = { route: '/world', scene: 'world' };

function checkGateContent(stop) {
  const gate = stop.facts?.gate;
  if (!gate || !gate.visible) return; // the generic rotate-gate check has already failed
  const link = gate.links.find((l) => /#\/list$/.test(l.href || '') && l.visible);
  stop.expect('gate-list-link', !!link, `the rotate screen offers "${link?.text}" to #/list`, 'the rotate screen has no visible link to #/list ("View as a list")');
  stop.expect('gate-message', /rotate/i.test(gate.text), 'the rotate screen asks to rotate the device', `the rotate screen does not mention rotating: "${gate.text}"`, 'warn');
}

export async function gate(s) {
  const p = s.profile;
  const portrait = { width: Math.min(p.width, p.height), height: Math.max(p.width, p.height) };
  const landscape = { width: portrait.height, height: portrait.width };
  const startsPortrait = p.height > p.width;

  if (!startsPortrait) {
    // Held in landscape: no rotate screen. Turning to portrait brings it up, turning back removes it.
    const page = await s.fresh('/world');
    const stop = await s.stop(page, 'landscape', { expect: { ...WORLD, gate: false } });
    stop.expect('gate-hidden', !!stop.facts && !stop.facts.gate?.visible, 'no rotate screen in landscape', 'the rotate screen is showing in landscape');
    if (p.touch && portrait.width < 600) {
      await page.setViewportSize(portrait).catch(() => {});
      const turned = await s.stop(page, 'turned-to-portrait', { kind: 'gate', expect: { route: '/world' }, resized: true });
      checkGateContent(turned);
      await page.setViewportSize(landscape).catch(() => {});
      const back = await s.settle(page, { ...WORLD, gate: false });
      turned.expect('gate-rotates-away', back.ok, 'turning back to landscape removes the rotate screen', `after turning back to landscape: ${back.message}`);
    }
    return;
  }

  // Held in portrait: the rotate screen covers the title screen and the world.
  {
    const page = await s.fresh('/');
    const stop = await s.stop(page, 'title', { kind: 'gate', expect: { route: '/' } });
    checkGateContent(stop);
  }
  const page = await s.fresh('/world');
  const stop = await s.stop(page, 'world', { kind: 'gate', expect: { route: '/world' } });
  checkGateContent(stop);

  // Its list link works, and the list view is not covered.
  const go = await s.travel(page, () => s.clickTarget(page, { selector: '[data-rotate-gate] a[href$="#/list"]' }, 'the rotate screen\'s list link'), { kind: 'list', route: '/list', gate: false }, { fallback: '/list' });
  if (go.repaired) await s.settle(page, { kind: 'list', route: '/list' });
  const list = await s.stop(page, 'list-link', { kind: 'list', expect: { route: '/list' } });
  list.expect('gate-list-link-works', go.ok, 'the "View as a list" link opened #/list with no rotate screen over it', `the rotate screen's list link did not open the list view: ${go.problem}`);

  // Rotating to landscape removes it; rotating back brings it up again.
  const turning = await s.fresh('/world');
  await s.settle(turning, { kind: 'gate', route: '/world' });
  await turning.setViewportSize(landscape).catch(() => {});
  const turned = await s.stop(turning, 'turned-to-landscape', { expect: { ...WORLD, gate: false }, resized: true });
  turned.expect('gate-rotates-away', turned.settled, 'turning to landscape removes the rotate screen and shows the world', 'turning to landscape did not give a settled world without the rotate screen');
  await turning.setViewportSize(portrait).catch(() => {});
  const again = await s.settle(turning, { kind: 'gate', route: '/world' });
  turned.expect('gate-returns', again.ok, 'turning back to portrait shows the rotate screen again', `after turning back to portrait: ${again.message}`);
}
