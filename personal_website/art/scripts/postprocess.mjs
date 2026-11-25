// Turns a model's "pixel-art-style" image into real pixel art:
//   1. downsample to the exact target grid (e.g. 320x180)
//   2. snap every pixel to the NES palette
//   3. optionally chroma-key #FF00FF to transparency (sprites)
// The model's fake pixel grid rarely lines up with ours, so plain nearest-neighbor
// sampling picks up edge noise. Instead each target pixel takes the most common
// palette color in the central part of its source block.
import { Jimp, ResizeStrategy } from 'jimp';
import { NES_PALETTE, nearestIndex } from './nes-palette.mjs';

// Hue-based magenta test, carried over from Perch: JPEG darkens the key color at
// edges without shifting its hue, so check hue instead of distance to #FF00FF.
function looksMagenta(r, g, b) {
  return r - g > 40 && b - g > 40 && Math.abs(r - b) < 40;
}

const TRANSPARENT = -1;

// Background = magenta pixels connected to the image border. A purple object
// inside the scene (e.g. a cloth) is enclosed by the scene, so it survives.
function backgroundMask(data, sw, sh) {
  const mask = new Uint8Array(sw * sh);
  const stack = [];
  const isKey = (p) => looksMagenta(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
  // JPEG fringe right at the background's edge is darker/muddier magenta; accept it
  // only when it touches background already found.
  const isFringe = (p) => {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    return r - g > 20 && b - g > 20 && Math.abs(r - b) < 60;
  };
  const seed = (x, y, fromBg = false) => {
    const p = y * sw + x;
    if (!mask[p] && (isKey(p) || (fromBg && isFringe(p)))) { mask[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < sw; x++) { seed(x, 0); seed(x, sh - 1); }
  for (let y = 0; y < sh; y++) { seed(0, y); seed(sw - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % sw;
    const y = (p - x) / sw;
    if (x > 0) seed(x - 1, y, true);
    if (x < sw - 1) seed(x + 1, y, true);
    if (y > 0) seed(x, y - 1, true);
    if (y < sh - 1) seed(x, y + 1, true);
  }
  return mask;
}

/**
 * @param {Buffer} input raw model output
 * @param {{ width: number, height: number, chromaKey?: boolean, coreFraction?: number }} opts
 * @returns {Promise<Jimp>} a width x height image using only NES colors
 */
export async function toPixelArt(input, { width, height, chromaKey = false, coreFraction = 0.5 }) {
  const src = await Jimp.read(input);
  const { width: sw, height: sh, data } = src.bitmap;
  const out = new Jimp({ width, height, color: 0x00000000 });
  const bx = sw / width;
  const by = sh / height;
  const margin = (1 - coreFraction) / 2;
  const bg = chromaKey ? backgroundMask(data, sw, sh) : null;

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const x0 = Math.floor((tx + margin) * bx);
      const x1 = Math.max(x0 + 1, Math.floor((tx + 1 - margin) * bx));
      const y0 = Math.floor((ty + margin) * by);
      const y1 = Math.max(y0 + 1, Math.floor((ty + 1 - margin) * by));

      const votes = new Map();
      for (let y = y0; y < y1 && y < sh; y++) {
        for (let x = x0; x < x1 && x < sw; x++) {
          const i = (y * sw + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const key = bg && bg[y * sw + x] ? TRANSPARENT : nearestIndex(r, g, b);
          votes.set(key, (votes.get(key) ?? 0) + 1);
        }
      }
      let winner = TRANSPARENT;
      let most = -1;
      for (const [k, n] of votes) {
        if (n > most) {
          most = n;
          winner = k;
        }
      }

      const o = (ty * width + tx) * 4;
      if (winner === TRANSPARENT) {
        out.bitmap.data[o + 3] = 0;
      } else {
        const [r, g, b] = NES_PALETTE[winner];
        out.bitmap.data[o] = r;
        out.bitmap.data[o + 1] = g;
        out.bitmap.data[o + 2] = b;
        out.bitmap.data[o + 3] = 255;
      }
    }
  }
  if (chromaKey) trimFringe(out);
  return out;
}

// After snapping, leftover edge fringe shows up as NES pink/purple pixels touching
// the transparent area. Peel those off (a few passes); enclosed purples are untouched.
function trimFringe(image, passes = 3) {
  const { data: d, width: w, height: h } = image.bitmap;
  const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= h || d[(y * w + x) * 4 + 3] === 0;
  for (let pass = 0; pass < passes; pass++) {
    const peel = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const pinkish = r - g > 40 && b - g > 40 && Math.abs(r - b) < 60;
        const clearSides = [clear(x - 1, y), clear(x + 1, y), clear(x, y - 1), clear(x, y + 1)].filter(Boolean).length;
        // pink fringe on the edge, or a stray speck mostly surrounded by background
        if ((pinkish && clearSides > 0) || clearSides >= 3) peel.push(i);
      }
    }
    if (!peel.length) break;
    for (const i of peel) d[i + 3] = 0;
  }
}

// The site's page background (DESIGN.md §5). Previews show transparent areas in this
// color so they look the way the site will, instead of a viewer's white/checkerboard.
export const PAGE_BACKGROUND = 0x0078f8ff;

/** Nearest-neighbor enlargement for viewing (pixel art must never be smoothed), on the page background. */
export function enlarge(image, scale, background = PAGE_BACKGROUND) {
  const big = image.clone();
  big.resize({ w: image.bitmap.width * scale, h: image.bitmap.height * scale, mode: ResizeStrategy.NEAREST_NEIGHBOR });
  const canvas = new Jimp({ width: big.bitmap.width, height: big.bitmap.height, color: background });
  return canvas.composite(big, 0, 0);
}

/** Count distinct colors actually used (handy for checking palette discipline). */
export function colorCount(image) {
  const seen = new Set();
  const d = image.bitmap.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  return seen.size;
}
