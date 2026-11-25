// One profile's browser context: page creation, event capture, waiting for the stage to settle,
// and `stop()`, which takes the screenshot and runs the generic checks.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runGenericChecks } from './checks.mjs';
import { IGNORED_URLS, STABLE_MS, STEP_MS } from './config.mjs';
import { Images } from './images.mjs';
import { installQa } from './inpage.mjs';
import { clip, routeUrl, sleep, slug, summarize, withTimeout } from './util.mjs';

export class Aborted extends Error {}

/** After this many waits in a row time out, the stage is stuck and the flow is cut short. */
const STUCK_AFTER = 12;

class Stop {
  constructor(session, name) {
    this.session = session;
    this.facts = null;
    this.record = {
      id: `${session.name}/${session.flow}/${name}`,
      profile: session.name,
      flow: session.flow,
      name,
      url: null,
      route: null,
      screenshot: null,
      checks: [],
    };
  }

  add(id, status, message, details) {
    const check = { id, status, message: clip(message, 700) };
    if (details !== undefined) check.details = details;
    this.record.checks.push(check);
    return status === 'pass';
  }
  pass(id, message) {
    return this.add(id, 'pass', message);
  }
  fail(id, message, details) {
    return this.add(id, 'fail', message, details);
  }
  warn(id, message, details) {
    return this.add(id, 'warn', message, details);
  }
  /** pass when `ok`, otherwise fail (or warn) with the second message. */
  expect(id, ok, passMessage, failMessage, level = 'fail') {
    return this.add(id, ok ? 'pass' : level, ok ? passMessage : failMessage);
  }
}

function explainUnsettled(state, exp) {
  if (!state) return 'the page state could not be read';
  const parts = [];
  if (exp.kind === 'scene') {
    if (!state.stage) parts.push('no [data-stage] element');
    else if (state.transition !== 'idle') parts.push(`data-transition is ${JSON.stringify(state.transition)}, not "idle"`);
  }
  if (exp.kind === 'list' && !state.list) parts.push('no visible [data-view="list"] element');
  if (exp.kind === 'gate' && !state.gate) parts.push('no visible [data-rotate-gate] element');
  if (exp.route != null && state.hashRoute !== exp.route) parts.push(`the URL is at ${state.hash || '(no hash)'}, expected #${exp.route}`);
  if (exp.scene != null && !state.scenes.includes(exp.scene)) parts.push(`the visible scene is ${state.scenes.length ? state.scenes.join(', ') : 'none'}, expected ${exp.scene}`);
  if (exp.dialog !== undefined) {
    if (exp.dialog === null && state.dialog !== null) parts.push(`dialog "${state.dialog}" is still open`);
    else if (exp.dialog !== null && state.dialog !== exp.dialog) parts.push(`${state.dialog ? `dialog "${state.dialog}"` : 'no dialog'} is open, expected "${exp.dialog}"`);
  }
  if (exp.gate !== undefined && exp.kind !== 'gate' && state.gate !== exp.gate) parts.push(exp.gate ? 'the rotate screen is not showing' : 'the rotate screen is showing');
  return parts.join('; ') || 'the state kept changing';
}

export class Session {
  constructor({ browser, name, profile, run }) {
    this.browser = browser;
    this.name = name;
    this.profile = profile;
    this.run = run; // { dir, base, report, regions, art, content, quiet, aborted, deadline }
    this.flow = 'setup';
    this.context = null;
    this.page = null;
    this.events = [];
    this.contract = 'unknown'; // unknown | present | absent
    this.misses = 0; // settle timeouts in a row
    this.stuck = null; // set when the stage has stopped settling; the flow ends at its next step
    this.openStop = null;
    this.images = new Images(browser);
    this.shotDir = path.join(run.dir, 'shots', name);
    this.shotNames = new Set();
    this.env = null;
    this.flowDeadline = Infinity;
  }

  async open() {
    await mkdir(this.shotDir, { recursive: true });
    const p = this.profile;
    this.context = await this.browser.newContext({
      viewport: { width: p.width, height: p.height },
      deviceScaleFactor: p.dpr,
      // Touch profiles get a coarse pointer and no hover. `isMobile` is left off on purpose: Chromium's
      // mobile emulation zooms the page out when the viewport is resized under it, which no phone does
      // on rotation, and that would turn the rotate and resize steps into false failures.
      hasTouch: !!p.touch,
      reducedMotion: p.reducedMotion ? 'reduce' : 'no-preference',
      colorScheme: 'light',
      locale: 'en-US',
      serviceWorkers: 'block',
    });
    this.context.setDefaultTimeout(STEP_MS);
    this.context.setDefaultNavigationTimeout(STEP_MS);
    await this.context.addInitScript(installQa);
  }

