#!/usr/bin/env node
// Tools for measuring and checking click boxes in art/approved/<scene>.regions.json.
// All coordinates are scene pixels of the 320x180 art: boxes are [x, y, w, h].
//
//   node art/scripts/regions.mjs grid <scene> [--crop x,y,w,h] [--scale N]
//       zoomed view with a ruler and grid lines, for reading coordinates off the art
//   node art/scripts/regions.mjs overlay <scene> [--crop x,y,w,h] [--scale N]
//       draws every box from the regions file on the art and prints a numbered legend
//   node art/scripts/regions.mjs components <scene> --color F8D878[,HEX...] [--min 6] [--crop x,y,w,h]
//       exact boxes of connected areas of the given flat color(s), e.g. blank label plates
//   node art/scripts/regions.mjs bbox <scene> --crop x,y,w,h (--bg HEX[,HEX...] | --only HEX[,HEX...])
//       tight box around the pixels in the crop that are not background (or are one of --only)
//   node art/scripts/regions.mjs colors <scene> [--crop x,y,w,h]
//       color histogram of the crop
//
// Images are written to art/raw/_measure/<scene>/ (git-ignored) unless --out is given.
import { Jimp, ResizeStrategy } from 'jimp';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    crop: { type: 'string' },
    scale: { type: 'string' },
    out: { type: 'string' },
    color: { type: 'string' },
    bg: { type: 'string' },
    only: { type: 'string' },
    min: { type: 'string', default: '6' },
    source: { type: 'string', default: 'png' }, // or "cutout.png" for the transparent version
  },
});
const [command, scene] = positionals;
if (!command || !scene) {
  console.error('usage: regions.mjs <grid|overlay|components|bbox|colors> <scene> [options]  (see file header)');
  process.exit(1);
}

const art = await Jimp.read(`art/approved/${scene}.${values.source}`);
const W = art.bitmap.width;
const H = art.bitmap.height;
const crop = values.crop ? values.crop.split(',').map(Number) : [0, 0, W, H];
const [cx, cy, cw, ch] = crop;
const outDir = path.join('art', 'raw', '_measure', scene);
const hexOf = (x, y) => {
  const i = (y * W + x) * 4;
  const d = art.bitmap.data;
  if (d[i + 3] === 0) return 'transparent';
  return ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).padStart(6, '0').toUpperCase();
};
const hexList = (s) => new Set(s.split(',').map((h) => h.trim().replace('#', '').toUpperCase()));

// 3x5 digit font for ruler numbers and legend indexes.
const DIGITS = {
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '###', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '..#', '..#'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'],
};
function drawNumber(img, n, x, y, color, px = 2) {
  let cursor = x;
  for (const ch of String(n)) {
    DIGITS[ch].forEach((row, dy) => [...row].forEach((c, dx) => {
      if (c !== '#') return;
      for (let a = 0; a < px; a++) for (let b = 0; b < px; b++) put(img, cursor + dx * px + a, y + dy * px + b, color);
    }));
    cursor += 4 * px;
  }
  return cursor - x;
}
function put(img, x, y, color) {
  if (x < 0 || y < 0 || x >= img.bitmap.width || y >= img.bitmap.height) return;
  img.setPixelColor(color, x, y);
}
function fillRect(img, x, y, w, h, color) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(img, i, j, color);
}

/** The cropped art, enlarged with no smoothing, inside a margin that holds a ruler. */
function zoomed(scale) {
  const M = { left: 30, top: 16 };
  const view = art.clone().crop({ x: cx, y: cy, w: cw, h: ch });
  view.resize({ w: cw * scale, h: ch * scale, mode: ResizeStrategy.NEAREST_NEIGHBOR });
  const canvas = new Jimp({ width: cw * scale + M.left, height: ch * scale + M.top, color: 0x202020ff });
  canvas.composite(view, M.left, M.top);
  const step = scale * 10 >= 30 ? 10 : scale * 20 >= 30 ? 20 : 50;
  for (let sx = Math.ceil(cx / step) * step; sx < cx + cw; sx += step) {
    drawNumber(canvas, sx, M.left + (sx - cx) * scale + 1, 3, 0xffffffff);
    fillRect(canvas, M.left + (sx - cx) * scale, M.top - 3, 1, 3, 0xffffffff);
  }
  for (let sy = Math.ceil(cy / step) * step; sy < cy + ch; sy += step) {
    drawNumber(canvas, sy, 2, M.top + (sy - cy) * scale + 1, 0xffffffff);
    fillRect(canvas, M.left - 3, M.top + (sy - cy) * scale, 3, 1, 0xffffffff);
  }
  // scene (x, y) -> canvas pixel of that scene pixel's top-left corner
  const at = (x, y) => [M.left + (x - cx) * scale, M.top + (y - cy) * scale];
  return { canvas, at };
}
const defaultScale = () => Number(values.scale ?? Math.max(2, Math.min(16, Math.floor(1280 / cw))));
async function save(img, name) {
  const file = values.out ?? path.join(outDir, name);
  await mkdir(path.dirname(file), { recursive: true });
  await img.write(file);
  console.log(`wrote ${file} (${img.bitmap.width}x${img.bitmap.height})`);
}
const suffix = values.crop ? `-${crop.join('-')}` : '';

