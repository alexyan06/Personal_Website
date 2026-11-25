#!/usr/bin/env node
// Cuts a generated sheet of the character (poses side by side on magenta) into aligned frames:
// art/approved/mascot/idle-1.png, idle-2.png, wave-1.png, wave-2.png ...
// Every frame is the same size, with the feet on the same line and the legs on the same center,
// so the poses do not jump when they are played. idle-2 is idle-1 with the upper body 2 px lower
// (a breath), made here so it cannot drift from idle-1.
//
//   node art/scripts/mascot-cut.mjs art/raw/mascot/<run>/candidate-2.raw.jpg
//   node art/scripts/mascot.mjs        # then build the sheet the site uses
import { Jimp } from 'jimp';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const OUT = 'art/approved/mascot';
/** Frame size in picture pixels (the room art is 4.3 px per scene unit). */
const FRAME = [176, 224];
/** Height of the standing character, hair to soles, in picture pixels. */
const TALL = 200;
const FOOT_MARGIN = 4;

const source = process.argv[2];
if (!source) {
  console.error('usage: mascot-cut.mjs <sheet.raw.jpg>');
  process.exit(1);
}

const isMagenta = (r, g, b) => r - g > 40 && b - g > 40 && Math.abs(r - b) < 40;
const isFringe = (r, g, b) => r - g > 20 && b - g > 20 && Math.abs(r - b) < 60;
const isPinkish = (r, g, b) => r - g > 24 && b - g > 24;

const sheet = await Jimp.read(source);
const { data, width: W, height: H } = sheet.bitmap;

// Background: magenta connected to the border, then peel the darker pink left on the outlines.
const bg = new Uint8Array(W * H);
{
  const stack = [];
  const seed = (x, y, fromBg) => {
    const p = y * W + x;
    if (bg[p]) return;
    const i = p * 4;
    if (isMagenta(data[i], data[i + 1], data[i + 2]) || (fromBg && isFringe(data[i], data[i + 1], data[i + 2]))) { bg[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < W; x++) { seed(x, 0, false); seed(x, H - 1, false); }
  for (let y = 0; y < H; y++) { seed(0, y, false); seed(W - 1, y, false); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p - x) / W;
    if (x > 0) seed(x - 1, y, true);
    if (x < W - 1) seed(x + 1, y, true);
    if (y > 0) seed(x, y - 1, true);
    if (y < H - 1) seed(x, y + 1, true);
  }
  // Magenta closed in by the figure (between an arm and the body) is background too: he wears none.
  for (let p = 0; p < W * H; p++) if (!bg[p] && isMagenta(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])) bg[p] = 1;
  for (let pass = 0; pass < 4; pass++) {
    const hits = [];
    for (let p = 0; p < W * H; p++) {
      if (bg[p]) continue;
      const x = p % W;
      const edge = (x > 0 && bg[p - 1]) || (x < W - 1 && bg[p + 1]) || (p >= W && bg[p - W]) || (p < W * (H - 1) && bg[p + W]);
      if (edge && isPinkish(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])) hits.push(p);
    }
    if (!hits.length) break;
    for (const p of hits) bg[p] = 1;
  }
}

// Poses: the connected shapes that are left, biggest first, then left to right.
const label = new Int32Array(W * H);
const shapes = [];
for (let start = 0; start < W * H; start++) {
  if (bg[start] || label[start]) continue;
  const id = shapes.length + 1;
  const shape = { id, count: 0, x0: W, y0: H, x1: 0, y1: 0 };
  const stack = [start];
  label[start] = id;
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p - x) / W;
    shape.count++;
    shape.x0 = Math.min(shape.x0, x); shape.x1 = Math.max(shape.x1, x);
    shape.y0 = Math.min(shape.y0, y); shape.y1 = Math.max(shape.y1, y);
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
      if (q >= 0 && q < W * H && !bg[q] && !label[q]) { label[q] = id; stack.push(q); }
    }
  }
  shapes.push(shape);
}
const poses = shapes.filter((s) => s.count > 0.01 * W * H).sort((a, b) => a.x0 - b.x0);
if (poses.length < 2) throw new Error(`expected at least 2 poses on the sheet, found ${poses.length}`);

