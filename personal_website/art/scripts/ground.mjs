// Puts a cut-out interior onto the ground its building stands on in the overworld:
// grass with the overworld's dark tufts, plus a dirt path leading out of the doorway.
// Colors are sampled from art/approved/overworld.png.
import { Jimp } from 'jimp';

const GRASS = [0x00, 0xa8, 0x00];
const TUFT = [0x00, 0x78, 0x00];
const PATH = [0xf8, 0xd8, 0x78];
const TUFT_GLYPH = ['#..#', '.##.'];

// Small deterministic RNG so the same scene always gets the same tufts.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Close 1-2px background gaps inside the scene's edge (ragged border rows). */
function fillPinholes(image) {
  const { data: d, width: w, height: h } = image.bitmap;
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const copy = (from, to) => { for (let k = 0; k < 4; k++) d[to + k] = d[from + k]; };
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (op(x, y)) continue;
      const i = (y * w + x) * 4;
      // horizontal gap of 1 or 2 with scene on both sides
      if (op(x - 1, y) && (op(x + 1, y) || (op(x + 2, y) && !op(x + 1, y)))) {
        copy(i - 4, i);
        continue;
      }
      // vertical gap of 1 with scene above and below
      if (op(x, y - 1) && op(x, y + 1)) copy(i - w * 4, i);
    }
  }
}

/**
 * @param {Jimp} cutout scene with transparent background (from toPixelArt with chromaKey)
 * @param {number} seed for tuft placement
 * @returns {Jimp} opaque scene on grass
 */
export function placeOnGround(cutout, seed = 1) {
  const scene = cutout.clone();
  fillPinholes(scene);
  const { width: w, height: h, data: d } = scene.bitmap;
  const ground = new Jimp({ width: w, height: h, color: 0x000000ff });
  const g = ground.bitmap.data;
  const set = (x, y, [r, gg, b]) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    g[i] = r; g[i + 1] = gg; g[i + 2] = b; g[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, GRASS);

  // Sparse tufts, about as dense as the overworld's grass.
  const rand = rng(seed);
  for (let n = 0; n < Math.round((w * h) / 900); n++) {
    const tx = Math.floor(rand() * w);
    const ty = Math.floor(rand() * h);
    TUFT_GLYPH.forEach((row, dy) => [...row].forEach((c, dx) => c === '#' && set(tx + dx, ty + dy, TUFT)));
  }

  // Path: under the doorway, i.e. the center columns where the scene reaches lowest.
  const lowest = (x) => { for (let y = h - 1; y >= 0; y--) if (d[(y * w + x) * 4 + 3]) return y; return -1; };
  const center = [Math.floor(w * 0.3), Math.ceil(w * 0.7)];
  let maxLow = -1;
  for (let x = center[0]; x < center[1]; x++) maxLow = Math.max(maxLow, lowest(x));
  if (maxLow >= 0 && maxLow < h - 1) {
    const cols = [];
    for (let x = center[0]; x < center[1]; x++) if (lowest(x) >= maxLow - 1) cols.push(x);
    const [x0, x1] = [Math.min(...cols), Math.max(...cols)];
    for (let y = maxLow - 1; y < h; y++) for (let x = x0; x <= x1; x++) set(x, y, PATH);
  }

  return ground.composite(scene, 0, 0);
}
