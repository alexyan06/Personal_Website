#!/usr/bin/env node
// Crops one location out of the raw overworld (full model resolution) as a reference image.
//   node art/scripts/crop-ref.mjs about        -> art/approved/refs/about.png
import { Jimp } from 'jimp';
import { mkdir, readFile } from 'node:fs/promises';

const id = process.argv[2];
const regions = JSON.parse(await readFile('art/approved/overworld.regions.json', 'utf8'));
const region = regions.regions[id];
if (!region) throw new Error(`unknown region "${id}"; one of ${Object.keys(regions.regions).join(', ')}`);

const raw = await Jimp.read('art/approved/overworld.raw.jpg');
const [RW, RH] = [raw.bitmap.width, raw.bitmap.height];
const sx = raw.bitmap.width / regions.size[0];
const sy = raw.bitmap.height / regions.size[1];
const PAD = 4; // scene pixels of surrounding grass/path for context
const [x, y, w, h] = region.box;
const x0 = Math.max(0, Math.floor((x - PAD) * sx));
const y0 = Math.max(0, Math.floor((y - PAD) * sy));
const x1 = Math.min(raw.bitmap.width, Math.ceil((x + w + PAD) * sx));
const y1 = Math.min(raw.bitmap.height, Math.ceil((y + h + PAD) * sy));

await mkdir('art/approved/refs', { recursive: true });
await raw.crop({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }).write(`art/approved/refs/${id}.png`);
console.log(`art/approved/refs/${id}.png (${x1 - x0}x${y1 - y0} from ${RW}x${RH})`);
