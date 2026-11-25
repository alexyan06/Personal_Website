#!/usr/bin/env node
// Builds the character's sprite sheet for the cottage: art/approved/hd/mascot.webp and mascot.json.
// Frames are cut-outs (transparent PNGs, all the same size, feet on the bottom edge) in
// art/approved/mascot/: idle-1.png, idle-2.png, wave-1.png, wave-2.png ... in the order they play.
// With no frames there yet, a plain stand-in figure is drawn so the site has something to show.
//
//   node art/scripts/mascot.mjs
import { Jimp } from 'jimp';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { closeWebp, writeWebp } from './webp.mjs';

const FRAMES_DIR = 'art/approved/mascot';
const OUT = 'art/approved/hd';
const PX = 1376 / 320; // picture pixels per scene unit, as in the room art
/** Where the character's feet stand in the cottage, in scene units: the middle of the rug. */
const ANCHOR = [160, 112];

function standIn() {
  const w = 160, h = 208;
  const draw = (armUp, drop) => {
    const f = new Jimp({ width: w, height: h, color: 0x00000000 });
    const rect = (x0, y0, x1, y1, color) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) f.setPixelColor(color, x, y + drop);
    };
    rect(52, 20, 108, 84, 0x2a2a2aff); // head outline
    rect(56, 24, 104, 80, 0xf0c8a0ff); // face
    rect(56, 24, 104, 40, 0x2a2a2aff); // hair
    rect(48, 84, 112, 160, 0x2a2a2aff); // body outline
    rect(52, 88, 108, 156, 0x3c64c8ff); // shirt
    rect(56, 160, 78, 200, 0x2a2a2aff); // legs
    rect(82, 160, 104, 200, 0x2a2a2aff);
    if (armUp) rect(112, 40 - armUp * 8, 128, 100, 0x3c64c8ff);
    else rect(112, 92, 126, 150, 0x3c64c8ff);
    rect(34, 92, 48, 150, 0x3c64c8ff);
    return f;
  };
  return {
    frames: [draw(0, 0), draw(0, 4), draw(1, 0), draw(2, 0)],
    names: ['idle-1', 'idle-2', 'wave-1', 'wave-2'],
    standIn: true,
  };
}

async function load() {
  let files = [];
  try {
    files = (await readdir(FRAMES_DIR)).filter((f) => /^(idle|wave)-\d+\.png$/.test(f)).sort();
  } catch {
    // no folder yet
  }
  if (!files.length) return standIn();
  const frames = await Promise.all(files.map((f) => Jimp.read(path.join(FRAMES_DIR, f))));
  return { frames, names: files.map((f) => f.replace('.png', '')), standIn: false };
}

const { frames, names, standIn: isStandIn } = await load();
const fw = frames[0].bitmap.width;
const fh = frames[0].bitmap.height;
if (frames.some((f) => f.bitmap.width !== fw || f.bitmap.height !== fh)) throw new Error('mascot frames must all be the same size');

const sheet = new Jimp({ width: fw * frames.length, height: fh, color: 0x00000000 });
frames.forEach((frame, i) => sheet.composite(frame, i * fw, 0));
const bytes = await writeWebp(sheet, path.join(OUT, 'mascot.webp'), 0.92);
await closeWebp();

const index = (prefix) => names.map((n, i) => (n.startsWith(prefix) ? i : -1)).filter((i) => i >= 0);
const idle = index('idle');
const wave = index('wave');
const size = [fw / PX, fh / PX];
await writeFile(path.join(OUT, 'mascot.json'), JSON.stringify({
  note: 'The character in the cottage. One row of frames. Sizes and positions are in scene units (the room is 320x180). Built by art/scripts/mascot.mjs.',
  image: 'mascot.webp',
  standIn: isStandIn,
  frame: [fw, fh],
  count: frames.length,
  size,
  anchor: ANCHOR,
  animations: {
    idle: { frames: idle, fps: 2 },
    // Arm up and down a few times; the last frame is held when the animation does not loop.
    wave: { frames: wave.length > 1 ? [...wave, ...wave.slice(1, -1).reverse()] : wave, fps: 4 },
  },
}, null, 2) + '\n');
console.log(`mascot.webp ${frames.length} frame(s) of ${fw}x${fh}, ${(bytes / 1024).toFixed(0)} kB${isStandIn ? ' (stand-in)' : ''}`);
