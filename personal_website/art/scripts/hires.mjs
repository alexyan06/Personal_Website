#!/usr/bin/env node
// Builds the high-definition art the site uses from the model's raw output (art/approved/*.raw.jpg):
//   - each room cut out of its magenta background, with a soft edge
//   - the overworld's island cut out of its sea, its chimney smoke painted out, and that smoke as a
//     sprite sheet for the site to animate (smoke.webp and smoke.json, see smoke.mjs)
//   - a sea tile (two frames, for the wave animation) and a grass tile, drawn from the overworld's
//     own colors, wave shape and grass tufts, so the ground can cover the whole view behind a scene
// Output: art/approved/hd/*.webp and art/approved/hd/backdrops.json. Previews go to art/raw/_hd/.
//
//   node art/scripts/hires.mjs            # everything
//   node art/scripts/hires.mjs about      # one scene (tiles are rebuilt too)
//
// WebP is encoded by the headless Chromium that Playwright already installs (canvas.toDataURL).
import { Jimp } from 'jimp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cutSmoke, paintOutSmoke, smokePreview } from './smoke.mjs';
import { closeWebp, writeWebp } from './webp.mjs';

const ROOMS = ['about', 'experience', 'projects', 'skills', 'learning', 'misc'];
const OUT = 'art/approved/hd';
const PREVIEW = 'art/raw/_hd';
/** Scene units (the 320x180 grid that regions are measured in) across the picture. */
const UNITS_W = 320;

const only = process.argv.slice(2);
const wanted = (name) => only.length === 0 || only.includes(name);

// ---- pixels ------------------------------------------------------------------------------------

/** Pixels matching `isKey` that are connected to the image border; `isFringe` extends the area at its edge. */
function floodFromBorder(data, w, h, isKey, isFringe = () => false) {
  const mask = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y, fromBg) => {
    const p = y * w + x;
    if (mask[p]) return;
    const i = p * 4;
    if (isKey(data[i], data[i + 1], data[i + 2]) || (fromBg && isFringe(data[i], data[i + 1], data[i + 2]))) {
      mask[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) { seed(x, 0, false); seed(x, h - 1, false); }
  for (let y = 0; y < h; y++) { seed(0, y, false); seed(w - 1, y, false); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) seed(x - 1, y, true);
    if (x < w - 1) seed(x + 1, y, true);
    if (y > 0) seed(x, y - 1, true);
    if (y < h - 1) seed(x, y + 1, true);
  }
  return mask;
}

/** Grows the background by `passes` pixels wherever the scene's edge pixel matches `test` (leftover key color). */
function peel(data, mask, w, h, test, passes) {
  for (let pass = 0; pass < passes; pass++) {
    const hits = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (mask[p]) continue;
        const edge = (x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || (y > 0 && mask[p - w]) || (y < h - 1 && mask[p + w]);
        if (edge && test(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])) hits.push(p);
      }
    }
    if (!hits.length) break;
    for (const p of hits) mask[p] = 1;
  }
}

/**
 * Alpha for a cut-out: 0 on the background, rising to 255 about `radius` pixels inside the scene.
 * The feather only goes inward, so no background-colored pixel is ever shown. A scene that touches
 * the image border keeps a hard edge there (the border is not background).
 */
function alphaFromMask(mask, w, h, radius) {
  const src = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) src[p] = mask[p] ? 0 : 1;
  const blur = (input) => {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    const r = Math.ceil(radius);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += input[y * w + Math.min(w - 1, Math.max(0, x + k))];
        tmp[y * w + x] = sum / (2 * r + 1);
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
        out[y * w + x] = sum / (2 * r + 1);
      }
    }
    return out;
  };
  const soft = blur(src);
  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = mask[p] ? 0 : Math.round(255 * Math.min(1, Math.max(0, (soft[p] - 0.5) * 2)));
  return alpha;
}

function withAlpha(image, alpha) {
  const out = image.clone();
  const d = out.bitmap.data;
  for (let p = 0; p < alpha.length; p++) {
    d[p * 4 + 3] = alpha[p];
    // Fully clear pixels carry no color, so the encoder has nothing to bleed from.
    if (alpha[p] === 0) d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = 0;
  }
  return out;
}

