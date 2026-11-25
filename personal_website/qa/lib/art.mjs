// What the art says about itself, read from art/approved/hd/ (and title.json beside it):
//   backdrops.json  the picture size, and the two grounds (base color, tile size in scene units, tile frames)
//   mascot.json     the character's sprite sheet (frame size, count, size and anchor in scene units, animations)
//   title.json      where the overworld's picture sits on the title screen
// The checks compare the page against these numbers, so nothing about the art is written down twice.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_DIR } from './config.mjs';

const isNumber = (n) => typeof n === 'number' && Number.isFinite(n);
const isPair = (v) => Array.isArray(v) && v.length === 2 && v.every(isNumber);

function rgbOf(hexColor) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hexColor ?? ''));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

async function readJson(file, problems) {
  const shown = path.relative(PROJECT_DIR, file) || file;
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    problems.push(error.code === 'ENOENT' ? `${shown} does not exist` : `${shown} could not be read: ${error.message}`);
    return null;
  }
}

/** File name without its extension: `ocean-a.webp` -> `ocean-a`. A built URL keeps it as a prefix (`ocean-a-3f9c.webp`). */
export const stem = (name) => String(name).split('/').pop().split('?')[0].replace(/\.[a-z0-9]+$/i, '');

/**
 * { problems, picture, grounds: { ocean, grass }, mascot, title }. Parts that cannot be read are
 * null and named in `problems`; the checks that need them then say so instead of passing.
 */
export async function loadArt(approvedDir = path.join(PROJECT_DIR, 'art', 'approved')) {
  const problems = [];
  const out = { problems, picture: null, grounds: null, mascot: null, title: null };

  const backdrops = await readJson(path.join(approvedDir, 'hd', 'backdrops.json'), problems);
  if (backdrops) {
    if (isPair(backdrops.picture)) out.picture = backdrops.picture;
    else problems.push('backdrops.json has no "picture" size [w, h]');
    const grounds = {};
    for (const id of ['ocean', 'grass']) {
      const entry = backdrops[id];
      const color = rgbOf(entry?.color);
      const frames = Array.isArray(entry?.frames) ? entry.frames.filter((f) => typeof f === 'string') : [];
      if (!entry || !color || !isPair(entry.tile) || !frames.length) problems.push(`backdrops.json "${id}" needs a color (#RRGGBB), a tile size [w, h] and at least one frame`);
      else grounds[id] = { id, color, hex: entry.color.toUpperCase(), tile: entry.tile, frames };
    }
    if (grounds.ocean && grounds.grass) out.grounds = grounds;
  }

  const mascot = await readJson(path.join(approvedDir, 'hd', 'mascot.json'), problems);
  if (mascot) {
    const animation = (a) => a && Array.isArray(a.frames) && a.frames.length && a.frames.every((f) => Number.isInteger(f) && f >= 0 && f < mascot.count) && isNumber(a.fps) && a.fps > 0;
    if (!isPair(mascot.frame) || !isPair(mascot.size) || !isPair(mascot.anchor) || !Number.isInteger(mascot.count) || mascot.count < 1) {
      problems.push('mascot.json needs "frame", "size" and "anchor" as pairs of numbers and a whole "count"');
    } else if (!animation(mascot.animations?.idle) || !animation(mascot.animations?.wave)) {
      problems.push('mascot.json needs "animations.idle" and "animations.wave", each with "frames" (numbers below "count") and "fps"');
    } else {
      out.mascot = {
        image: mascot.image,
        frame: mascot.frame,
        count: mascot.count,
        size: mascot.size,
        anchor: mascot.anchor,
        animations: { idle: mascot.animations.idle, wave: mascot.animations.wave },
      };
    }
  }

  const title = await readJson(path.join(approvedDir, 'title.json'), problems);
  if (title) {
    const rect = title.overworldRect;
    if (Array.isArray(rect) && rect.length === 4 && rect.every(isNumber)) out.title = { overworldRect: rect };
    else problems.push('title.json has no "overworldRect" [x, y, w, h]');
  }
  return out;
}
