// Turns the facts from qa/lib/inpage.mjs into check results: { id, status: pass | fail | warn, message, details? }.
// These are the generic checks that run at every stop (ENGINE.md section 10).
import { stem } from './art.mjs';
import { CHARACTER, DIALOG_MIN_LINES, FONTS, HUD_MAX, HUD_MIN, MIN_TARGET, POS_TOLERANCE, ROOMS, SCENE_H, SCENE_W, groundFor } from './config.mjs';
import { clip, fmt, fmtRect, hex, itemForRoute, sceneForRoute, summarize } from './util.mjs';

// The NES palette comes from art/scripts/nes-palette.mjs. walk.mjs loads it and hands it over,
// so a problem with that file ends up in the report instead of stopping the harness.
let NES_PALETTE = null;
let PALETTE = null;
let nearestIndex = null;
export function usePalette(module) {
  NES_PALETTE = module.NES_PALETTE;
  nearestIndex = module.nearestIndex;
  PALETTE = new Set(NES_PALETTE.map(hex));
}

/** One result from a list of problems: pass when the list is empty. */
function verdict(id, problems, passMessage, level = 'fail') {
  if (!problems.length) return { id, status: 'pass', message: passMessage };
  const result = { id, status: level, message: summarize(problems) };
  if (problems.length > 1) result.details = problems;
  return result;
}

const overlap = (a, b) => ({
  w: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
  h: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
});
const inside = (inner, outer, tol = 0.5) =>
  inner.x >= outer.x - tol && inner.y >= outer.y - tol && inner.x + inner.w <= outer.x + outer.w + tol && inner.y + inner.h <= outer.y + outer.h + tol;

// ---- scrolling ------------------------------------------------------------------------------

function checkScroll(facts, ctx) {
  const v = facts.viewport;
  const problems = [];
  if (v.scrollW > v.clientW + 1) {
    const who = v.overflowing.length ? `: ${v.overflowing.join(', ')}` : '';
    problems.push(`the page is ${v.scrollW} px wide in a ${v.clientW} px viewport, so it scrolls sideways${who}`);
  }
  if (Math.abs(v.w - ctx.profile.width) > 1 && !ctx.resized) {
    problems.push(`the layout is ${v.w} px wide on a ${ctx.profile.width} px screen (content wider than the screen makes a phone zoom out)`);
  }
  const out = [verdict('no-horizontal-scroll', problems, `no horizontal scrolling (${v.scrollW} px content in ${v.clientW} px)`)];
  if (ctx.kind === 'scene' && v.scrollH > v.clientH + 1) {
    out.push({ id: 'no-vertical-scroll', status: 'warn', message: `a world view should not scroll, but the page is ${v.scrollH} px tall in a ${v.clientH} px viewport` });
  }
  return out;
}

// ---- stage and scaling (ENGINE.md section 5) ------------------------------------------------

function checkScale(facts) {
  const stage = facts.stage;
  if (!stage) return [{ id: 'scale', status: 'fail', message: 'no [data-stage] element, so the scaling rule cannot be checked' }];
  const { w: vw, h: vh, dpr } = facts.viewport;
  const rect = stage.rect;
  const k = Number(stage.dataK);
  const problems = [];
  const soft = [];

  if (stage.count > 1) problems.push(`${stage.count} elements have data-stage, expected one`);
  if (stage.dataK === null || stage.dataK === '' || !Number.isFinite(k) || k <= 0) {
    problems.push(`data-k is ${JSON.stringify(stage.dataK)}, expected the scale as a positive number`);
  } else {
    const devicePixels = k * dpr;
    if (Math.abs(devicePixels - Math.round(devicePixels)) > 1e-3) {
      problems.push(`k x devicePixelRatio = ${fmt(k)} x ${dpr} = ${fmt(devicePixels)}, which is not a whole number of device pixels per scene pixel`);
    }
    if (Math.abs(rect.w - SCENE_W * k) > 0.5 || Math.abs(rect.h - SCENE_H * k) > 0.5) {
      problems.push(`the stage is ${fmt(rect.w)}x${fmt(rect.h)} CSS px, expected ${fmt(SCENE_W * k)}x${fmt(SCENE_H * k)} (320k x 180k with k = ${fmt(k)})`);
    }
    if (stage.cssK && Math.abs(Number(stage.cssK) - k) > 1e-3) problems.push(`--k is ${stage.cssK} but data-k is ${stage.dataK}`);
    if (!stage.cssK) soft.push('the stage does not set --k');
    if (!stage.cssU) soft.push('the stage does not set --u');
    else if (/px$/.test(stage.cssU) && Math.abs(parseFloat(stage.cssU) - k) > 1e-3) soft.push(`--u is ${stage.cssU}, expected ${fmt(k)}px`);
  }
  if (!inside(rect, { x: 0, y: 0, w: vw, h: vh })) {
    problems.push(`the stage ${fmtRect(rect)} does not fit inside the ${vw}x${vh} viewport`);
  }
  const hud = facts.hud && facts.hud.visible ? facts.hud.rect : null;
  if (hud) {
    const under = overlap(rect, hud);
    if (under.w > 0.5 && under.h > 0.5) problems.push(`the stage is under the HUD by ${fmt(under.h)} px (the available area is the viewport minus the HUD)`);
  }
  const out = [verdict('scale', problems, `k = ${fmt(k)} (${fmt(k * dpr)} device px per scene px), stage ${fmt(rect.w)}x${fmt(rect.h)} inside ${vw}x${vh}`)];

  // The exact k from the formula, centering, and whole device pixels for the stage origin.
  if (Number.isFinite(k) && k > 0) {
    const hudHeight = hud ? hud.y + hud.h : 0;
    const fit = Math.min(vw / SCENE_W, (vh - hudHeight) / SCENE_H);
    const expected = Math.max(1 / dpr, Math.floor(fit * dpr + 1e-9) / dpr);
    if (k > expected + 1e-3) {
      out.push({ id: 'scale-fit', status: 'fail', message: `k = ${fmt(k)} is larger than the rule allows: floor(fit x dpr) / dpr = ${fmt(expected)} for ${vw}x${fmt(vh - hudHeight)} available` });
    } else {
      if (k < expected - 1e-3) soft.push(`k = ${fmt(k)} but the largest crisp scale that fits ${vw}x${fmt(vh - hudHeight)} is ${fmt(expected)}`);
      const left = rect.x;
      const right = vw - (rect.x + rect.w);
      if (Math.abs(left - right) > 1.01) soft.push(`the stage is not centered: ${fmt(left)} px free on the left, ${fmt(right)} px on the right`);
      const top = rect.y - hudHeight;
      const bottom = vh - (rect.y + rect.h);
      if (top >= -0.5 && Math.abs(top - bottom) > 1.01) soft.push(`the stage is not centered below the HUD: ${fmt(top)} px free above, ${fmt(bottom)} px below`);
      const offGrid = (n) => Math.abs(n * dpr - Math.round(n * dpr)) > 0.02;
      if (offGrid(rect.x) || offGrid(rect.y)) soft.push(`the stage starts at (${fmt(rect.x)}, ${fmt(rect.y)}) CSS px, which is not on a whole device pixel, so scene pixels can come out uneven`);
      out.push(verdict('scale-fit', soft, `k matches the rule (${fmt(expected)}), the stage is centered and starts on a whole device pixel`, 'warn'));
    }
  }
  return out;
}