/** The most common color among pixels that pass `test`, to the nearest 2 levels. */
function dominant(data, test) {
  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (!test(data[i], data[i + 1], data[i + 2])) continue;
    const key = ((data[i] >> 1) << 16) | ((data[i + 1] >> 1) << 8) | (data[i + 2] >> 1);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0;
  let most = -1;
  for (const [key, n] of counts) if (n > most) { most = n; best = key; }
  return [((best >> 16) & 127) << 1, ((best >> 8) & 127) << 1, (best & 127) << 1];
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const rgba = ([r, g, b], a = 255) => ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;

// ---- what counts as background -----------------------------------------------------------------

// Hue test from Perch: JPEG darkens the key color at edges without shifting its hue.
const isMagenta = (r, g, b) => r - g > 40 && b - g > 40 && Math.abs(r - b) < 40;
const isMagentaFringe = (r, g, b) => r - g > 20 && b - g > 20 && Math.abs(r - b) < 60;
// Darker purples left on the outline's outer edge.
const isPinkish = (r, g, b) => r - g > 24 && b - g > 24;

// Open sea and its wave marks. The pale shallows and the foam along the shore are not sea: they stay with the island.
const isSea = (r, g, b) => b > 200 && r < 116 && g < 224 && b - r > 110;

// ---- sprites cut from the overworld ---------------------------------------------------------------

/** A patch of the overworld as a sprite: each pixel's own color, with alpha from how far it is from `base`. */
function spriteFrom(world, [x, y, w, h], base, lo, hi) {
  const out = new Jimp({ width: w, height: h, color: 0x00000000 });
  const s = world.bitmap;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const i = ((y + yy) * s.width + x + xx) * 4;
      const r = s.data[i], g = s.data[i + 1], b = s.data[i + 2];
      const dist = Math.hypot(r - base[0], g - base[1], b - base[2]);
      const a = Math.min(1, Math.max(0, (dist - lo) / (hi - lo)));
      // Fade to nothing at the patch's edge so a stamp never shows a box.
      const edge = Math.min(1, Math.min(xx, yy, w - 1 - xx, h - 1 - yy) / 2);
      const o = (yy * w + xx) * 4;
      out.bitmap.data[o] = r; out.bitmap.data[o + 1] = g; out.bitmap.data[o + 2] = b;
      out.bitmap.data[o + 3] = Math.round(255 * a * edge);
    }
  }
  return out;
}

/** Stamps a sprite onto a tile, wrapping around the tile's edges so the tile repeats cleanly. */
function stampWrapped(tile, sprite, x, y) {
  const { width: w, height: h } = tile.bitmap;
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    const px = Math.round(x + dx), py = Math.round(y + dy);
    if (px + sprite.bitmap.width <= 0 || py + sprite.bitmap.height <= 0 || px >= w || py >= h) continue;
    tile.composite(sprite, px, py);
  }
}

// Small deterministic RNG so a rebuild gives the same tiles.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// ---- changes to a picture before it is cut out -------------------------------------------------------

/**
 * The cottage's back wall had a blank picture frame meant for a portrait. The character standing in
 * the room replaced it, so the frame is painted out with the plain wall next to it. The wall is the
 * same along its whole length (horizontal logs), so a strip of it, mirrored back and forth, fills
 * the gap without a seam.
 */
function paintOutFrame(raw) {
  const { data, width } = raw.bitmap;
  const [x0, x1, y0, y1] = [388, 696, 40, 246]; // the frame and its shadow
  const [s0, sw] = [699, 38]; // clean wall between the frame and the window (short of the window sill)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const t = (x - x0) % (2 * sw);
      const sx = s0 + (t < sw ? t : 2 * sw - 1 - t);
      const from = (y * width + sx) * 4;
      const to = (y * width + x) * 4;
      data[to] = data[from]; data[to + 1] = data[from + 1]; data[to + 2] = data[from + 2];
    }
  }
}

/** Per-room edits applied to the raw picture. (The overworld's edit, painting out its chimney smoke, is in smoke.mjs.) */
const EDITS = { about: paintOutFrame };

// ---- build -----------------------------------------------------------------------------------------

await mkdir(OUT, { recursive: true });
await mkdir(PREVIEW, { recursive: true });

const world = await Jimp.read('art/approved/overworld.raw.jpg');
const W = world.bitmap.width;
const H = world.bitmap.height;
const PX = W / UNITS_W; // raw pixels per scene unit

const seaColor = dominant(world.bitmap.data, isSea);
const grassColor = dominant(world.bitmap.data, (r, g, b) => g > 140 && r < 70 && b < 40);

// Sea tile: the overworld's own wave mark, in loose groups on staggered rows (its rhythm: marks 9
// units apart, rows 16 units apart). Frame B puts the groups in the gaps of frame A.
const waveMark = spriteFrom(world, [0, 42, 38, 22], seaColor, 18, 70);
function seaTile(frame) {
  // 192 x 128 units: 8 rows of up to 4 groups. Groups vary in length and sit a little off the grid,
  // and some are left out, so the repeat does not read as wallpaper.
  const tw = Math.round(192 * PX), th = Math.round(128 * PX);
  const tile = new Jimp({ width: tw, height: th, color: rgba(seaColor) });
  const rand = rng(7 + frame * 101);
  for (let row = 0; row < 8; row++) {
    for (let group = 0; group < 4; group++) {
      const count = 2 + Math.floor(rand() * 3); // 2 to 4 marks
      const jitter = rand() * 14 - 7;
      const skip = rand() < 0.2;
      if (skip) continue;
      const gx = (group * 48 + (row % 2) * 24 + frame * 24 + jitter) * PX;
      const gy = (row * 16 + frame * 8 + 3) * PX;
      for (let n = 0; n < count; n++) stampWrapped(tile, waveMark, gx + n * 9 * PX, gy);
    }
  }
  return tile;
}

