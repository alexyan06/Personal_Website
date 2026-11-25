// The approved art, straight from art/approved/: the high-definition pictures and tiles in hd/,
// and the regions measured on the 320x180 scene grid. Vite fingerprints the images; nothing is
// copied by hand.
import backdrops from '../../art/approved/hd/backdrops.json';
import mascotMeta from '../../art/approved/hd/mascot.json';
import smokeMeta from '../../art/approved/hd/smoke.json';
import titleMeta from '../../art/approved/title.json';
import overworldRegions from '../../art/approved/overworld.regions.json';
import aboutRegions from '../../art/approved/about.regions.json';
import experienceRegions from '../../art/approved/experience.regions.json';
import projectsRegions from '../../art/approved/projects.regions.json';
import skillsRegions from '../../art/approved/skills.regions.json';
import learningRegions from '../../art/approved/learning.regions.json';
import miscRegions from '../../art/approved/misc.regions.json';

import type { Box, Ground, GroundId, Region, SceneId, SmokeSheet, Sprite, SpriteAnimation } from './types';

/** Scene size in scene units. Every picture is drawn across exactly this, whatever its own size. */
export const SCENE_WIDTH = 320;
export const SCENE_HEIGHT = 180;

/** Every picture in art/approved/hd/, by file name: the JSON files there name their images. */
const hdFiles = import.meta.glob<string>('../../art/approved/hd/*.webp', { eager: true, query: '?url', import: 'default' });

function hd(name: string, where: string): string {
  const url = hdFiles[`../../art/approved/hd/${name}`];
  if (!url) throw new Error(`${where}: there is no art/approved/hd/${name}`);
  return url;
}

/**
 * The picture of each scene, cut out of its background (transparent around the island and around
 * each room). The title screen shows the overworld's picture small (see titleOverworldRect).
 */
export const images: Record<SceneId, string> = {
  title: hd('overworld.webp', 'title'),
  world: hd('overworld.webp', 'overworld'),
  about: hd('about.webp', 'about'),
  experience: hd('experience.webp', 'experience'),
  projects: hd('projects.webp', 'projects'),
  skills: hd('skills.webp', 'skills'),
  learning: hd('learning.webp', 'learning'),
  misc: hd('misc.webp', 'misc'),
};

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function toBox(value: unknown, where: string): Box {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(isNumber)) {
    throw new Error(`${where}: expected a box [x, y, w, h]`);
  }
  return [value[0], value[1], value[2], value[3]];
}

function toPair(value: unknown, where: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(isNumber)) {
    throw new Error(`${where}: expected a pair of numbers`);
  }
  return [value[0], value[1]];
}

/** Checks a regions file and gives its boxes real types. */
function loadRegions(file: { regions: Record<string, unknown> }, name: string): Record<string, Region> {
  const out: Record<string, Region> = {};
  for (const [id, raw] of Object.entries(file.regions)) {
    const entry = raw as { box?: unknown; plate?: unknown; items?: unknown };
    const where = `${name}.regions.json "${id}"`;
    const region: Region = { box: toBox(entry.box, `${where} box`) };
    if (entry.plate !== undefined) region.plate = toBox(entry.plate, `${where} plate`);
    if (Array.isArray(entry.items)) region.items = entry.items.map((item, i) => toBox(item, `${where} items[${i}]`));
    out[id] = region;
  }
  return out;
}

/** Regions per scene. The title screen has none. */
export const regions: Record<Exclude<SceneId, 'title'>, Record<string, Region>> = {
  world: loadRegions(overworldRegions, 'overworld'),
  about: loadRegions(aboutRegions, 'about'),
  experience: loadRegions(experienceRegions, 'experience'),
  projects: loadRegions(projectsRegions, 'projects'),
  skills: loadRegions(skillsRegions, 'skills'),
  learning: loadRegions(learningRegions, 'learning'),
  misc: loadRegions(miscRegions, 'misc'),
};