// ---- the plain color behind everything -------------------------------------------------------

const sameColor = (rgba, rgb) => !!rgba && rgba[3] >= 1 && hex(rgba.slice(0, 3)) === hex(rgb);
const shown = (rgba) => (rgba ? `${hex(rgba.slice(0, 3))}${rgba[3] < 1 ? ` at ${fmt(rgba[3] * 100)}% opacity` : ''}` : 'no color');

/**
 * Behind the ground's tiles the page has the ground's base color (art/approved/hd/backdrops.json):
 * it is what shows until the tiles have loaded, and around the page when it is pulled past its edge.
 */
function checkBackground(facts, ctx, scene) {
  const bg = facts.background;
  if (!bg || !scene) return [];
  const grounds = ctx.art?.grounds;
  if (!grounds) return [{ id: 'page-background', status: 'fail', message: 'the ground colors could not be read from art/approved/hd/backdrops.json, so the page background is unchecked' }];
  const want = grounds[groundFor(scene)];
  const problems = [];
  // The page itself has to have the color; what lies on it may be see-through, and shows it then.
  if (!sameColor(bg.html, want.color)) problems.push(`the page itself (<html>) is ${shown(bg.html)}, expected the ${want.id} color ${want.hex} behind the ${scene} scene`);
  for (const [what, got] of [['<body>', bg.body], ['the area around the stage', bg.area]]) {
    if (!got || got[3] === 0) continue;
    if (!sameColor(got, want.color)) problems.push(`the background of ${what} is ${shown(got)}, expected the ${want.id} color ${want.hex} for the ${scene} scene`);
  }
  if (bg.themeColor !== null && bg.themeColor.trim().toUpperCase() !== grounds.ocean.hex) {
    problems.push(`<meta name="theme-color"> is ${bg.themeColor}, expected the sea color ${grounds.ocean.hex}`);
  }
  // What was painted before the app ran, for the address the page was opened at.
  if (bg.first?.rgba) {
    const firstScene = sceneForRoute(routeOf(bg.first.hash));
    const firstWant = firstScene ? grounds[groundFor(firstScene)].color : [0, 0, 0];
    if (!sameColor(bg.first.rgba, firstWant)) {
      problems.push(`before the app loaded the page was ${shown(bg.first.rgba)}, expected ${hex(firstWant)} for a page opened at "${bg.first.hash || '#/'}" (index.html paints it)`);
    }
  }
  return [verdict('page-background', problems, `the page behind the ${scene} scene is the ${want.id} color ${want.hex}, also before the app loads`, 'warn')];
}