if (command === 'grid') {
  const scale = defaultScale();
  const { canvas, at } = zoomed(scale);
  const line = (x, y, w, h, alpha) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i < 0 || j < 0 || i >= canvas.bitmap.width || j >= canvas.bitmap.height) continue;
      const o = (j * canvas.bitmap.width + i) * 4;
      for (let k = 0; k < 3; k++) canvas.bitmap.data[o + k] = Math.round(canvas.bitmap.data[o + k] * (1 - alpha) + 255 * alpha * (k === 0 ? 1 : 0.2));
    }
  };
  for (let sx = Math.ceil(cx / 5) * 5; sx <= cx + cw; sx += 5) {
    const [px, py] = at(sx, cy);
    line(px, py, 1, ch * scale, sx % 10 === 0 ? 0.75 : 0.3);
  }
  for (let sy = Math.ceil(cy / 5) * 5; sy <= cy + ch; sy += 5) {
    const [px, py] = at(cx, sy);
    line(px, py, cw * scale, 1, sy % 10 === 0 ? 0.75 : 0.3);
  }
  console.log(`scale ${scale}: red lines every 5 scene px (strong every 10); ruler numbers are scene coordinates of the line to their left/top`);
  await save(canvas, `grid${suffix}.png`);
} else if (command === 'overlay') {
  const scale = defaultScale();
  const { canvas, at } = zoomed(scale);
  const file = JSON.parse(await readFile(`art/approved/${scene}.regions.json`, 'utf8'));
  const COLORS = [0xff00ffff, 0x00ffffff, 0xffff00ff, 0xff3030ff, 0xffffffff, 0xff9000ff, 0x40ff40ff];
  const rect = ([x, y, w, h], color, { dotted = false, thick = 2 } = {}) => {
    const [x0, y0] = at(x, y);
    const [x1, y1] = at(x + w, y + h);
    for (let t = 0; t < thick; t++) {
      for (let i = x0; i < x1; i++) if (!dotted || Math.floor(i / 4) % 2 === 0) { put(canvas, i, y0 + t, color); put(canvas, i, y1 - 1 - t, color); }
      for (let j = y0; j < y1; j++) if (!dotted || Math.floor(j / 4) % 2 === 0) { put(canvas, x0 + t, j, color); put(canvas, x1 - 1 - t, j, color); }
    }
  };
  let n = 0;
  for (const [id, region] of Object.entries(file.regions)) {
    n++;
    const color = COLORS[(n - 1) % COLORS.length];
    rect(region.box, color);
    if (region.plate) rect(region.plate, color, { dotted: true });
    if (region.inner) rect(region.inner, color, { dotted: true });
    for (const item of region.items ?? []) rect(item, color, { thick: 1 });
    for (const sub of Object.values(region.buildings ?? {})) rect(sub, color, { thick: 1 });
    const [lx, ly] = at(region.box[0], region.box[1]);
    const width = String(n).length * 8 + 3;
    fillRect(canvas, lx, ly, width, 14, 0x000000ff);
    drawNumber(canvas, n, lx + 2, ly + 2, color);
    const extra = ['plate', 'inner'].filter((k) => region[k]).map((k) => `${k}=[${region[k]}]`).join(' ');
    console.log(`${String(n).padStart(2)} ${id.padEnd(14)} box=[${region.box}] ${extra}${region.items ? ` items=${region.items.length}` : ''}`);
  }
  console.log(`scale ${scale}: solid = box, dotted = plate/inner, thin = items. A box [x,y,w,h] covers scene pixels x..x+w-1, y..y+h-1.`);
  await save(canvas, `overlay${suffix}.png`);
} else if (command === 'components') {
  if (!values.color) throw new Error('--color HEX[,HEX...] is required');
  const wanted = hexList(values.color);
  const seen = new Uint8Array(W * H);
  const found = [];
  for (let y = cy; y < cy + ch; y++) for (let x = cx; x < cx + cw; x++) {
    if (seen[y * W + x] || !wanted.has(hexOf(x, y))) continue;
    let [x0, y0, x1, y1, count] = [x, y, x, y, 0];
    const stack = [[x, y]];
    seen[y * W + x] = 1;
    while (stack.length) {
      const [px, py] = stack.pop();
      count++;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
        if (nx < cx || ny < cy || nx >= cx + cw || ny >= cy + ch || seen[ny * W + nx] || !wanted.has(hexOf(nx, ny))) continue;
        seen[ny * W + nx] = 1;
        stack.push([nx, ny]);
      }
    }
    if (count >= Number(values.min)) found.push({ box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], count });
  }
  found.sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
  for (const f of found) console.log(`box=[${f.box}] pixels=${f.count} fill=${Math.round((100 * f.count) / (f.box[2] * f.box[3]))}%`);
  console.log(`${found.length} component(s) of ${[...wanted].join(',')} with at least ${values.min} pixels`);
} else if (command === 'bbox') {
  const bg = values.bg ? hexList(values.bg) : null;
  const only = values.only ? hexList(values.only) : null;
  if (!bg && !only) throw new Error('give --bg HEX[,HEX...] or --only HEX[,HEX...]');
  let [x0, y0, x1, y1, count] = [Infinity, Infinity, -1, -1, 0];
  for (let y = cy; y < cy + ch; y++) for (let x = cx; x < cx + cw; x++) {
    const h = hexOf(x, y);
    if (only ? !only.has(h) : bg.has(h)) continue;
    count++;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  console.log(count ? `box=[${x0},${y0},${x1 - x0 + 1},${y1 - y0 + 1}] pixels=${count}` : 'no matching pixels in the crop');
} else if (command === 'colors') {
  const hist = new Map();
  for (let y = cy; y < cy + ch; y++) for (let x = cx; x < cx + cw; x++) hist.set(hexOf(x, y), (hist.get(hexOf(x, y)) ?? 0) + 1);
  for (const [hex, n] of [...hist].sort((a, b) => b[1] - a[1]).slice(0, 16)) console.log(`${hex} ${n}`);
} else {
  throw new Error(`unknown command "${command}"`);
}
