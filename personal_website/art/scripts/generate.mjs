#!/usr/bin/env node
// Generate N candidates for one asset, clean each into NES pixel art, save for review.
//
//   node art/scripts/generate.mjs --name overworld --prompt art/prompts/overworld.md --n 3
//   node art/scripts/generate.mjs --name town --prompt art/prompts/town.md --ref art/approved/overworld-crop-town.png
//
// Output: art/raw/<name>/<run>/candidate-<i>.{raw.jpg,png,preview.png}
//   .raw.jpg      what the model returned
//   .png          the real asset (e.g. 320x180, NES palette only)
//   .preview.png  the asset enlarged with no smoothing, for looking at
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { generateImage, loadReference, IMAGE_MODEL } from './gemini.mjs';
import { placeOnGround } from './ground.mjs';
import { toPixelArt, enlarge, colorCount } from './postprocess.mjs';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    prompt: { type: 'string' },
    ref: { type: 'string', multiple: true, default: [] },
    n: { type: 'string', default: '3' },
    size: { type: 'string', default: '320x180' },
    aspect: { type: 'string', default: '16:9' },
    'image-size': { type: 'string', default: '1K' },
    'chroma-key': { type: 'boolean', default: false },
    ground: { type: 'boolean', default: false },
    'preview-scale': { type: 'string', default: '4' },
  },
});

if (!values.name || !values.prompt) {
  console.error('usage: generate.mjs --name <asset> --prompt <file.md> [--ref img]... [--n 3] [--size 320x180]');
  process.exit(1);
}

// Prompt files may hold notes above a line containing only "---PROMPT---"; only text below it is sent.
const promptFile = await readFile(values.prompt, 'utf8');
const marker = promptFile.indexOf('---PROMPT---');
const prompt = (marker === -1 ? promptFile : promptFile.slice(marker + '---PROMPT---'.length)).trim();

const [width, height] = values.size.split('x').map(Number);
const n = Number(values.n);
const references = await Promise.all(values.ref.map(loadReference));
const run = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join('art', 'raw', values.name, run);
await mkdir(outDir, { recursive: true });

console.log(`${IMAGE_MODEL}: ${n} candidate(s) for "${values.name}" -> ${width}x${height}, ${references.length} reference(s)`);

const results = await Promise.allSettled(
  Array.from({ length: n }, async (_, i) => {
    const { buffer, latencyMs } = await generateImage({
      prompt,
      references,
      aspectRatio: values.aspect,
      imageSize: values['image-size'],
    });
    const base = path.join(outDir, `candidate-${i + 1}`);
    await writeFile(`${base}.raw.jpg`, buffer);
    let art = await toPixelArt(buffer, { width, height, chromaKey: values['chroma-key'] });
    if (values.ground) {
      await art.write(`${base}.cutout.png`);
      art = placeOnGround(art);
    }
    await art.write(`${base}.png`);
    await enlarge(art, Number(values['preview-scale'])).write(`${base}.preview.png`);
    return { base, latencyMs, colors: colorCount(art) };
  }),
);

await writeFile(
  path.join(outDir, 'run.json'),
  JSON.stringify({ model: IMAGE_MODEL, prompt, refs: values.ref, size: values.size, aspect: values.aspect }, null, 2),
);

let failures = 0;
for (const [i, r] of results.entries()) {
  if (r.status === 'fulfilled') {
    console.log(`  candidate-${i + 1}: ${r.value.colors} NES colors, ${(r.value.latencyMs / 1000).toFixed(1)}s -> ${r.value.base}.preview.png`);
  } else {
    failures++;
    console.log(`  candidate-${i + 1}: FAILED ${r.reason?.message ?? r.reason}`);
  }
}
if (failures === n) process.exit(1);