/** "#/about/me" -> "/about/me", the way the page's own hashRoute reads it; unknown places count as the overworld. */
function routeOf(hash) {
  let h = String(hash ?? '').replace(/^#/, '');
  if (h === '' || h === '/') return '/';
  if (!h.startsWith('/')) h = `/${h}`;
  h = h.replace(/\/+$/, '') || '/';
  if (h === '/list') return h;
  return sceneForRoute(h) === null ? '/world' : h;
}

// ---- the art: high-definition pictures, scaled smoothly ---------------------------------------

const SMOOTH = (rendering) => rendering !== 'pixelated' && rendering !== 'crisp-edges';

function checkArt(facts, ctx, scene) {
  if (!facts.stage) return [];
  const images = facts.images.filter((img) => !img.inDialog);
  const mine = images.filter((img) => img.sceneVisible && (img.scene === scene || img.scene === null));
  const pictures = mine.filter((img) => img.picture);
  const out = [];

  const smooth = [];
  if (!images.some((img) => img.scene)) smooth.push('no scene <img> found inside the stage');
  for (const img of images) {
    if (!SMOOTH(img.rendering)) smooth.push(`<img ${img.src}> has image-rendering: ${img.rendering}; the high-definition art is scaled smoothly, never pixelated`);
    if (!img.complete || img.naturalW === 0) smooth.push(`<img ${img.src}> has not loaded`);
  }
  for (const bg of facts.backgroundImages) {
    if (!SMOOTH(bg.rendering)) smooth.push(`${bg.desc} paints a background image with image-rendering: ${bg.rendering}; the art is scaled smoothly, never pixelated`);
  }
  out.push(verdict('art-smooth', smooth, `${images.length} image(s) in the stage are loaded and scaled smoothly`));

  // Each scene has one picture, at the size the art pipeline makes them.
  const hd = [];
  if (scene && pictures.length !== 1) hd.push(`the ${scene} scene has ${pictures.length} pictures, expected one`);
  const size = ctx.art?.picture;
  if (!size) hd.push('the picture size could not be read from art/approved/hd/backdrops.json');
  else {
    for (const img of pictures) {
      if (img.naturalW && (img.naturalW !== size[0] || img.naturalH !== size[1])) {
        hd.push(`<img ${img.src}> is ${img.naturalW}x${img.naturalH} of its own pixels, expected the high-definition picture, ${size[0]}x${size[1]}`);
      }
    }
  }
  out.push(verdict('art-hd', hd, `the ${scene ?? ''} picture is ${size ? `${size[0]}x${size[1]}` : 'high-definition'}`));

  // Where the picture is: across the whole stage, or on the title screen in its small box.
  const k = Number(facts.stage.dataK);
  if (scene && pictures.length === 1 && Number.isFinite(k) && k > 0 && !ctx.dialogOpen) {
    const stage = facts.stage.rect;
    let want = stage;
    let where = 'the whole stage';
    if (scene === 'title') {
      const box = ctx.art?.title?.overworldRect;
      if (!box) return [...out, { id: 'art-placed', status: 'fail', message: 'title.json could not be read, so the place of the island on the title screen is unchecked' }];
      want = { x: stage.x + box[0] * k, y: stage.y + box[1] * k, w: box[2] * k, h: box[3] * k };
      where = `the title screen's box [${box.join(', ')}]`;
    }
    const got = pictures[0].rect;
    const off = Math.max(Math.abs(got.x - want.x), Math.abs(got.y - want.y), Math.abs(got.x + got.w - want.x - want.w), Math.abs(got.y + got.h - want.y - want.h));
    out.push(
      off <= 1
        ? { id: 'art-placed', status: 'pass', message: `the picture is drawn across ${where}` }
        : { id: 'art-placed', status: 'fail', message: `the picture is at ${fmtRect(got)}, expected ${where}: ${fmtRect(want)}` },
    );
  }
  return out;
}

// ---- the ground: sea or grass over the whole view ---------------------------------------------

/** Properties an animation can change without anything being painted again. */
const COMPOSITED = new Set(['transform', 'opacity', 'translate', 'scale', 'rotate']);

function checkGround(facts, ctx, scene) {
  if (!facts.stage || !scene) return [];
  const want = ctx.art?.grounds?.[groundFor(scene)];
  if (!want) return [{ id: 'ground', status: 'fail', message: 'the grounds could not be read from art/approved/hd/backdrops.json, so the ground is unchecked' }];
  const all = facts.grounds.filter((g) => g.inStage && g.sceneVisible && (g.scene === scene || g.scene === null));
  const visible = all.filter((g) => g.visible);
  const { w: vw, h: vh } = facts.viewport;
  const hudBottom = facts.hud && facts.hud.visible ? facts.hud.rect.y + facts.hud.rect.h : 0;
  const problems = [];
  const out = [];

  if (!visible.length) {
    problems.push(all.length ? `the ${scene} scene's [data-ground] is not visible` : `the ${scene} scene has no [data-ground] element: nothing covers the view around the picture`);
    return [verdict('ground', problems, '')];
  }
  if (visible.length > 1) problems.push(`${visible.length} grounds are visible in the ${scene} scene, expected one`);
  const g = visible[0];
  if (g.kind !== want.id) problems.push(`the ground behind the ${scene} scene is "${g.kind}", expected "${want.id}"`);

  // It covers everything below the HUD, to the edges of the window.
  const r = g.rect;
  const gaps = [];
  if (r.x > 0.5) gaps.push(`${fmt(r.x)} px on the left`);
  if (r.y > hudBottom + 0.5) gaps.push(`${fmt(r.y - hudBottom)} px under the HUD`);
  if (r.x + r.w < vw - 0.5) gaps.push(`${fmt(vw - r.x - r.w)} px on the right`);
  if (r.y + r.h < vh - 0.5) gaps.push(`${fmt(vh - r.y - r.h)} px at the bottom`);
  if (gaps.length) problems.push(`the ground ${fmtRect(r)} does not cover the view below the HUD (${vw}x${fmt(vh - hudBottom)}): it leaves ${gaps.join(', ')}`);

  if (!sameColor(g.color, want.color)) problems.push(`the ground's base color is ${shown(g.color)}, expected ${want.hex} (backdrops.json)`);

  // Its tiles: every frame the art lists, loaded, repeating, at the size the art gives.
  if (!g.tiles.length) problems.push('the ground paints no tile image: it is a flat color');
  const files = g.tiles.flatMap((t) => t.files);
  for (const frame of want.frames) {
    if (!files.some((file) => file.startsWith(stem(frame)))) problems.push(`the ground does not use the tile ${frame} (it paints ${files.join(', ') || 'no image'})`);
  }
  const k = Number(facts.stage.dataK);
  for (const tile of g.tiles) {
    const name = tile.files.join(', ');
    if (!tile.loaded) problems.push(`the ground's tile ${name} has not loaded`);
    if (!/repeat/.test(tile.repeat) || /no-repeat/.test(tile.repeat)) problems.push(`the ground's tile ${name} does not repeat (background-repeat: ${tile.repeat})`);
    if (!SMOOTH(tile.rendering)) problems.push(`the ground's tile ${name} has image-rendering: ${tile.rendering}; it is scaled smoothly like the scenes`);
    const size = /^([\d.]+)px ([\d.]+)px$/.exec(tile.size);
    if (Number.isFinite(k) && k > 0) {
      if (!size) problems.push(`the ground's tile ${name} has background-size: ${tile.size}, expected ${fmt(want.tile[0] * k)}px ${fmt(want.tile[1] * k)}px`);
      else if (Math.abs(Number(size[1]) - want.tile[0] * k) > 1.5 || Math.abs(Number(size[2]) - want.tile[1] * k) > 1.5) {
        problems.push(`the ground's tile ${name} is ${fmt(Number(size[1]))}x${fmt(Number(size[2]))} px, expected ${fmt(want.tile[0])}x${fmt(want.tile[1])} scene units x k=${fmt(k)}: ${fmt(want.tile[0] * k)}x${fmt(want.tile[1] * k)}`);
      }
    }
  }
  out.push(verdict('ground', problems, `the ${want.id} ground covers the whole view below the HUD with ${g.tiles.length} tile layer(s) (${files.join(', ')})`));

  // Not one enormous element: what is laid out to be painted stays close to the size of the view.
  const big = g.tiles.filter((t) => t.box.w > 2 * vw || t.box.h > 2.5 * vh).map((t) => `the tile layer ${t.files.join(', ')} is ${t.box.w}x${t.box.h} px in a ${vw}x${vh} window`);
  out.push(verdict('ground-size', big, 'the ground\'s tile layers are close to the size of the view'));

  // Its motion. A ground with two frames (the sea) moves, cheaply; under reduced motion nothing does.
  const motion = [];
  const running = g.animations;
  if (facts.env.reducedMotion) {
    if (running.length) motion.push(`${running.length} animation(s) run on the ground under reduced motion: ${summarize(running.map((a) => `${a.name} on ${a.on}`), 3)}`);
    out.push(verdict('ground-motion', motion, 'the ground is still under reduced motion'));
  } else {
    if (want.frames.length > 1 && !running.length) motion.push(`the ${want.id} has ${want.frames.length} frames but nothing on it is animated: the sea does not move`);
    for (const a of running) {
      const repaint = a.props.filter((p) => !COMPOSITED.has(p));
      if (repaint.length) motion.push(`the animation "${a.name}" on ${a.on} changes ${repaint.join(', ')}, which paints the ground again every frame; only transform and opacity are free`);
    }
    out.push(verdict('ground-motion', motion, running.length ? `the ${want.id} moves with ${running.length} animation(s) that change only transform and opacity` : `the ${want.id} is one still tile`));
  }
  return out;
}

// ---- the character in the cottage --------------------------------------------------------------

function checkCharacter(facts, ctx, scene) {
  if (!facts.stage || scene !== CHARACTER.scene) return [];
  const sprite = ctx.art?.mascot;
  if (!sprite) return [{ id: 'character', status: 'fail', message: 'art/approved/hd/mascot.json could not be read, so the character is unchecked' }];
  const all = facts.characters.filter((c) => c.sceneVisible && c.scene === scene);
  const visible = all.filter((c) => c.visible);
  const problems = [];
  if (!visible.length) {
    return [{ id: 'character', status: 'fail', message: all.length ? 'the [data-character] in the cottage is not visible' : `the ${scene} scene has no [data-character] element: the character is not standing in the cottage` }];
  }
  if (visible.length > 1) problems.push(`${visible.length} characters are visible, expected one`);
  const c = visible[0];
  const out = [];

  if (c.for !== CHARACTER.hotspot) problems.push(`data-character is "${c.for}", expected the hotspot he stands for, "${CHARACTER.hotspot}"`);
  const hotspot = facts.hotspots.find((h) => h.id === CHARACTER.hotspot && h.sceneVisible && h.scene === scene);
  if (!hotspot) problems.push(`there is no [data-hotspot="${CHARACTER.hotspot}"] to click him with`);
  if (!c.hidden) problems.push('the character\'s picture is not hidden from assistive technology (aria-hidden): his name belongs on the hotspot');

  // The sheet: the size the JSON gives, and one frame showing through a window one frame large.
  if (!c.sheet) problems.push('the character has no <img> for its sprite sheet');
  else {
    const [fw, fh] = sprite.frame;
    if (!c.sheet.complete || !c.sheet.naturalW) problems.push(`the sprite sheet ${c.sheet.file} has not loaded`);
    else if (c.sheet.naturalW !== fw * sprite.count || c.sheet.naturalH !== fh) {
      problems.push(`the sprite sheet is ${c.sheet.naturalW}x${c.sheet.naturalH}, but mascot.json describes ${sprite.count} frames of ${fw}x${fh} (${fw * sprite.count}x${fh})`);
    }
    if (c.rect.w > 0 && Math.abs(c.sheet.rect.w / c.rect.w - sprite.count) > 0.02) {
      problems.push(`the sheet is ${fmt(c.sheet.rect.w / c.rect.w)} frames wide on screen, but mascot.json says it holds ${sprite.count}`);
    }
    if (c.rect.w > 0 && c.rect.h > 0 && Math.abs(c.rect.w / c.rect.h - sprite.size[0] / sprite.size[1]) > 0.02) {
      problems.push(`one frame is drawn ${fmt(c.rect.w)}x${fmt(c.rect.h)} px, not in the proportion of mascot.json's size ${fmt(sprite.size[0])}x${fmt(sprite.size[1])}`);
    }
    if (!SMOOTH(c.sheet.rendering)) problems.push(`the sprite sheet has image-rendering: ${c.sheet.rendering}; it is scaled smoothly like the rest of the art`);
  }

  // Where he stands: the bottom center of a frame on the anchor. (Behind a dialog the camera has moved.)
  const k = Number(facts.stage.dataK);
  if (!ctx.dialogOpen && Number.isFinite(k) && k > 0) {
    const stage = facts.stage.rect;
    const [w, h] = sprite.size;
    const [ax, ay] = sprite.anchor;
    const want = { x: stage.x + (ax - w / 2) * k, y: stage.y + (ay - h) * k, w: w * k, h: h * k };
    const off = Math.max(Math.abs(c.rect.x - want.x), Math.abs(c.rect.y - want.y), Math.abs(c.rect.w - want.w), Math.abs(c.rect.h - want.h));
    if (off > POS_TOLERANCE) problems.push(`he is drawn at ${fmtRect(c.rect)}, but mascot.json puts a ${fmt(w)}x${fmt(h)} frame with its bottom center on [${sprite.anchor.join(', ')}]: ${fmtRect(want)}`);
  }

  // The frame he shows belongs to the animation of his pose.
  const pose = c.pose;
  if (pose !== 'idle' && pose !== 'wave') problems.push(`data-pose is ${JSON.stringify(pose)}, expected "idle" or "wave"`);
  else if (c.frame !== null) {
    const frames = facts.env.reducedMotion ? [sprite.animations.idle.frames[0]] : sprite.animations[pose].frames;
    if (!frames.includes(c.frame)) {
      problems.push(
        facts.env.reducedMotion
          ? `under reduced motion he shows frame ${c.frame}, expected him to stand still on frame ${frames[0]} (the first idle frame)`
          : `in the ${pose} pose he shows frame ${c.frame}, which is not one of mascot.json's ${pose} frames (${frames.join(', ')})`,
      );
    }
  }
  out.push(verdict('character', problems, `the character stands on [${sprite.anchor.join(', ')}] in the ${pose} pose, drawn from ${sprite.count} frames of ${sprite.frame.join('x')}`));

  // His pose follows what is going on: he waves with his dialog open or with focus on him.
  if (pose === 'idle' || pose === 'wave') {
    const open = facts.dialog?.id === CHARACTER.hotspot;
    // Keyboard focus: the browser shows its ring. Focus left on him by a click or a tap does not make him wave.
    const focused = facts.focus && !facts.focus.none && facts.focus.hotspot === CHARACTER.hotspot && facts.focus.focusVisible;
    const why = open ? 'his dialog is open' : focused ? 'keyboard focus is on him' : null;
    if (why && pose !== 'wave') out.push({ id: 'character-pose', status: 'fail', message: `he is in the ${pose} pose while ${why}, expected him to wave` });
    else if (!why && pose === 'wave' && !ctx.pointing) out.push({ id: 'character-pose', status: 'fail', message: 'he is waving although nothing points at him, focus is elsewhere and his dialog is closed' });
    else out.push({ id: 'character-pose', status: 'pass', message: why ? `he waves while ${why}` : `he is in the ${pose} pose` });
  }

  // His animation: running when the pose has more than one frame, never under reduced motion.
  const running = c.animations;
  const motion = [];
  if (facts.env.reducedMotion) {
    if (running.length) motion.push(`${running.length} animation(s) run on the character under reduced motion`);
    out.push(verdict('character-motion', motion, 'the character stands still under reduced motion'));
  } else if (pose === 'idle' || pose === 'wave') {
    const distinct = new Set(sprite.animations[pose].frames).size;
    if (distinct > 1 && !running.length) motion.push(`mascot.json's ${pose} animation has ${distinct} different frames but nothing on the character is animated`);
    for (const a of running) {
      const repaint = a.props.filter((p) => !COMPOSITED.has(p));
      if (repaint.length) motion.push(`the animation "${a.name}" changes ${repaint.join(', ')}; a sprite that slides by transform costs nothing while it runs`);
    }
    out.push(verdict('character-motion', motion, running.length ? `the ${pose} animation is running` : `the ${pose} pose is a single frame`));
  }
  return out;
}

// ---- fonts ----------------------------------------------------------------------------------

function checkFonts(facts) {
  const problems = [];
  const soft = [...facts.fonts.faux];
  for (const family of FONTS) {
    const statuses = facts.fonts.families[family];
    const usedBy = facts.fonts.used[family] || 0;
    if (!statuses) problems.push(`"${family}" has no @font-face on the page`);
    else if (statuses.includes('loaded')) continue;
    else if (statuses.includes('error')) problems.push(`"${family}" failed to load`);
    else if (usedBy > 0) problems.push(`"${family}" is used by ${usedBy} text element(s) but has not loaded (status: ${[...new Set(statuses)].join(', ')})`);
    else soft.push(`"${family}" is declared but not loaded yet; nothing on this screen uses it, so preload it to avoid a font swap later`);
  }
  if (problems.length) return [verdict('fonts', problems, '')];
  return [verdict('fonts', soft, `${FONTS.join(' and ')} are loaded`, 'warn')];
}

// ---- route and scene ------------------------------------------------------------------------

function checkRoute(facts, ctx) {
  const s = facts.state;
  const out = [];
  const problems = [];
  if (s.route === null) problems.push('no element has data-route');
  else if (s.route !== s.hashRoute) problems.push(`data-route is "${s.route}" but the URL is at "${s.hashRoute}" (${s.hash || 'no hash'})`);
  if (facts.routeRoots > 1) problems.push(`${facts.routeRoots} elements have data-route, expected one`);
  out.push(verdict('route', problems, `data-route "${s.route}" matches the URL`));

  if (ctx.kind === 'scene') {
    const want = sceneForRoute(s.hashRoute);
    const sceneProblems = [];
    const visible = s.scenes;
    if (want === null) sceneProblems.push(`the URL "${s.hashRoute}" is not a scene route`);
    else if (!visible.length) sceneProblems.push(`no visible [data-scene] element, expected data-scene="${want}"`);
    else if (visible.length > 1) sceneProblems.push(`${visible.length} scenes are visible at once (${visible.join(', ')}), expected only "${want}"`);
    else if (visible[0] !== want) sceneProblems.push(`data-scene is "${visible[0]}" but the URL "${s.hashRoute}" shows "${want}"`);
    out.push(verdict('scene', sceneProblems, `data-scene "${want}" matches the URL`));

    const item = itemForRoute(s.hashRoute);
    if (item && s.dialog !== item) {
      out.push({ id: 'scene-dialog', status: 'fail', message: `the URL "${s.hashRoute}" names item "${item}" but ${s.dialog ? `dialog "${s.dialog}"` : 'no dialog'} is open` });
    } else if (!item && s.dialog) {
      out.push({ id: 'scene-dialog', status: 'fail', message: `dialog "${s.dialog}" is open but the URL "${s.hashRoute}" has no item` });
    }
  }
  if (ctx.kind === 'list') {
    out.push(
      facts.list && facts.list.visible
        ? { id: 'list-view', status: 'pass', message: '[data-view="list"] is showing' }
        : { id: 'list-view', status: 'fail', message: 'no visible [data-view="list"] element' },
    );
  }
  return out;
}

// ---- HUD and breadcrumb ---------------------------------------------------------------------

function checkHud(facts, scene) {
  const hud = facts.hud;
  const needed = scene === 'world' || ROOMS.includes(scene);
  const out = [];
  if (!hud || !hud.visible) {
    if (needed) out.push({ id: 'hud', status: 'fail', message: hud ? '[data-hud] is not visible' : 'no [data-hud] element' });
  } else {
    const { w: vw } = facts.viewport;
    const problems = [];
    const r = hud.rect;
    if (r.h < HUD_MIN - 0.5 || r.h > HUD_MAX + 0.5) problems.push(`the HUD is ${fmt(r.h)} px tall, expected ${HUD_MIN} to ${HUD_MAX}`);
    if (r.y > 0.5 || r.x > 0.5 || r.w < vw - 1) problems.push(`the HUD ${fmtRect(r)} is not a bar across the top of the ${vw} px viewport`);
    if (hud.scrollW > hud.clientW + 1) problems.push(`the HUD content is ${hud.scrollW - hud.clientW} px wider than the bar`);
    const links = hud.links.filter((l) => l.visible);
    for (const link of links) {
      if (link.rect.x < -0.5 || link.rect.x + link.rect.w > vw + 0.5) problems.push(`HUD link "${link.text}" is partly off screen`);
      else if (link.rect.y < r.y - 1 || link.rect.y + link.rect.h > r.y + r.h + 1) problems.push(`HUD link "${link.text}" does not fit inside the bar (wrapped to a second row?)`);
    }
    out.push(verdict('hud', problems, `HUD bar is ${fmt(r.h)} px tall with ${links.length} link(s)`));
  }

  if (needed) {
    const crumb = facts.breadcrumb;
    const problems = [];
    if (!crumb) problems.push('no [data-breadcrumb] element');
    else {
      if (crumb.tag !== 'NAV') problems.push(`[data-breadcrumb] is a <${crumb.tag.toLowerCase()}>, expected <nav>`);
      if (!crumb.inHud) problems.push('the breadcrumb is not inside the HUD bar');
      if (!crumb.visible) problems.push('the breadcrumb is not visible');
      const route = facts.state.hashRoute;
      const wanted = [];
      if (ROOMS.includes(scene)) wanted.push('#/world');
      if (itemForRoute(route)) wanted.push(`#/${scene}`);
      const hrefs = crumb.links.map((l) => l.href || '');
      for (const href of wanted) if (!hrefs.some((h) => h.endsWith(href))) problems.push(`the breadcrumb has no link to ${href} (it reads "${crumb.text}")`);
      if (hrefs.length > wanted.length) problems.push(`the breadcrumb has ${hrefs.length} links, expected ${wanted.length}: the last crumb is not a link`);
    }
    out.push(verdict('breadcrumb', problems, `breadcrumb reads "${crumb?.text ?? ''}"`));
  }
  return out;
}

// ---- hotspots -------------------------------------------------------------------------------

function axisMatches(actualStart, actualSize, wantStart, wantSize) {
  const tol = POS_TOLERANCE;
  if (Math.abs(actualStart - wantStart) <= tol && Math.abs(actualStart + actualSize - (wantStart + wantSize)) <= tol) return true;
  if (wantSize >= MIN_TARGET) return false;
  // Smaller than the minimum target: it may be padded evenly, up to 24 px.
  const grown = actualSize >= wantSize - tol && actualSize <= MIN_TARGET + tol;
  const centered = Math.abs(actualStart + actualSize / 2 - (wantStart + wantSize / 2)) <= tol;
  return grown && centered;
}

function checkHotspots(facts, ctx, scene) {
  const regions = ctx.regions[scene];
  if (!regions) return []; // the title scene has no regions file
  const out = [];
  const stage = facts.stage;
  const k = stage ? Number(stage.dataK) : NaN;
  const canPlace = !!stage && Number.isFinite(k) && k > 0;

  if (regions.problems.length) out.push(verdict('regions-file', regions.problems, ''));

  const dom = facts.hotspots.filter((h) => h.sceneVisible && (h.scene === scene || h.scene === null));
  const byId = new Map();
  for (const h of dom) byId.set(h.id, [...(byId.get(h.id) || []), h]);

  const present = [];
  const placed = [];
  const sized = [];
  const named = [];
  let checkedPlacement = 0;

  const basics = (h) => {
    const isButton = h.tag === 'BUTTON';
    const isLink = h.tag === 'A' && h.href !== null && h.href.trim() !== '';
    if (!isButton && !isLink) present.push(`"${h.id}" is a <${h.tag.toLowerCase()}>${h.tag === 'A' ? ' without an href' : ''}, expected a real <button> or <a href>`);
    if (!h.visible) present.push(`"${h.id}" is in the page but not visible`);
    if (!h.name) named.push(`"${h.id}" has no accessible name`);
    if (h.visible && (h.rect.w < MIN_TARGET - 0.05 || h.rect.h < MIN_TARGET - 0.05)) {
      sized.push(`"${h.id}" is ${fmt(h.rect.w)}x${fmt(h.rect.h)} CSS px, smaller than ${MIN_TARGET}x${MIN_TARGET}`);
    }
  };

  for (const want of regions.hotspots) {
    const found = byId.get(want.id) || [];
    if (!found.length) {
      present.push(`"${want.id}" has no [data-hotspot] element`);
      continue;
    }
    if (found.length > 1) present.push(`"${want.id}" appears ${found.length} times`);
    const h = found.find((x) => x.visible) || found[0];
    basics(h);
    if (!h.visible || !want.box || !canPlace) continue;
    checkedPlacement++;
    const [bx, by, bw, bh] = want.box;
    const target = { x: stage.rect.x + bx * k, y: stage.rect.y + by * k, w: bw * k, h: bh * k };
    const okX = axisMatches(h.rect.x, h.rect.w, target.x, target.w);
    const okY = axisMatches(h.rect.y, h.rect.h, target.y, target.h);
    if (!okX || !okY) {
      const small = target.w < MIN_TARGET || target.h < MIN_TARGET ? ` (it may be padded evenly up to ${MIN_TARGET} px)` : '';
      placed.push(`"${want.id}" is at ${fmtRect(h.rect)} but box [${want.box.join(', ')}] x k=${fmt(k)} + stage offset is ${fmtRect(target)}${small}`);
    }
  }

  const wanted = new Set(regions.hotspots.map((h) => h.id));
  const extra = dom.filter((h) => !wanted.has(h.id));
  for (const h of extra) basics(h);

  const count = regions.hotspots.length;
  if (regions.usable) out.push(verdict('hotspots-present', present, `all ${count} hotspots from ${regions.file} are in the page as buttons or links`));
  else if (present.length) out.push(verdict('hotspots-present', present, ''));
  if (regions.usable) {
    if (!canPlace && count) out.push({ id: 'hotspots-placed', status: 'fail', message: 'hotspot placement cannot be checked without a stage that reports data-k' });
    else if (ctx.dialogOpen) {
      /* the camera has eased toward the open item, so boxes no longer map 1:1; placement is checked on the room stop */
    } else out.push(verdict('hotspots-placed', placed, `${checkedPlacement} hotspot(s) sit on their region boxes within ${POS_TOLERANCE} px`));
  }
  if (dom.length) {
    out.push(verdict('hotspots-size', sized, `every hotspot is at least ${MIN_TARGET}x${MIN_TARGET} CSS px`));
    out.push(verdict('hotspots-named', named, 'every hotspot has an accessible name'));
  }
  if (regions.usable && extra.length) {
    out.push({ id: 'hotspots-extra', status: 'warn', message: `hotspot(s) not in ${regions.file}, so their placement is unchecked: ${extra.map((h) => h.id).join(', ')}` });
  }
  return out;
}

// ---- labels ---------------------------------------------------------------------------------

function checkLabels(facts, ctx, scene) {
  const stage = facts.stage;
  if (!stage) return [];
  const labels = facts.labels.filter((l) => l.visible && l.sceneVisible && (l.scene === scene || l.scene === null));
  const out = [];

  const outside = labels.filter((l) => !inside(l.rect, stage.rect)).map((l) => `label "${l.text}" (for ${l.for}) at ${fmtRect(l.rect)} leaves the stage ${fmtRect(stage.rect)}`);
  const clashes = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const o = overlap(labels[i].rect, labels[j].rect);
      if (o.w > 0.5 && o.h > 0.5) clashes.push(`labels "${labels[i].text}" (${labels[i].for}) and "${labels[j].text}" (${labels[j].for}) overlap by ${fmt(o.w)}x${fmt(o.h)} px`);
    }
  }

  // Behind an open dialog the camera has zoomed. Labels may still show there, laid out for the
  // zoomed camera (and then they may run past the stage with the art), but never stretched with it:
  // a label scaled by the camera is pixel type at a size that is not crisp.
  if (ctx.dialogOpen) {
    const stretched = labels.filter((l) => Math.abs((l.stretch ?? 1) - 1) > 0.002).map((l) => `label "${l.text}" (for ${l.for}) is drawn at ${fmt(l.stretch)}x its own size behind the dialog: it was scaled with the camera`);
    out.push(verdict('labels-zoomed', stretched, labels.length ? `${labels.length} label(s) behind the dialog are drawn at their own size` : 'no labels show behind the dialog'));
    if (labels.length) out.push(verdict('labels-overlap', clashes, 'no labels overlap'));
    return out;
  }

  if (labels.length) {
    out.push(verdict('labels-inside', outside, `${labels.length} visible label(s) are inside the stage`));
    out.push(verdict('labels-overlap', clashes, 'no labels overlap'));
  }

  // Which labels must be showing: every hotspot except Skills shelf items (those show on hover and focus).
  const regions = ctx.regions[scene];
  if (regions && regions.usable) {
    const missing = [];
    for (const want of regions.hotspots) {
      if (want.kind === 'item') continue;
      const label = labels.find((l) => l.for === want.id);
      if (!label) missing.push(`"${want.id}" has no visible label ([data-label-for="${want.id}"])`);
      else if (!label.text) missing.push(`the label for "${want.id}" is empty`);
      else if (want.id === 'door' && !/^exit$/i.test(label.text)) missing.push(`the doorway label reads "${label.text}", expected EXIT`);
    }
    out.push(verdict('labels-present', missing, `every location or object has its label showing`));
  }
  return out;
}

