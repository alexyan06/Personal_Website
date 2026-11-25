#!/usr/bin/env node
// Builds the title-screen background from the approved overworld, so pressing
// start can zoom straight into the island with a pixel-exact match.
//   1. fill a 320x180 canvas with ocean tiled from the overworld's own open water
//   2. shrink the whole overworld by SCALE using the same majority-vote downsample
//   3. paste it so the overworld frame sits at a known spot (recorded in title.json)
import { Jimp } from 'jimp';
import { writeFile } from 'node:fs/promises';
import { toPixelArt, enlarge } from './postprocess.mjs';

const SCALE = 4;                      // overworld shown at 1/4 size on the title screen
const W = 320, H = 180;
// Ocean colors and wave glyph, read off the overworld's open water (rows 11-13, x 1-6).
const OCEAN = 0x0078f8ff;
const WAVE = 0x3cbcfcff;
const GLYPH = ['..##..', '.#.#..', '#...##'];
// Same rhythm as the overworld: groups of 4 glyphs 9px apart, rows 16px apart, alternate rows staggered.
const GLYPH_PITCH = 9, GROUP = 4, GROUP_PERIOD = 48, ROW_PITCH = 16, ROW_STAGGER = 24;

const world = await Jimp.read('art/approved/overworld.png');
const title = new Jimp({ width: W, height: H, color: OCEAN });
for (let row = 0, y = 4; y < H; row++, y += ROW_PITCH) {
  for (let gx = -GROUP_PERIOD + (row % 2) * ROW_STAGGER; gx < W; gx += GROUP_PERIOD) {
    for (let g = 0; g < GROUP; g++) {
      GLYPH.forEach((line, dy) => [...line].forEach((ch, dx) => {
        const x = gx + g * GLYPH_PITCH + dx;
        if (ch === '#' && x >= 0 && x < W && y + dy < H) title.setPixelColor(WAVE, x, y + dy);
      }));
    }
  }
}

const small = await toPixelArt(await world.getBuffer('image/png'), {
  width: W / SCALE, height: H / SCALE, coreFraction: 1,
});
const ox = Math.round((W - W / SCALE) / 2);
const oy = Math.round(H * 0.56 - H / SCALE / 2);   // slightly below middle; title text goes above
// Paste only the island: the shrunken frame's own ocean pixels are skipped so the waves run up to the shore.
for (let y = 0; y < small.bitmap.height; y++) {
  for (let x = 0; x < small.bitmap.width; x++) {
    const c = small.getPixelColor(x, y);
    if (c !== OCEAN && c !== WAVE) title.setPixelColor(c, ox + x, oy + y);
  }
}

await title.write('art/approved/title.png');
await enlarge(title, 4).write('art/approved/title.preview.png');
await writeFile('art/approved/title.json', JSON.stringify({
  image: 'title.png',
  size: [W, H],
  note: 'Where the overworld sits on the title screen. Zoom from this rect to full screen on PRESS START.',
  overworldRect: [ox, oy, W / SCALE, H / SCALE],
  textAreas: { title: [0, 12, W, 44], pressStart: [0, 140, W, 28] },
}, null, 2));
console.log('title.png built; overworld rect', [ox, oy, W / SCALE, H / SCALE]);
