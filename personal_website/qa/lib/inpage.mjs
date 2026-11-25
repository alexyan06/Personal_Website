// Runs inside every page under test (installed with context.addInitScript before any site code).
// It only reads: a log of contract state changes, a per-frame geometry sampler, and `inspect()`,
// which returns plain facts that qa/lib/checks.mjs turns into pass, fail and warn results.
// The one exception is `groundProbe()`, which swaps the ground's tiles for a test pattern while a
// screenshot is taken and puts them back.
// The function is serialized, so it must not use anything from outside its own body.

export function installQa() {
  if (window.__qa) return;
  const qa = {};
  window.__qa = qa;

  const r3 = (n) => Math.round(n * 1000) / 1000;
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r3(r.left), y: r3(r.top), w: r3(r.width), h: r3(r.height) };
  };
  const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');

  function describe(el) {
    if (!el || el.nodeType !== 1) return 'nothing';
    const tag = el.tagName.toLowerCase();
    let s = tag;
    if (el.id) s += `#${el.id}`;
    for (const attr of ['data-hotspot', 'data-label-for', 'data-scene', 'data-dialog', 'data-view']) {
      if (el.hasAttribute(attr)) s += `[${attr}="${el.getAttribute(attr)}"]`;
    }
    for (const attr of ['data-stage', 'data-hud', 'data-breadcrumb', 'data-pointer', 'data-press-start', 'data-rotate-gate', 'data-route']) {
      if (el.hasAttribute(attr)) s += `[${attr}]`;
    }
    if (s === tag && typeof el.className === 'string' && el.className.trim()) {
      s += `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`;
    }
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text && text.length <= 28 && el.children.length === 0) s += ` "${text}"`;
    return s;
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
    }
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
  }

  // Rendered at all, even if a blink has it hidden right now.
  function hasBox(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function hashRoute() {
    let h = location.hash.replace(/^#/, '');
    if (h === '' || h === '/') return '/';
    if (!h.startsWith('/')) h = `/${h}`;
    h = h.replace(/\/+$/, '');
    return h || '/';
  }

  function accName(el) {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) return text;
    }
    const label = el.getAttribute('aria-label');
    if (label && label.trim()) return label.trim();
    let text = '';
    const walk = (node) => {
      if (node.nodeType === 3) text += node.nodeValue;
      else if (node.nodeType === 1) {
        if (node.getAttribute('aria-hidden') === 'true') return;
        if (node.tagName === 'IMG') text += ` ${node.getAttribute('alt') || ''} `;
        else if (node.getAttribute('aria-label')) text += ` ${node.getAttribute('aria-label')} `;
        else node.childNodes.forEach(walk);
      }
    };
    el.childNodes.forEach(walk);
    text = text.replace(/\s+/g, ' ').trim();
    return text || (el.getAttribute('title') || '').trim();
  }

  // Font families that have finished loading at some point on this page. Chromium rebuilds its
  // @font-face objects (status "unloaded") whenever a media query flips, so the live status alone
  // would report a font as missing right after a resize.
  const fontsLoaded = new Set();
  function noteFonts() {
    for (const face of document.fonts) if (face.status === 'loaded') fontsLoaded.add(unquote(face.family));
  }
  document.fonts.addEventListener('loadingdone', noteFonts);

  // The color of the page before the app has run: read when the HTML has been parsed, which is
  // before any deferred or module script executes. It is what a visitor sees while the app loads.
  qa.first = null;
  const noteFirst = () => {
    if (qa.first || !document.documentElement) return;
    qa.first = { color: getComputedStyle(document.documentElement).backgroundColor, hash: location.hash };
  };
  document.addEventListener('readystatechange', () => {
    if (document.readyState === 'interactive') noteFirst();
  });

  // ---- state and the change log -------------------------------------------------------------

  qa.state = function () {
    const stage = document.querySelector('[data-stage]');
    const root = document.querySelector('[data-route]');
    const dialog = [...document.querySelectorAll('[data-dialog]')].find(isVisible) || null;
    const gate = document.querySelector('[data-rotate-gate]');
    const list = document.querySelector('[data-view="list"]');
    return {
      hash: location.hash,
      hashRoute: hashRoute(),
      route: root ? root.getAttribute('data-route') : null,
      stage: !!stage,
      transition: stage ? stage.getAttribute('data-transition') : null,
      scenes: [...document.querySelectorAll('[data-scene]')].filter(isVisible).map((el) => el.getAttribute('data-scene')),
      dialog: dialog ? dialog.getAttribute('data-dialog') : null,
      gate: !!gate && isVisible(gate),
      list: !!list && isVisible(list),
      pressStart: !!document.querySelector('[data-press-start]'),
      contract: !!(stage || root || gate || list),
    };
  };

  // Every change of the contract attributes since the page started loading. `t` is ms since navigation start.
  qa.log = [];
  let lastKey = '';
  function record() {
    const stage = document.querySelector('[data-stage]');
    const root = document.querySelector('[data-route]');
    const dialog = document.querySelector('[data-dialog]');
    const entry = {
      t: Math.round(performance.now()),
      transition: stage ? stage.getAttribute('data-transition') : null,
      route: root ? root.getAttribute('data-route') : null,
      scenes: [...document.querySelectorAll('[data-scene]')].map((el) => el.getAttribute('data-scene')),
      dialog: dialog ? dialog.getAttribute('data-dialog') : null,
      pressStart: !!document.querySelector('[data-press-start]'),
      gate: !!document.querySelector('[data-rotate-gate]'),
      hash: location.hash,
    };
    const key = JSON.stringify([entry.transition, entry.route, entry.scenes, entry.dialog, entry.pressStart, entry.gate, entry.hash]);
    if (key === lastKey) return;
    lastKey = key;
    if (qa.log.length < 3000) qa.log.push(entry);
  }
  new MutationObserver(record).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-transition', 'data-route', 'data-scene', 'data-dialog', 'data-press-start', 'data-rotate-gate', 'data-stage'],
  });
  window.addEventListener('hashchange', record);
  qa.mark = () => qa.log.length;
  qa.logSince = (index) => qa.log.slice(index);

  // ---- settle -------------------------------------------------------------------------------

  // True once the expected state has held for `stableMs`. Polled by page.waitForFunction.
  let heldSince = null;
  let heldKey = '';
  qa.settled = function (exp) {
    const key = JSON.stringify(exp);
    if (key !== heldKey) {
      heldKey = key;
      heldSince = null;
    }
    const s = qa.state();
    let ok = true;
    if (exp.kind === 'scene') ok = s.stage && s.transition === 'idle';
    else if (exp.kind === 'list') ok = s.list;
    else if (exp.kind === 'gate') ok = s.gate;
    if (ok && exp.route != null) ok = s.hashRoute === exp.route;
    if (ok && exp.scene != null) ok = s.scenes.includes(exp.scene);
    if (ok && exp.dialog !== undefined) ok = exp.dialog === null ? s.dialog === null : s.dialog === exp.dialog;
    if (ok && exp.gate !== undefined && exp.kind !== 'gate') ok = s.gate === exp.gate;
    if (!ok) {
      heldSince = null;
      return false;
    }
    const now = performance.now();
    if (heldSince === null) heldSince = now;
    return now - heldSince >= (exp.stableMs ?? 0);
  };

  // ---- per-frame sampler --------------------------------------------------------------------

  // Records, every animation frame, the transform, opacity and on-screen box of the stage, each scene
  // root, the layers between them and the scene images: everything a camera move could be applied to.
  function makeSampler(maxMs) {
    const samples = [];
    const meta = {};
    /** For a scene's own picture: the scene it belongs to. */
    const pictures = {};
    const ids = new WeakMap();
    let count = 0;
    const started = performance.now();
    const sampler = { samples, meta, pictures, running: true, started };
    const idOf = (el) => {
      let id = ids.get(el);
      if (!id) {
        id = ++count;
        ids.set(el, id);
        meta[id] = describe(el);
        if (el.tagName === 'IMG') pictures[id] = el.closest('[data-scene]')?.getAttribute('data-scene') ?? null;
      }
      return id;
    };
    // The ground and the character have idle loops of their own (the sea's motion, his frames).
    // Those are not camera moves and are judged by their own checks, so they are not sampled here.
    const skip = (el) =>
      el.hasAttribute('data-pointer') ||
      el.hasAttribute('data-hotspot') ||
      el.hasAttribute('data-label-for') ||
      el.hasAttribute('data-hud') ||
      !!el.closest('[data-dialog], [data-ground], [data-character]');
    const tick = () => {
      if (!sampler.running) return;
      const now = performance.now();
      const stage = document.querySelector('[data-stage]');
      const els = [];
      if (stage) {
        const set = new Set([stage]);
        for (const child of stage.children) set.add(child);
        for (const scene of document.querySelectorAll('[data-scene]')) {
          for (let el = scene; el && el !== stage && el !== document.documentElement; el = el.parentElement) set.add(el);
          for (const child of scene.children) set.add(child);
          for (const img of scene.querySelectorAll('img')) {
            for (let el = img; el && el !== scene; el = el.parentElement) set.add(el);
          }
        }
        for (const el of set) {
          if (skip(el)) continue;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          els.push([idOf(el), cs.transform, cs.translate, cs.scale, cs.rotate, cs.opacity, r3(r.left), r3(r.top), r3(r.width), r3(r.height)]);
        }
      }
      samples.push({ t: r3(now - started), transition: stage ? stage.getAttribute('data-transition') : null, els });
      if (now - started < maxMs && samples.length < 900) requestAnimationFrame(tick);
      else sampler.running = false;
    };
    tick();
    return sampler;
  }
  const publish = (sampler) => (sampler ? { samples: sampler.samples, meta: sampler.meta, pictures: sampler.pictures, started: r3(sampler.started) } : null);

  // The first 1.5 s after navigation are always sampled, to check that a deep link renders with no animation.
  const boot = makeSampler(1500);
  qa.bootSamples = () => publish(boot);

  let current = null;
  qa.startSampling = function (maxMs) {
    if (current) current.running = false;
    current = makeSampler(maxMs || 4000);
    return true;
  };
  qa.stopSampling = function () {
    const sampler = current;
    current = null;
    if (sampler) sampler.running = false;
    return publish(sampler);
  };

  // Watches one element (and what is inside it) for `ms`, to tell whether the pointer blinks.
  qa.watchBlink = function (selector, ms) {
    return new Promise((resolve) => {
      const seen = [];
      let animations = 0;
      const started = performance.now();
      const look = (el) => {
        const cs = getComputedStyle(el);
        return `${cs.display === 'none' ? 'none' : cs.visibility} ${Math.round(Number(cs.opacity) * 100) / 100}`;
      };
      const tick = () => {
        const el = [...document.querySelectorAll(selector)].find(hasBox) || null;
        if (!el) seen.push('absent');
        else {
          const inner = [...el.querySelectorAll('*')].slice(0, 6);
          seen.push([look(el), ...inner.map(look), (el.textContent || '').trim()].join(' / '));
          if (typeof el.getAnimations === 'function') {
            animations = Math.max(animations, el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length);
          }
        }
        if (performance.now() - started < ms) requestAnimationFrame(tick);
        else resolve({ frames: seen.length, states: [...new Set(seen)].slice(0, 6), animations });
      };
      tick();
    });
  };

  // ---- pointing at things -------------------------------------------------------------------

  qa.findHotspot = function (id) {
    const all = [...document.querySelectorAll('[data-hotspot]')].filter((el) => el.getAttribute('data-hotspot') === id);
    return all.find(isVisible) || all[0] || null;
  };

  // A point where a real click would land on the element, or the reason there is none.
  function hitPoint(el) {
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    if (!isVisible(el)) return { found: true, visible: false, desc: describe(el) };
    const steps = [0.5, 0.25, 0.75, 0.1, 0.9];
    let blocker = null;
    for (const fy of steps) {
      for (const fx of steps) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        const top = document.elementFromPoint(x, y);
        if (top && (top === el || el.contains(top))) return { found: true, visible: true, x, y, desc: describe(el) };
        if (!blocker && top) blocker = { desc: describe(top), hotspot: top.closest('[data-hotspot]')?.getAttribute('data-hotspot') ?? null };
      }
    }
    return { found: true, visible: true, x: null, y: null, blocker, desc: describe(el) };
  }
  qa.hit = function (target) {
    const el = target.hotspot != null ? qa.findHotspot(target.hotspot) : document.querySelector(target.selector);
    return hitPoint(el);
  };
  qa.focusOn = function (target) {
    const el = target.hotspot != null ? qa.findHotspot(target.hotspot) : document.querySelector(target.selector);
    if (!el) return false;
    el.focus();
    return document.activeElement === el;
  };

  qa.focusInfo = function () {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) {
      return { none: true, desc: el ? `<${el.tagName.toLowerCase()}>` : 'nothing' };
    }
    const cs = getComputedStyle(el);
    const pointer = [...document.querySelectorAll('[data-pointer]')].find(hasBox);
    return {
      none: false,
      desc: describe(el),
      tag: el.tagName,
      hotspot: el.getAttribute('data-hotspot'),
      pressStart: el.hasAttribute('data-press-start') || !!el.closest('[data-press-start]'),
      inDialog: !!el.closest('[data-dialog]'),
      scene: el.closest('[data-scene]')?.getAttribute('data-scene') ?? null,
      inStage: !!el.closest('[data-stage]'),
      inHud: !!el.closest('[data-hud]'),
      inApp: !!el.closest('[data-route]'),
      href: el.getAttribute('href'),
      name: accName(el),
      rect: rectOf(el),
      outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}` : null,
      boxShadow: cs.boxShadow !== 'none',
      focusVisible: el.matches(':focus-visible'),
      pointer: pointer ? rectOf(pointer) : null,
    };
  };

  // ---- colors -------------------------------------------------------------------------------

  const colorCache = new Map();
  let canvas = null;
  function toRgba(raw) {
    if (colorCache.has(raw)) return colorCache.get(raw);
    let out = null;
    const m = /^rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(raw);
    if (m) {
      const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      out = [Number(m[1]), Number(m[2]), Number(m[3]), alpha];
    } else {
      // Any other syntax (oklch, color(), color-mix results): let a canvas convert it to sRGB bytes.
      try {
        canvas = canvas || document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = raw;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        out = [d[0], d[1], d[2], Math.round((d[3] / 255) * 100) / 100];
      } catch {
        out = null;
      }
    }
    colorCache.set(raw, out);
    return out;
  }
  const COLOR_TOKEN = /(?:rgba?|hsla?|oklch|oklab|lch|lab|color|hwb)\([^()]*(?:\([^()]*\)[^()]*)*\)|#[0-9a-fA-F]{3,8}\b/g;

  function collectPalette() {
    const roots = [];
    const add = (selector, name) =>
      document.querySelectorAll(selector).forEach((el) => {
        if (isVisible(el)) roots.push([name, el]);
      });
    add('[data-hud]', 'hud');
    add('[data-dialog]', 'dialog');
    add('[data-label-for]', 'label');
    add('[data-view="list"]', 'list');
    add('[data-rotate-gate]', 'rotate screen');
    const seen = new Map();
    const gradients = [];
    const note = (root, prop, raw, el) => {
      const key = `${root}|${prop}|${raw}`;
      let entry = seen.get(key);
      if (!entry) {
        entry = { root, prop, raw, rgba: toRgba(raw), count: 0, sample: describe(el) };
        seen.set(key, entry);
      }
      entry.count++;
    };
    for (const [name, rootEl] of roots) {
      let n = 0;
      for (const el of [rootEl, ...rootEl.querySelectorAll('*')]) {
        if (++n > 4000) break;
        if (el.tagName === 'IMG' || el.tagName === 'BR') continue;
        if (el.closest('[data-ground], [data-character]')) continue; // art, not UI: it brings its own colors
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim());
        if (hasText) {
          note(name, 'color', cs.color, el);
          if (cs.textDecorationLine && cs.textDecorationLine !== 'none') note(name, 'text-decoration-color', cs.textDecorationColor, el);
          if (cs.textShadow && cs.textShadow !== 'none') for (const c of cs.textShadow.match(COLOR_TOKEN) || []) note(name, 'text-shadow', c, el);
        }
        note(name, 'background-color', cs.backgroundColor, el);
        for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
          const style = cs[`border${side}Style`];
          if (parseFloat(cs[`border${side}Width`]) > 0 && style !== 'none' && style !== 'hidden') note(name, 'border-color', cs[`border${side}Color`], el);
        }
        if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) note(name, 'outline-color', cs.outlineColor, el);
        if (cs.boxShadow && cs.boxShadow !== 'none') for (const c of cs.boxShadow.match(COLOR_TOKEN) || []) note(name, 'box-shadow', c, el);
        if (cs.backgroundImage && cs.backgroundImage.includes('gradient(') && gradients.length < 6) gradients.push(`${name}: ${describe(el)}`);
      }
    }
    return { colors: [...seen.values()].filter((e) => e.rgba && e.rgba[3] > 0), gradients, roots: roots.length, plates: plateColors() };
  }

  // Colors the page declares for label chips that lie on a plate painted in the art: custom
  // properties named --color-plate-* on :root. Labels may use these besides the NES palette.
  function plateColors() {
    const found = new Map();
    const visit = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules && rule.cssRules.length) visit(rule.cssRules);
        if (!rule.style || !/(^|,)\s*:(root|host)\b/.test(rule.selectorText || '')) continue;
        for (const name of rule.style) {
          if (!name.startsWith('--color-plate-')) continue;
          const rgba = toRgba(rule.style.getPropertyValue(name).trim());
          if (rgba) found.set(name, rgba);
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        visit(sheet.cssRules);
      } catch {
        /* a sheet from another origin: its rules cannot be read */
      }
    }
    return [...found].map(([name, rgba]) => ({ name, rgba }));
  }

  // ---- the ground and the character ---------------------------------------------------------

  const urlsOf = (value) => [...String(value || '').matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g)].map((m) => m[2]);
  const fileOf = (url) => String(url).split('#')[0].split('?')[0].split('/').pop().slice(0, 80);

  /** The elements of a ground that paint a tile: every one in it with a background image. */
  function tileLayers(ground) {
    const out = [];
    for (const el of [ground, ...ground.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      const urls = urlsOf(cs.backgroundImage);
      if (urls.length) out.push({ el, urls, cs });
    }
    return out;
  }

  /** True when the browser has this image: it was fetched, or it is in the cache and decodes at once. */
  function imageLoaded(url) {
    let abs;
    try {
      abs = new URL(url, document.baseURI).href;
    } catch {
      return false;
    }
    if (abs.startsWith('data:')) return true;
    if (performance.getEntriesByName(abs).some((entry) => entry.responseEnd > 0)) return true;
    const probe = new Image();
    probe.src = abs;
    return probe.complete && probe.naturalWidth > 0;
  }

  /** Animations running on an element or inside it, with the properties each one changes. */
  function runningAnimations(el) {
    if (typeof el.getAnimations !== 'function') return [];
    return el
      .getAnimations({ subtree: true })
      .filter((a) => a.playState === 'running')
      .map((a) => {
        const props = new Set();
        try {
          for (const frame of a.effect?.getKeyframes?.() ?? []) {
            for (const key of Object.keys(frame)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(key)) props.add(key);
          }
        } catch {
          /* no keyframes to read */
        }
        return { name: a.animationName || a.id || 'animation', on: describe(a.effect?.target), props: [...props] };
      });
  }

  function groundFacts(el) {
    const scene = el.closest('[data-scene]');
    const cs = getComputedStyle(el);
    const layers = tileLayers(el);
    return {
      kind: el.getAttribute('data-ground'),
      scene: scene ? scene.getAttribute('data-scene') : null,
      sceneVisible: scene ? isVisible(scene) : true,
      inStage: !!el.closest('[data-stage]'),
      visible: isVisible(el),
      rect: rectOf(el),
      color: toRgba(cs.backgroundColor),
      tiles: layers.map((layer) => ({
        files: layer.urls.map(fileOf),
        loaded: layer.urls.every(imageLoaded),
        size: layer.cs.backgroundSize,
        repeat: layer.cs.backgroundRepeat,
        rendering: layer.cs.imageRendering,
        // The box as laid out, before any transform: how much there is to paint.
        box: { w: layer.el.offsetWidth, h: layer.el.offsetHeight },
      })),
      animations: runningAnimations(el),
    };
  }

  /** Which frame of its sheet a character shows: how many windows the sheet has slid to the left. */
  function frameOf(el) {
    const img = el.querySelector('img');
    if (!img) return null;
    const box = el.getBoundingClientRect();
    const sheet = img.getBoundingClientRect();
    if (box.width <= 0) return null;
    return Math.round((box.left - sheet.left) / box.width);
  }

  function characterFacts(el) {
    const scene = el.closest('[data-scene]');
    const img = el.querySelector('img');
    return {
      for: el.getAttribute('data-character'),
      pose: el.getAttribute('data-pose'),
      scene: scene ? scene.getAttribute('data-scene') : null,
      sceneVisible: scene ? isVisible(scene) : true,
      visible: isVisible(el),
      hidden: !!el.closest('[aria-hidden="true"]'),
      rect: rectOf(el),
      frame: frameOf(el),
      sheet: img
        ? { file: fileOf(img.currentSrc || img.getAttribute('src') || ''), complete: img.complete, naturalW: img.naturalWidth, naturalH: img.naturalHeight, rect: rectOf(img), rendering: getComputedStyle(img).imageRendering }
        : null,
      animations: runningAnimations(el),
    };
  }

  // Watches the character for `ms`: the frames he shows, in order, and the poses he takes.
  qa.watchCharacter = function (ms) {
    return new Promise((resolve) => {
      const frames = [];
      const poses = [];
      const started = performance.now();
      const tick = () => {
        const el = [...document.querySelectorAll('[data-character]')].find(isVisible);
        if (el) {
          const frame = frameOf(el);
          if (frame !== null && frames[frames.length - 1] !== frame) frames.push(frame);
          const pose = el.getAttribute('data-pose');
          if (poses[poses.length - 1] !== pose) poses.push(pose);
        }
        if (performance.now() - started < ms) requestAnimationFrame(tick);
        else resolve({ frames, poses, found: frames.length > 0 });
      };
      tick();
    });
  };

  // The ground probe. `on`: every tile of every visible ground is swapped for a loud two-color
  // checker of the same size, so a screenshot shows exactly where tiles are painted: any pixel
  // that still has the ground's plain base color is ground with no tile on it. `off`: back as it was.
  const PROBE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 2 2' preserveAspectRatio='none' shape-rendering='crispEdges'%3E%3Crect width='2' height='2' fill='%23ff00ff'/%3E%3Crect width='1' height='1' fill='%23141414'/%3E%3Crect x='1' y='1' width='1' height='1' fill='%23141414'/%3E%3C/svg%3E\")";
  let probed = [];
  qa.groundProbe = async function (on) {
    for (const [el, was] of probed) el.style.backgroundImage = was;
    probed = [];
    if (!on) return { layers: 0 };
    const grounds = [...document.querySelectorAll('[data-ground]')].filter(isVisible);
    let layers = 0;
    for (const ground of grounds) {
      for (const layer of tileLayers(ground)) {
        probed.push([layer.el, layer.el.style.backgroundImage]);
        layer.el.style.backgroundImage = layer.urls.map(() => PROBE).join(', ');
        layers++;
      }
    }
    // The pattern is an image like any other: wait until it is decoded and has been painted.
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = PROBE.slice(5, -2);
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { layers, grounds: grounds.length };
  };

  // ---- dialog -------------------------------------------------------------------------------

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function dialogFacts(dlg) {
    const box = dlg.getBoundingClientRect();
    const tol = 1;
    const clipped = [];
    let scrolls = false;
    let scrollsSideways = false;
    let visibleLines = null; // lines of text the scrolling part shows at a time
    const tiny = (el) => el.clientWidth <= 2 && el.clientHeight <= 2;
    for (const el of [dlg, ...dlg.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || tiny(el)) continue;
      const extraX = el.scrollWidth - el.clientWidth;
      const extraY = el.scrollHeight - el.clientHeight;
      const hides = (v) => v === 'hidden' || v === 'clip';
      const scrollable = (v) => v === 'auto' || v === 'scroll';
      if (extraX > tol && hides(cs.overflowX)) clipped.push(`${describe(el)} cuts off ${Math.round(extraX)} px of its content sideways (overflow-x: ${cs.overflowX})`);
      if (extraY > tol && hides(cs.overflowY)) clipped.push(`${describe(el)} cuts off ${Math.round(extraY)} px of its content at the bottom (overflow-y: ${cs.overflowY})`);
      if (extraY > tol && scrollable(cs.overflowY)) {
        const line = parseFloat(cs.lineHeight);
        if (!scrolls && line > 0) visibleLines = r3(el.clientHeight / line);
        scrolls = true;
      }
      if (extraX > tol && scrollable(cs.overflowX)) scrollsSideways = true;
    }
    // Text that pokes out of the dialog box without anything scrolling it.
    const spills = [];
    const walker = document.createTreeWalker(dlg, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let nodes = 0;
    while (walker.nextNode() && nodes < 1500) {
      const node = walker.currentNode;
      if (!node.nodeValue.trim()) continue;
      nodes++;
      const parent = node.parentElement;
      if (!parent) continue;
      let contained = false;
      for (let el = parent; el; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || tiny(el) || cs.clipPath !== 'none') {
          contained = true; // hidden on purpose (for example screen-reader-only text)
          break;
        }
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          contained = true; // clipped or scrolled by this ancestor: covered by the loop above
          break;
        }
        if (el === dlg) break;
      }
      if (contained) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width === 0 || r.height === 0) continue;
        const out = Math.max(box.left - r.left, r.right - box.right, box.top - r.top, r.bottom - box.bottom);
        if (out > tol) {
          spills.push(`"${node.nodeValue.replace(/\s+/g, ' ').trim().slice(0, 40)}" sticks ${Math.round(out)} px out of the dialog box`);
          break;
        }
      }
    }
    const labelledBy = dlg.getAttribute('aria-labelledby');
    const labelText = labelledBy
      ? labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      : (dlg.getAttribute('aria-label') || '').trim();
    const focusables = [...dlg.querySelectorAll(FOCUSABLE)].filter(isVisible);
    const back = focusables.find((el) => /\bback\b/i.test(accName(el)) || /\bback\b/i.test(el.textContent || ''));
    return {
      id: dlg.getAttribute('data-dialog'),
      role: dlg.getAttribute('role'),
      ariaModal: dlg.getAttribute('aria-modal'),
      labelledBy,
      labelText,
      rect: rectOf(dlg),
      inStage: !!dlg.closest('[data-stage]'),
      clipped: clipped.slice(0, 8),
      spills: spills.slice(0, 8),
      scrolls,
      scrollsSideways,
      visibleLines,
      focusables: focusables.length,
      backButton: back ? describe(back) : null,
      textLength: (dlg.innerText || '').trim().length,
    };
  }
  qa.dialogBackPoint = function () {
    const dlg = [...document.querySelectorAll('[data-dialog]')].find(isVisible);
    if (!dlg) return { found: false };
    const back = [...dlg.querySelectorAll(FOCUSABLE)].filter(isVisible).find((el) => /\bback\b/i.test(accName(el)) || /\bback\b/i.test(el.textContent || ''));
    if (back) back.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return hitPoint(back || null);
  };
  // Scrolls the dialog's scrolling part to the end; returns false when nothing scrolls.
  qa.scrollDialogToEnd = function () {
    const dlg = [...document.querySelectorAll('[data-dialog]')].find(isVisible);
    if (!dlg) return false;
    for (const el of [dlg, ...dlg.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight - el.clientHeight > 1) {
        el.scrollTop = el.scrollHeight;
        return true;
      }
    }
    return false;
  };

  // ---- inspect ------------------------------------------------------------------------------

  qa.inspect = function () {
    const out = { state: qa.state() };
    const doc = document.documentElement;
    const scroller = document.scrollingElement || doc;
    out.viewport = {
      w: innerWidth,
      h: innerHeight,
      dpr: devicePixelRatio,
      clientW: doc.clientWidth,
      clientH: doc.clientHeight,
      scrollW: scroller.scrollWidth,
      scrollH: scroller.scrollHeight,
      visualScale: window.visualViewport ? r3(visualViewport.scale) : 1,
      overflowing: [],
    };
    if (scroller.scrollWidth > doc.clientWidth + 1 && document.body) {
      const wide = [];
      for (const el of document.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > doc.clientWidth + 1) wide.push(el);
      }
      const set = new Set(wide);
      out.viewport.overflowing = wide
        .filter((el) => ![...el.children].some((child) => set.has(child)))
        .slice(0, 4)
        .map((el) => `${describe(el)} (right edge at ${Math.round(el.getBoundingClientRect().right)} px)`);
    }

    out.env = {
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      hover: matchMedia('(hover: hover)').matches,
      touchPoints: navigator.maxTouchPoints,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      portrait: matchMedia('(orientation: portrait)').matches,
    };

    out.routeRoots = document.querySelectorAll('[data-route]').length;
    out.h1 = [...document.querySelectorAll('h1')].map((h) => ({ text: (h.textContent || '').replace(/\s+/g, ' ').trim(), visible: isVisible(h) }));
    out.cursorNone = document.body ? getComputedStyle(document.body).cursor === 'none' || getComputedStyle(doc).cursor === 'none' : false;

    // Stage, scene images and the page background around the stage.
    const stage = document.querySelector('[data-stage]');
    out.stage = null;
    out.images = [];
    out.backgroundImages = [];
    out.background = null;
    const hud = document.querySelector('[data-hud]');
    const hudVisible = !!hud && isVisible(hud);
    if (stage) {
      const cs = getComputedStyle(stage);
      const rect = rectOf(stage);
      out.stage = {
        rect,
        visible: isVisible(stage),
        count: document.querySelectorAll('[data-stage]').length,
        dataK: stage.getAttribute('data-k'),
        cssK: cs.getPropertyValue('--k').trim(),
        cssU: cs.getPropertyValue('--u').trim(),
        transition: stage.getAttribute('data-transition'),
      };
      out.images = [...stage.querySelectorAll('img')].map((img) => {
        const scene = img.closest('[data-scene]');
        return {
          src: (img.currentSrc || img.getAttribute('src') || '').split('/').pop().split('?')[0].slice(0, 60),
          rendering: getComputedStyle(img).imageRendering,
          complete: img.complete,
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
          rect: rectOf(img),
          visible: isVisible(img),
          scene: scene?.getAttribute('data-scene') ?? null,
          sceneVisible: scene ? isVisible(scene) : true,
          // A scene's own picture, as opposed to a character's sprite sheet.
          picture: !!scene && !img.closest('[data-character]'),
          inDialog: !!img.closest('[data-dialog]'),
        };
      });
      for (const el of [stage, ...stage.querySelectorAll('*')]) {
        const style = getComputedStyle(el);
        if (style.backgroundImage.includes('url(') && isVisible(el)) {
          out.backgroundImages.push({ desc: describe(el), rendering: style.imageRendering });
          if (out.backgroundImages.length >= 20) break;
        }
      }
      // The plain color behind everything: the page itself, and the area the stage sits in.
      const area = stage.parentElement;
      out.background = {
        html: toRgba(getComputedStyle(doc).backgroundColor),
        body: document.body ? toRgba(getComputedStyle(document.body).backgroundColor) : null,
        area: area ? toRgba(getComputedStyle(area).backgroundColor) : null,
        themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
        first: qa.first ? { rgba: toRgba(qa.first.color), hash: qa.first.hash } : null,
      };
    }
    out.grounds = [...document.querySelectorAll('[data-ground]')].map(groundFacts);
    out.characters = [...document.querySelectorAll('[data-character]')].map(characterFacts);

    // HUD and breadcrumb.
    out.hud = null;
    if (hud) {
      out.hud = {
        rect: rectOf(hud),
        visible: hudVisible,
        scrollW: hud.scrollWidth,
        clientW: hud.clientWidth,
        text: (hud.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300),
        links: [...hud.querySelectorAll('a')]
          .filter((a) => !a.closest('[data-breadcrumb]'))
          .map((a) => ({ text: accName(a), href: a.getAttribute('href'), abs: a.href, rect: rectOf(a), visible: isVisible(a) })),
      };
    }
    const crumb = document.querySelector('[data-breadcrumb]');
    out.breadcrumb = crumb
      ? {
          tag: crumb.tagName,
          inHud: !!crumb.closest('[data-hud]'),
          visible: isVisible(crumb),
          text: (crumb.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200),
          links: [...crumb.querySelectorAll('a')].map((a) => ({ text: accName(a), href: a.getAttribute('href'), visible: isVisible(a) })),
        }
      : null;

    // Fonts: what is declared, what has loaded, and what visible text actually asks for.
    noteFonts();
    const families = {};
    for (const face of document.fonts) {
      const family = unquote(face.family);
      (families[family] = families[family] || []).push(fontsLoaded.has(family) ? 'loaded' : face.status);
    }
    const used = {};
    const faux = [];
    if (document.body) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      let n = 0;
      while (walker.nextNode() && n < 5000) {
        const node = walker.currentNode;
        const el = node.parentElement;
        if (!el || seen.has(el) || !node.nodeValue.trim()) continue;
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
        seen.add(el);
        n++;
        const cs = getComputedStyle(el);
        const first = unquote(cs.fontFamily.split(',')[0]);
        used[first] = (used[first] || 0) + 1;
        if ((first === 'Press Start 2P' || first === 'VT323') && (Number(cs.fontWeight) > 500 || cs.fontStyle !== 'normal') && faux.length < 5) {
          faux.push(`${describe(el)} uses ${first} with font-weight ${cs.fontWeight} and font-style ${cs.fontStyle}`);
        }
      }
    }
    out.fonts = { status: document.fonts.status, families, used, faux };

    // Scenes, hotspots, labels, pointer.
    out.scenes = [...document.querySelectorAll('[data-scene]')].map((el) => ({ id: el.getAttribute('data-scene'), visible: isVisible(el), rect: rectOf(el) }));
    out.hotspots = [...document.querySelectorAll('[data-hotspot]')].map((el) => {
      const scene = el.closest('[data-scene]');
      return {
        id: el.getAttribute('data-hotspot'),
        tag: el.tagName,
        href: el.getAttribute('href'),
        abs: el.tagName === 'A' ? el.href : null,
        target: el.getAttribute('target'),
        name: accName(el),
        rect: rectOf(el),
        visible: isVisible(el),
        disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
        scene: scene ? scene.getAttribute('data-scene') : null,
        sceneVisible: scene ? isVisible(scene) : true,
        inStage: !!el.closest('[data-stage]'),
      };
    });
    // How much the transforms on a label and everything around it stretch it: 1 when it is drawn at its own size.
    const stretchOf = (el) => {
      let scale = 1;
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        const t = getComputedStyle(node).transform;
        if (t && t !== 'none') scale *= new DOMMatrixReadOnly(t).a;
      }
      return r3(scale);
    };
    out.labels = [...document.querySelectorAll('[data-label-for]')].map((el) => {
      const scene = el.closest('[data-scene]');
      return {
        for: el.getAttribute('data-label-for'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        rect: rectOf(el),
        stretch: stretchOf(el),
        visible: isVisible(el),
        scene: scene ? scene.getAttribute('data-scene') : null,
        sceneVisible: scene ? isVisible(scene) : true,
      };
    });
    // "visible" here means rendered: a blinking pointer may be in its hidden half when we look.
    const pointers = [...document.querySelectorAll('[data-pointer]')];
    const pointer = pointers.find(hasBox) || null;
    out.pointer = pointer ? { rect: rectOf(pointer), visible: true, count: pointers.length } : null;
    out.pressStart = (() => {
      const el = document.querySelector('[data-press-start]');
      return el ? { tag: el.tagName, name: accName(el), rect: rectOf(el), visible: hasBox(el) } : null; // it may blink
    })();

    // Dialog, list view, rotate screen.
    const dlg = [...document.querySelectorAll('[data-dialog]')].find(isVisible) || null;
    out.dialog = dlg ? dialogFacts(dlg) : null;

    const list = document.querySelector('[data-view="list"]');
    out.list = list
      ? {
          visible: isVisible(list),
          rect: rectOf(list),
          text: list.innerText || '',
          headings: [...list.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent || '').replace(/\s+/g, ' ').trim() })),
          links: [...list.querySelectorAll('a')].slice(0, 300).map((a) => ({ text: accName(a), href: a.getAttribute('href') })),
        }
      : null;

    const gate = document.querySelector('[data-rotate-gate]');
    out.gate = null;
    if (gate) {
      const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      out.gate = {
        visible: isVisible(gate),
        rect: rectOf(gate),
        onTop: !!top && (top === gate || gate.contains(top)),
        text: (gate.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        links: [...gate.querySelectorAll('a')].map((a) => ({ text: accName(a), href: a.getAttribute('href'), visible: isVisible(a) })),
      };
    }

    out.palette = collectPalette();
    out.focus = qa.focusInfo();
    return out;
  };
}