// ---- dialog ---------------------------------------------------------------------------------

function checkDialog(facts) {
  const d = facts.dialog;
  if (!d) return [];
  const out = [];
  const { w: vw, h: vh } = facts.viewport;

  const fit = [...d.clipped, ...d.spills];
  if (!inside(d.rect, { x: 0, y: 0, w: vw, h: vh })) fit.push(`the dialog box ${fmtRect(d.rect)} does not fit inside the ${vw}x${vh} viewport`);
  if (d.scrollsSideways) fit.push('the dialog scrolls sideways');
  if (d.textLength === 0) fit.push('the dialog has no text');
  out.push(verdict('dialog-not-clipped', fit, `dialog "${d.id}" shows all of its content${d.scrolls ? ' (it scrolls inside itself)' : ''}`));

  const soft = [];
  if (facts.stage && !inside(d.rect, facts.stage.rect, 1)) soft.push(`the dialog box ${fmtRect(d.rect)} extends past the stage ${fmtRect(facts.stage.rect)}`);
  if (!d.inStage) soft.push('the dialog is not rendered inside the stage');
  if (!d.backButton) soft.push('no BACK button found in the dialog');
  if (soft.length) out.push(verdict('dialog-layout', soft, '', 'warn'));

  // Long text may scroll inside the box, but through a window worth reading in.
  if (d.scrolls && d.visibleLines !== null) {
    const room = d.visibleLines >= DIALOG_MIN_LINES - 0.05;
    out.push({
      id: 'dialog-room',
      status: room ? 'pass' : 'fail',
      message: room
        ? `the dialog's scrolling text shows ${fmt(d.visibleLines)} lines at a time`
        : `the dialog's scrolling text shows only ${fmt(d.visibleLines)} lines at a time, fewer than ${DIALOG_MIN_LINES}: too small a window to read through`,
    });
  }

  const a11y = [];
  if (d.role !== 'dialog') a11y.push(`role is ${JSON.stringify(d.role)}, expected "dialog"`);
  if (d.ariaModal !== 'true') a11y.push(`aria-modal is ${JSON.stringify(d.ariaModal)}, expected "true"`);
  if (!d.labelText) a11y.push(d.labelledBy ? `aria-labelledby="${d.labelledBy}" points at nothing with text` : 'the dialog is not labelled by its title (no aria-labelledby)');
  out.push(verdict('dialog-a11y', a11y, `role="dialog", aria-modal="true", labelled "${clip(d.labelText, 60)}"`));
  return out;
}