/** Where the overworld's picture sits on the title screen: the title-to-overworld zoom targets this box. */
export const titleOverworldRect: Box = toBox(titleMeta.overworldRect, 'title.json overworldRect');

/** Where the name and PRESS START go on the title screen. */
export const titleTextAreas = {
  title: toBox(titleMeta.textAreas.title, 'title.json textAreas.title'),
  pressStart: toBox(titleMeta.textAreas.pressStart, 'title.json textAreas.pressStart'),
};

// ---- the ground behind a scene (hd/backdrops.json) ---------------------------------------------

function loadGround(id: GroundId): Ground {
  const where = `backdrops.json "${id}"`;
  const entry = backdrops[id] as { color?: unknown; tile?: unknown; frames?: unknown };
  if (typeof entry.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(entry.color)) throw new Error(`${where}: expected a color like #0682F8`);
  if (!Array.isArray(entry.frames) || entry.frames.length === 0) throw new Error(`${where}: expected at least one tile image in "frames"`);
  return {
    id,
    color: entry.color,
    tile: toPair(entry.tile, `${where} tile`),
    frames: entry.frames.map((name) => hd(String(name), where)),
  };
}

/** The sea (title screen and overworld) and the grass (rooms): a base color and the tile that covers the view. */
export const grounds: Record<GroundId, Ground> = { ocean: loadGround('ocean'), grass: loadGround('grass') };

// ---- the character in the cottage (hd/mascot.json) ---------------------------------------------

function loadAnimation(value: unknown, count: number, where: string): SpriteAnimation {
  const entry = (value ?? {}) as { frames?: unknown; fps?: unknown };
  const frames = Array.isArray(entry.frames) ? entry.frames : [];
  if (frames.length === 0 || !frames.every((f) => Number.isInteger(f) && f >= 0 && f < count)) {
    throw new Error(`${where}: "frames" must list frame numbers from 0 to ${count - 1}`);
  }
  if (!isNumber(entry.fps) || entry.fps <= 0) throw new Error(`${where}: "fps" must be a positive number`);
  return { frames: frames as number[], fps: entry.fps };
}

function loadSprite(meta: typeof mascotMeta): Sprite {
  const where = 'mascot.json';
  if (!Number.isInteger(meta.count) || meta.count < 1) throw new Error(`${where}: "count" must be a whole number of frames`);
  return {
    image: hd(meta.image, where),
    frame: toPair(meta.frame, `${where} frame`),
    count: meta.count,
    size: toPair(meta.size, `${where} size`),
    anchor: toPair(meta.anchor, `${where} anchor`),
    animations: {
      idle: loadAnimation(meta.animations.idle, meta.count, `${where} animations.idle`),
      wave: loadAnimation(meta.animations.wave, meta.count, `${where} animations.wave`),
    },
  };
}

/** The sprite sheet of the character who stands in the cottage. Everything about it comes from the JSON. */
export const mascot: Sprite = loadSprite(mascotMeta);

// ---- the smoke of the island's chimneys (hd/smoke.json) -----------------------------------------

function loadSmoke(meta: typeof smokeMeta): SmokeSheet {
  const where = 'smoke.json';
  if (!Number.isInteger(meta.count) || meta.count < 1) throw new Error(`${where}: "count" must be a whole number of frames`);
  return {
    image: hd(meta.image, where),
    over: hd(meta.over, where),
    count: meta.count,
    size: toPair(meta.size, `${where} size`),
    chimneys: meta.chimneys.map((chimney, index) => toPair(chimney.mouth, `${where} chimneys[${index}].mouth`)),
  };
}

const smoke: SmokeSheet = loadSmoke(smokeMeta);

/**
 * The smoke that rises over a picture, if it has chimneys: the sheet of puffs and where the
 * chimneys are. Only the island has it, and it goes wherever a scene shows the island (the
 * overworld, and small on the title screen). How it moves is in src/world/smoke.ts.
 */
export function smokeOver(picture: string): SmokeSheet | undefined {
  return picture === smoke.over ? smoke : undefined;
}
