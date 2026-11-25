#!/usr/bin/env node
// Re-run the cleanup on existing raw outputs (no API calls), e.g. after changing postprocess.mjs.
//   node art/scripts/reprocess.mjs art/raw/misc/<run> [--chroma-key] [--size 320x180]
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { placeOnGround } from './ground.mjs';
import { toPixelArt, enlarge } from './postprocess.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'chroma-key': { type: 'boolean', default: false }, ground: { type: 'boolean', default: false }, size: { type: 'string', default: '320x180' } },
});
const [width, height] = values.size.split('x').map(Number);
for (const dir of positionals) {
  for (const f of (await readdir(dir)).filter((f) => f.endsWith('.raw.jpg'))) {
    const base = path.join(dir, f.replace('.raw.jpg', ''));
    let art = await toPixelArt(await readFile(`${base}.raw.jpg`), { width, height, chromaKey: values['chroma-key'] });
    if (values.ground) {
      await art.write(`${base}.cutout.png`);
      art = placeOnGround(art);
    }
    await art.write(`${base}.png`);
    await enlarge(art, 4).write(`${base}.preview.png`);
    console.log(`reprocessed ${base}`);
  }
}