// ---- NES palette ----------------------------------------------------------------------------

function checkPalette(facts) {
  const p = facts.palette;
  if (!p || !p.roots || !PALETTE) return [];
  // Colors the page declares for label chips on plates (--color-plate-*): the art is not held to
  // the NES palette, and a chip that lies on a painted plate has to match it.
  const plates = new Set((p.plates ?? []).filter((plate) => plate.rgba[3] >= 1).map((plate) => hex(plate.rgba.slice(0, 3))));
  const misses = [];
  for (const c of p.colors) {
    const rgb = c.rgba.slice(0, 3);
    const code = hex(rgb);
    if (c.rgba[3] < 1) misses.push({ ...c, why: `${c.root} ${c.prop} ${c.raw} is see-through, so it blends into colors outside the palette (on ${c.sample})` });
    else if (c.root === 'label' && plates.has(code)) continue; // a chip on a plate painted in the art takes the plate's color
    else if (!PALETTE.has(code)) {
      const near = nearestIndex ? `nearest ${hex(NES_PALETTE[nearestIndex(rgb[0], rgb[1], rgb[2])])}; ` : '';
      const also = c.root === 'label' && plates.size ? ` or one of the page's plate colors (${[...plates].join(', ')})` : '';
      misses.push({ ...c, why: `${c.root} ${c.prop} ${code} is not in the NES palette${also} (${near}${c.count} use(s), e.g. ${c.sample})` });
    }
  }
  misses.sort((a, b) => b.count - a.count);
  const problems = [...misses.map((m) => m.why), ...p.gradients.map((g) => `gradient background on ${g}`)];
  return [verdict('palette', problems, `${p.colors.length} UI color(s) in the HUD, dialog, labels and list are all in the NES palette${plates.size ? ' (labels also use the plate colors of the art)' : ''}`, 'warn')];
}