  async close() {
    this.finishStop();
    await this.images.close();
    await this.context?.close().catch(() => {});
  }

  // ---- bookkeeping ------------------------------------------------------------------------

  /** Throws when the run was interrupted or this flow has used up its time. */
  guard() {
    if (this.run.aborted) throw new Aborted(`run interrupted (${this.run.aborted})`);
    if (this.stuck) {
      const why = this.stuck;
      this.stuck = null;
      throw new Aborted(why);
    }
    if (Date.now() > this.flowDeadline) throw new Aborted(`the ${this.flow} flow ran out of time`);
  }

  finishStop() {
    const stop = this.openStop;
    this.openStop = null;
    if (!stop) return;
    const checks = stop.record.checks;
    const count = (status) => checks.filter((c) => c.status === status).length;
    const fails = checks.filter((c) => c.status === 'fail');
    const warns = checks.filter((c) => c.status === 'warn');
    const mark = fails.length ? 'FAIL' : warns.length ? 'warn' : 'ok  ';
    let line = `  ${mark} ${stop.record.id}  (${count('pass')} pass`;
    if (warns.length) line += `, ${warns.length} warn`;
    if (fails.length) line += `, ${fails.length} fail`;
    line += ')';
    if (fails.length) line += `  ${summarize(fails.map((c) => c.id), 6)}`;
    this.run.print(line);
  }