// Grass tile: flat grass with a few of the overworld's own tufts.
const tufts = [[170, 326, 40, 34], [276, 504, 36, 32], [378, 546, 38, 32]].map((box) => spriteFrom(world, box, grassColor, 10, 40));
function grassTile() {
  // 192 x 192 units with a dozen tufts scattered by a fixed seed: about as sparse as the island's.
  const size = Math.round(192 * PX);
  const tile = new Jimp({ width: size, height: size, color: rgba(grassColor) });
  const rand = rng(31);
  const placed = [];
  while (placed.length < 11) {
    const spot = [rand() * 192, rand() * 192];
    const near = placed.some(([x, y]) => {
      const dx = Math.min(Math.abs(x - spot[0]), 192 - Math.abs(x - spot[0]));
      const dy = Math.min(Math.abs(y - spot[1]), 192 - Math.abs(y - spot[1]));
      return Math.hypot(dx, dy) < 38;
    });
    if (!near) placed.push(spot);
  }
  placed.forEach(([ux, uy], n) => stampWrapped(tile, tufts[n % tufts.length], ux * PX, uy * PX));
  return tile;
}

const tiles = { 'ocean-a': seaTile(0), 'ocean-b': seaTile(1), grass: grassTile() };
const sizes = {};
for (const [name, tile] of Object.entries(tiles)) sizes[name] = await writeWebp(tile, path.join(OUT, `${name}.webp`), 0.92);

/** A preview: the cut-out on its tiled ground, with a margin of ground around it like the site's view. */
async function preview(name, cutout, tile) {
  const margin = 120;
  const canvas = new Jimp({ width: W + margin * 2, height: H + margin * 2, color: 0x000000ff });
  for (let y = -((tile.bitmap.height - (margin % tile.bitmap.height)) % tile.bitmap.height); y < canvas.bitmap.height; y += tile.bitmap.height) {
    for (let x = -((tile.bitmap.width - (margin % tile.bitmap.width)) % tile.bitmap.width); x < canvas.bitmap.width; x += tile.bitmap.width) {
      canvas.composite(tile, x, y);
    }
  }
  canvas.composite(cutout, margin, margin);
  await canvas.write(path.join(PREVIEW, `${name}.preview.jpg`));
}

if (wanted('overworld')) {
  // The smoke drawn over the two chimneys is animated by the site: its puffs become a sprite
  // sheet, then it is painted out of the picture (smoke.mjs). The tiles above are already built.
  const smoke = cutSmoke(world, grassColor);
  sizes.smoke = await writeWebp(smoke.sheet, path.join(OUT, 'smoke.webp'), 1);
  await writeFile(path.join(OUT, 'smoke.json'), JSON.stringify(smoke.meta, null, 2) + '\n');
  await smokePreview(smoke.sheet, { grass: grassColor, sea: seaColor }).write(path.join(PREVIEW, 'smoke.preview.png'));
  paintOutSmoke(world, { grass: grassColor, sea: seaColor });

  const { data } = world.bitmap;
  const sea = floodFromBorder(data, W, H, isSea);
  const island = withAlpha(world, alphaFromMask(sea, W, H, 1.5));
  sizes.overworld = await writeWebp(island, path.join(OUT, 'overworld.webp'));
  await preview('overworld', island, tiles['ocean-a']);
  // The same island on a loud color, to check that no sea was left on it.
  const check = new Jimp({ width: W, height: H, color: 0xff2020ff });
  await check.composite(island, 0, 0).write(path.join(PREVIEW, 'overworld.check.jpg'));
}

for (const room of ROOMS) {
  if (!wanted(room)) continue;
  const raw = await Jimp.read(`art/approved/${room}.raw.jpg`);
  EDITS[room]?.(raw);
  const { data, width: w, height: h } = raw.bitmap;
  const bg = floodFromBorder(data, w, h, isMagenta, isMagentaFringe);
  peel(data, bg, w, h, isPinkish, 4);
  const cutout = withAlpha(raw, alphaFromMask(bg, w, h, 1));
  sizes[room] = await writeWebp(cutout, path.join(OUT, `${room}.webp`));
  await preview(room, cutout, tiles.grass);
}

await writeFile(path.join(OUT, 'backdrops.json'), JSON.stringify({
  note: 'Ground that covers the whole view behind a scene. Tile sizes are in scene units (the picture is 320x180 units). Built by art/scripts/hires.mjs.',
  picture: [W, H],
  ocean: { color: hex(seaColor), tile: [tiles['ocean-a'].bitmap.width / PX, tiles['ocean-a'].bitmap.height / PX], frames: ['ocean-a.webp', 'ocean-b.webp'] },
  grass: { color: hex(grassColor), tile: [tiles.grass.bitmap.width / PX, tiles.grass.bitmap.height / PX], frames: ['grass.webp'] },
}, null, 2) + '\n');

await closeWebp();
console.log(`sea ${hex(seaColor)}, grass ${hex(grassColor)}`);
for (const [name, bytes] of Object.entries(sizes)) console.log(`  ${name}.webp ${(bytes / 1024).toFixed(0)} kB`);