// Each pose's legs (the bottom fifth) give its center line; the body's height is measured in a
// band around that line, so a raised arm does not change the scale.
for (const pose of poses) {
  const legsTop = pose.y1 - Math.round((pose.y1 - pose.y0) * 0.2);
  let sum = 0, n = 0;
  for (let y = legsTop; y <= pose.y1; y++) for (let x = pose.x0; x <= pose.x1; x++) if (label[y * W + x] === pose.id) { sum += x; n++; }
  pose.cx = sum / n;
}
const band = (poses[0].x1 - poses[0].x0) * 0.2;
for (const pose of poses) {
  let top = pose.y1;
  for (let y = pose.y0; y <= pose.y1 && top === pose.y1; y++) {
    for (let x = Math.round(pose.cx - band); x <= Math.round(pose.cx + band); x++) if (label[y * W + x] === pose.id) { top = y; break; }
  }
  pose.bodyTop = top;
  pose.scale = TALL / (pose.y1 - top + 1);
}

/** One pose drawn into a frame: averaged down to size (so edges come out soft, not jagged) and anchored by the feet. */
function frameOf(pose) {
  const [fw, fh] = FRAME;
  const out = new Jimp({ width: fw, height: fh, color: 0x00000000 });
  const o = out.bitmap.data;
  const inv = 1 / pose.scale;
  for (let fy = 0; fy < fh; fy++) {
    for (let fx = 0; fx < fw; fx++) {
      // The source rectangle this frame pixel covers.
      const sx0 = pose.cx + (fx - fw / 2) * inv, sx1 = sx0 + inv;
      const sy1 = pose.y1 + 1 - (fh - FOOT_MARGIN - fy - 1) * inv, sy0 = sy1 - inv;
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        if (y < 0 || y >= H) continue;
        const hy = Math.min(sy1, y + 1) - Math.max(sy0, y);
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          if (x < 0 || x >= W) continue;
          const wgt = hy * (Math.min(sx1, x + 1) - Math.max(sx0, x));
          area += wgt;
          const p = y * W + x;
          if (label[p] !== pose.id) continue;
          r += data[p * 4] * wgt; g += data[p * 4 + 1] * wgt; b += data[p * 4 + 2] * wgt; a += wgt;
        }
      }
      if (a <= 0 || area <= 0) continue;
      const i = (fy * fw + fx) * 4;
      o[i] = Math.round(r / a); o[i + 1] = Math.round(g / a); o[i + 2] = Math.round(b / a);
      o[i + 3] = Math.round(255 * Math.min(1, a / (inv * inv)));
    }
  }
  return out;
}

/** The same frame with everything above the waist 2 px lower: a breath. */
function breathe(frame) {
  const [fw, fh] = FRAME;
  const out = frame.clone();
  const src = frame.bitmap.data, dst = out.bitmap.data;
  const waist = fh - FOOT_MARGIN - Math.round(TALL * 0.42);
  for (let y = 0; y < waist; y++) {
    for (let x = 0; x < fw; x++) {
      const from = y - 2;
      const i = (y * fw + x) * 4;
      for (let k = 0; k < 4; k++) dst[i + k] = from >= 0 ? src[(from * fw + x) * 4 + k] : 0;
    }
  }
  return out;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const frames = poses.map(frameOf);
await frames[0].write(path.join(OUT, 'idle-1.png'));
await breathe(frames[0]).write(path.join(OUT, 'idle-2.png'));
for (let i = 1; i < frames.length; i++) await frames[i].write(path.join(OUT, `wave-${i}.png`));
await copyFile(source, path.join(OUT, 'sheet.raw.jpg'));
console.log(`${poses.length} poses -> ${OUT}/ (idle-1, idle-2, ${frames.slice(1).map((_, i) => `wave-${i + 1}`).join(', ')}); scales ${poses.map((p) => p.scale.toFixed(3)).join(', ')}`);