// ---- rotate screen --------------------------------------------------------------------------

function checkGate(facts, ctx) {
  const showing = !!facts.gate && facts.gate.visible;
  if (ctx.kind === 'gate') {
    const problems = [];
    if (!showing) problems.push(facts.gate ? '[data-rotate-gate] is in the page but not visible' : 'no [data-rotate-gate] element');
    else {
      const { w: vw, h: vh } = facts.viewport;
      const r = facts.gate.rect;
      if (r.x > 1 || r.y > 1 || r.w < vw - 2 || r.h < vh - 2) problems.push(`the rotate screen ${fmtRect(r)} does not cover the ${vw}x${vh} viewport`);
      if (!facts.gate.onTop) problems.push('something else is drawn on top of the rotate screen');
    }
    return [verdict('rotate-gate', problems, 'the rotate screen covers the viewport')];
  }
  if (showing) {
    const v = facts.viewport;
    return [{ id: 'rotate-gate', status: 'fail', message: `the rotate screen is showing at ${v.w}x${v.h} on "${facts.state.hashRoute}", where it should not be` }];
  }
  return [];
}

// ---- entry ----------------------------------------------------------------------------------

/**
 * ctx: { kind: 'scene' | 'list' | 'gate', profile, regions, art, expect, skip: Set, resized, pointing }
 * `pointing` is true when the stop was taken with the mouse (or focus) left on something on purpose.
 */
export function runGenericChecks(facts, ctx) {
  const out = [];
  const route = facts.state.hashRoute;
  const scene = ctx.expect?.scene ?? sceneForRoute(route);
  const dialogOpen = !!facts.dialog;
  const inner = { ...ctx, dialogOpen };

  out.push(...checkScroll(facts, ctx));
  out.push(...checkFonts(facts));
  out.push(...checkRoute(facts, ctx));
  out.push(...checkGate(facts, ctx));
  if (facts.cursorNone) out.push({ id: 'cursor', status: 'fail', message: 'the page sets cursor: none; the system cursor must stay visible' });

  if (ctx.kind === 'scene') {
    out.push(...checkScale(facts));
    out.push(...checkBackground(facts, inner, scene));
    out.push(...checkArt(facts, inner, scene));
    out.push(...checkGround(facts, inner, scene));
    out.push(...checkHud(facts, scene));
    if (scene) {
      out.push(...checkHotspots(facts, inner, scene));
      out.push(...checkLabels(facts, inner, scene));
      out.push(...checkCharacter(facts, inner, scene));
    }
    out.push(...checkDialog(facts));
  }
  out.push(...checkPalette(facts));
  return out.filter((check) => !ctx.skip?.has(check.id));
}