  attach(page) {
    const ignored = (url) => IGNORED_URLS.some((re) => re.test(url || ''));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const where = msg.location()?.url || '';
      if (ignored(where) || ignored(msg.text())) return;
      const text = msg.text();
      // The network listeners below report failed loads with their URL; this copy only says "404".
      if (/^Failed to load resource/.test(text)) return;
      this.events.push({ type: 'console error', text: clip(text, 400) });
    });
    page.on('pageerror', (error) => this.events.push({ type: 'page error', text: clip(error.stack || error.message || String(error), 500) }));
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText || 'failed';
      if (reason === 'net::ERR_ABORTED' || ignored(request.url())) return; // aborted by our own navigation
      this.events.push({ type: 'failed request', text: `${request.method()} ${request.url()} (${reason})` });
    });
    page.on('response', (response) => {
      if (response.status() < 400 || ignored(response.url())) return;
      this.events.push({ type: 'failed request', text: `${response.request().method()} ${response.url()} answered ${response.status()}` });
    });
    page.on('crash', () => this.events.push({ type: 'page error', text: 'the page crashed' }));
    page.on('dialog', (dialog) => {
      this.events.push({ type: 'page error', text: `the page opened a native ${dialog.type()} box: ${clip(dialog.message(), 120)}` });
      dialog.dismiss().catch(() => {});
    });
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    const seen = new Map();
    for (const e of events) {
      const key = `${e.type}: ${e.text}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    return [...seen].map(([text, count]) => (count > 1 ? `${text} (x${count})` : text));
  }

  // ---- pages ------------------------------------------------------------------------------

  async newPage() {
    const page = await this.context.newPage();
    this.attach(page);
    return page;
  }

  /** A new tab loaded straight at `route`, replacing the flow's current tab. */
  async fresh(route, { debug = false, keep = false } = {}) {
    this.guard();
    if (!keep && this.page && !this.page.isClosed()) await this.page.close().catch(() => {});
    const page = await this.newPage();
    if (!keep) this.page = page;
    const url = routeUrl(this.run.base, route, { debug });
    try {
      await page.goto(url, { waitUntil: 'load', timeout: STEP_MS });
    } catch (error) {
      this.events.push({ type: 'failed request', text: `could not load ${url}: ${clip(error.message, 200)}` });
    }
    await this.probe(page);
    return page;
  }

  /** Decides once whether the site has the QA contract at all, so a site without it fails fast. */
  async probe(page) {
    if (this.contract === 'present') return;
    const timeout = this.contract === 'unknown' ? STEP_MS : 400;
    const found = await page
      .waitForFunction(() => window.__qa && window.__qa.state().contract, null, { timeout, polling: 50 })
      .then(() => true)
      .catch(() => false);
    this.contract = found ? 'present' : 'absent';
  }

  async state(page) {
    return page.evaluate(() => (window.__qa ? window.__qa.state() : null)).catch(() => null);
  }

  onSite(page) {
    try {
      const here = new URL(page.url());
      const base = new URL(this.run.base);
      return here.origin === base.origin && here.pathname === base.pathname;
    } catch {
      return false;
    }
  }

  /** Puts the page on `route` without clicking anything: the repair step when a move did not work. */
  async setHash(page, route) {
    if (!this.onSite(page)) {
      // The page wandered off (for example Back past the first entry): load the site again.
      await page.goto(routeUrl(this.run.base, route), { waitUntil: 'load', timeout: STEP_MS }).catch(() => {});
      return;
    }
    await page.evaluate((hash) => {
      location.hash = hash;
    }, route === '/' ? '#/' : `#${route}`).catch(() => {});
  }

  // ---- waiting ----------------------------------------------------------------------------

  /**
   * Waits until the expected state has held for STABLE_MS. Never longer than STEP_MS, and much
   * shorter when the site has no contract attributes or has stopped settling.
   */
  async settle(page, expect = {}, { timeout } = {}) {
    if (this.run.aborted) throw new Aborted(`run interrupted (${this.run.aborted})`);
    const exp = { kind: 'scene', stableMs: STABLE_MS, ...expect };
    let limit = timeout ?? STEP_MS;
    if (this.contract !== 'present') limit = Math.min(limit, 400);
    else if (this.misses >= 3) limit = Math.min(limit, 1200);
    const started = Date.now();
    const ok = await page
      .waitForFunction((e) => !!window.__qa && window.__qa.settled(e), exp, { timeout: limit, polling: 30 })
      .then(() => true)
      .catch(() => false);
    const ms = Date.now() - started;
    const state = await this.state(page);
    if (state?.contract) this.contract = 'present';
    this.misses = ok ? 0 : this.misses + 1;
    if (this.contract === 'present' && this.misses >= STUCK_AFTER) {
      this.misses = 0;
      this.stuck = `${STUCK_AFTER} waits in a row never settled (last: ${explainUnsettled(state, exp)}), so the rest of the ${this.flow} flow was skipped`;
    }
    const where = exp.kind === 'scene' ? 'stage idle' : exp.kind === 'list' ? 'list view showing' : exp.kind === 'gate' ? 'rotate screen showing' : 'settled';
    const left = this.onSite(page) ? '' : `the page left the site (it is at ${clip(page.url(), 100)}); `;
    return {
      ok,
      ms,
      state,
      message: ok ? `${where} at ${state?.hashRoute ?? '?'} after ${ms} ms` : `not settled after ${ms} ms: ${left}${explainUnsettled(state, exp)}`,
    };
  }

  // ---- stops ------------------------------------------------------------------------------

  shotPath(name, suffix = '') {
    let base = `${slug(this.flow)}-${slug(name)}${suffix}`;
    let candidate = base;
    for (let i = 2; this.shotNames.has(candidate); i++) candidate = `${base}-${i}`;
    this.shotNames.add(candidate);
    return path.join(this.shotDir, `${candidate}.png`);
  }
  rel(file) {
    return path.relative(this.run.dir, file).split(path.sep).join('/');
  }

  /**
   * A named stop: wait for the stage to settle, take a screenshot, run the generic checks, record.
   * opts: { kind, expect, skip, fullPage, keepMouse, width }
   */
  async stop(page, name, opts = {}) {
    this.guard();
    this.finishStop();
    const stop = new Stop(this, name);
    this.run.report.stops.push(stop.record);
    this.openStop = stop;
    const kind = opts.kind ?? 'scene';
    const expect = opts.expect ?? {};

    if (!page || page.isClosed()) {
      stop.fail('settled', 'there is no open page to look at');
      return stop;
    }
    if (!opts.keepMouse) {
      const size = page.viewportSize();
      if (size) await page.mouse.move(0, size.height - 1).catch(() => {});
    }

    const settled = await this.settle(page, { kind, ...expect });
    stop.add('settled', settled.ok ? 'pass' : 'fail', settled.message);
    stop.record.url = page.url();
    stop.record.route = settled.state?.hashRoute ?? null;
    stop.settled = settled.ok;
    if (!this.onSite(page)) stop.fail('on-site', `the page is no longer on the site: it is at ${clip(page.url(), 120)}`);

    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))])).catch(() => {});

    const file = this.shotPath(name);
    try {
      await page.screenshot({ path: file, timeout: STEP_MS });
      stop.record.screenshot = this.rel(file);
    } catch (error) {
      stop.fail('screenshot', `the screenshot failed: ${clip(error.message, 200)}`);
    }
    if (opts.fullPage) {
      const full = this.shotPath(name, '-full');
      try {
        await page.screenshot({ path: full, fullPage: true, scale: 'css', timeout: 2 * STEP_MS });
        stop.record.fullPage = this.rel(full);
      } catch (error) {
        stop.warn('screenshot-full', `the full-page screenshot failed: ${clip(error.message, 200)}`);
      }
    }

    let facts = null;
    try {
      facts = await withTimeout(page.evaluate(() => (window.__qa ? window.__qa.inspect() : null)), STEP_MS, 'reading the page');
    } catch (error) {
      stop.fail('inspect', `the page could not be inspected: ${clip(error.message, 200)}`);
    }
    if (facts) {
      stop.facts = facts;
      stop.record.route = facts.state.hashRoute;
      if (!this.env) this.env = { ...facts.env, innerWidth: facts.viewport.w, innerHeight: facts.viewport.h, devicePixelRatio: facts.viewport.dpr };
      const ctx = { kind, expect, profile: this.profile, regions: this.run.regions, art: this.run.art, skip: new Set(opts.skip ?? []), resized: !!opts.resized, pointing: !!opts.keepMouse };
      try {
        for (const check of runGenericChecks(facts, ctx)) stop.record.checks.push(check);
      } catch (error) {
        stop.fail('generic-checks', `the generic checks crashed: ${clip(error.stack || error.message, 400)}`);
      }
    } else if (!stop.record.checks.some((c) => c.id === 'inspect')) {
      stop.fail('inspect', 'the QA script is not present on this page (did it leave the site?)');
    }

    const events = this.drainEvents();
    if (this.run.aborted) {
      // Interrupted while this stop was being taken: whatever it recorded is the interruption, not the site.
      const at = this.run.report.stops.indexOf(stop.record);
      if (at !== -1) this.run.report.stops.splice(at, 1);
      this.openStop = null;
      throw new Aborted(`run interrupted (${this.run.aborted})`);
    }
    if (events.length) stop.fail('console-clean', `${events.length} problem(s) since the previous stop: ${summarize(events, 3)}`, events);
    else stop.pass('console-clean', 'no console errors, page errors or failed requests');
    return stop;
  }

  /** A screenshot of `route` with ?debug=hotspots, in a throwaway tab. */
  async debugShot(route, name) {
    this.guard();
    let page = null;
    try {
      page = await this.fresh(route, { debug: true, keep: true });
      const stop = await this.stop(page, name, { skip: ['palette'] });
      const outlined = await page.evaluate(() => new URLSearchParams(location.search).get('debug') === 'hotspots').catch(() => false);
      stop.expect('debug-url', outlined, 'loaded with ?debug=hotspots', 'the page dropped ?debug=hotspots from the URL');
      return stop;
    } finally {
      await page?.close().catch(() => {});
    }
  }

  // ---- acting -----------------------------------------------------------------------------

  /**
   * Clicks a hotspot the way a mouse would: at a point where it really is the top element.
   * A hotspot that is fully covered by other hotspots (a Skills shelf under its items) is
   * activated with the keyboard instead.
   */
  async clickHotspot(page, id) {
    return this.clickTarget(page, { hotspot: id }, `[data-hotspot="${id}"]`);
  }

  /** Where a click would land on the target. Retries for a moment, because a blinking control is unclickable half the time. */
  async findHit(page, target) {
    let hit = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      hit = await page.evaluate((t) => (window.__qa ? window.__qa.hit(t) : null), target).catch(() => null);
      if (!hit || !hit.found || (hit.visible && hit.x !== null)) break;
      await sleep(150);
    }
    return hit;
  }

  async clickTarget(page, target, shown) {
    this.guard();
    const hit = await this.findHit(page, target);
    if (!hit || !hit.found) return { ok: false, message: `${shown} is not in the page` };
    if (!hit.visible) return { ok: false, message: `${shown} is not visible` };
    if (hit.x === null) {
      const focused = await page.evaluate((t) => window.__qa.focusOn(t), target).catch(() => false);
      if (focused) await page.keyboard.press('Enter').catch(() => {});
      const byHotspot = !!hit.blocker?.hotspot;
      return {
        ok: focused,
        how: 'keyboard',
        covered: hit.blocker?.desc ?? 'another element',
        coveredByHotspot: byHotspot,
        message: `${shown} cannot be clicked: it is covered by ${hit.blocker?.desc ?? 'another element'}`,
      };
    }
    await page.mouse.click(hit.x, hit.y).catch(() => {});
    return { ok: true, how: 'mouse', x: hit.x, y: hit.y };
  }

  async hoverHotspot(page, id) {
    this.guard();
    const hit = await this.findHit(page, { hotspot: id });
    if (!hit || !hit.found) return { ok: false, message: `[data-hotspot="${id}"] is not in the page` };
    if (!hit.visible || hit.x === null) return { ok: false, message: `[data-hotspot="${id}"] is not visible or is covered` };
    if (this.profile.touch) {
      await page.evaluate((t) => window.__qa.focusOn(t), { hotspot: id }).catch(() => {});
      return { ok: true, how: 'focus' };
    }
    await page.mouse.move(hit.x, hit.y, { steps: 2 }).catch(() => {});
    return { ok: true, how: 'hover' };
  }

  /**
   * Does something that should change where we are, then waits for the destination.
   * Returns { ok, problem }. With `fallback`, a failed move is repaired by setting the URL so the walk can go on.
   */
  async travel(page, action, expect, { fallback = null } = {}) {
    this.guard();
    let act;
    try {
      act = await action();
    } catch (error) {
      if (error instanceof Aborted) throw error;
      act = { ok: false, message: clip(error.message, 200) };
    }
    let problem = null;
    let arrived = null;
    if (act && act.ok === false) problem = act.message;
    else {
      arrived = await this.settle(page, expect);
      if (!arrived.ok) problem = arrived.message;
    }
    let repaired = false;
    if (problem && fallback) {
      await this.setHash(page, fallback);
      repaired = true;
    }
    return { ok: !problem, problem, act, arrived, repaired, ms: arrived?.ms ?? null };
  }

  /**
   * Film strip: about six frames spread over the first second after `trigger`, with the
   * per-frame sampler running so the motion can also be judged from numbers.
   */
  async film(page, name, trigger, { frames = 6, spanMs = 1000 } = {}) {
    this.guard();
    const out = { name, frames: [], sheet: null, result: null, startedAt: 0 };
    await page.evaluate(() => window.__qa && window.__qa.startSampling(4000)).catch(() => {});
    const samplerStart = Date.now();
    const cdp = await this.context.newCDPSession(page).catch(() => null);
    const grab = async () => {
      if (cdp) {
        try {
          const { data } = await withTimeout(cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true }), 3000, 'frame capture');
          return Buffer.from(data, 'base64');
        } catch {
          /* fall through to the slower path */
        }
      }
      return page.screenshot({ timeout: 3000 }).catch(() => null);
    };
    const t0 = Date.now();
    out.startedAt = t0 - samplerStart;
    try {
      out.result = await trigger();
    } catch (error) {
      if (error instanceof Aborted) throw error;
      out.result = { ok: false, message: clip(error.message, 200) };
    }
    const shots = [];
    for (let i = 0; i < frames; i++) {
      const due = (spanMs / (frames - 1)) * i - (Date.now() - t0);
      if (due > 0) await sleep(due);
      const t = Date.now() - t0;
      const buffer = await grab();
      if (buffer) shots.push({ t, buffer });
    }
    await cdp?.detach().catch(() => {});
    for (const [i, shot] of shots.entries()) {
      const file = this.shotPath(`${name}-frame${i + 1}`);
      await writeFile(file, shot.buffer).catch(() => {});
      out.frames.push({ t: shot.t, file: this.rel(file) });
    }
    out.shots = shots;
    return out;
  }

  /** Call after the destination has settled: stops the sampler, labels the frames and writes the contact sheet. */
  async finishFilm(page, film, title) {
    const sampling = await page.evaluate(() => (window.__qa ? window.__qa.stopSampling() : null)).catch(() => null);
    film.sampling = sampling;
    const samples = sampling?.samples ?? [];
    for (const [i, frame] of film.frames.entries()) {
      const at = frame.t + film.startedAt;
      let nearest = null;
      for (const s of samples) if (!nearest || Math.abs(s.t - at) < Math.abs(nearest.t - at)) nearest = s;
      frame.transition = nearest ? nearest.transition : null;
      film.shots[i].caption = `frame ${i + 1}: ${frame.t} ms after the trigger${frame.transition ? ` (${frame.transition})` : ''}`;
    }
    if (film.shots.length) {
      const sheet = this.shotPath(`${film.name}-strip`);
      try {
        await withTimeout(
          this.images.contactSheet(film.shots.map((s) => ({ buffer: s.buffer, caption: s.caption })), sheet, `${this.name}: ${title}`),
          15000,
          'contact sheet',
        );
        film.sheet = this.rel(sheet);
      } catch (error) {
        film.sheetError = clip(error.message, 200);
      }
    }
    delete film.shots;
    return film;
  }
}
