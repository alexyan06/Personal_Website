// Getting art and fonts ready ahead of time, so nothing flashes or swaps when it is first shown.
import { grounds, smokeOver } from './assets';
import { scenes } from './scenes';
import type { SceneId } from './types';

const FONT_SPECS = ["8px 'Press Start 2P'", "25px 'VT323'"];
/** Text is never held back for a font longer than this: after it, the fallback face shows. */
const FONT_PATIENCE_MS = 1500;
/**
 * A scene is not shown, and the stage does not say idle, until its art can be painted whole. On a
 * slow line that takes seconds; only after this long (the request is surely stuck) does it go on without.
 */
const ART_PATIENCE_MS = 10000;

const timeout = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

let fonts: Promise<void> | null = null;

/**
 * Starts both pixel fonts loading. Resolves when they are usable (or after a short wait if one fails).
 * Until then <html> has the class `fonts-pending`, which holds text back (see src/index.css): a
 * fallback face would not fit the pixel grid, so nothing is better than the wrong letters.
 */
export function loadFonts(): Promise<void> {
  if (!fonts) {
    const root = document.documentElement;
    root.classList.add('fonts-pending');
    const loads = FONT_SPECS.map((spec) => document.fonts.load(spec).catch(() => undefined));
    fonts = Promise.race([Promise.all(loads).then(() => undefined), timeout(FONT_PATIENCE_MS)]).then(() => root.classList.remove('fonts-pending'));
  }
  return fonts;
}

/** Resolves once this <img> can be painted without a decode step, or has failed to load. */
function decodeImage(img: HTMLImageElement | null | undefined): Promise<void> {
  if (!img) return Promise.resolve();
  const decoded = typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve();
  return Promise.race([decoded, timeout(ART_PATIENCE_MS)]);
}

/** Everything a scene draws: its picture, the tile (or tiles) of its ground, its character's sprite sheet and its chimney smoke's. */
function sceneImages(id: SceneId): string[] {
  const scene = scenes[id];
  const smoke = smokeOver(scene.image);
  return [scene.image, ...grounds[scene.ground].frames, ...(scene.character ? [scene.character.sprite.image] : []), ...(smoke ? [smoke.image] : [])];
}

/** Images fetched so far, by URL, each with the promise of its decode. They are kept so the browser keeps them warm. */
const kept = new Map<string, { img: HTMLImageElement; decoded: Promise<void> }>();

function fetchImage(url: string, priority: 'high' | 'low'): Promise<void> {
  const known = kept.get(url);
  if (known) {
    if (priority === 'high') known.img.fetchPriority = 'high';
    return known.decoded;
  }
  const img = new Image();
  img.decoding = 'async';
  img.fetchPriority = priority;
  img.src = url;
  const decoded = decodeImage(img);
  kept.set(url, { img, decoded });
  return decoded;
}

/**
 * Resolves once a scene can be painted whole: the picture in its element is decoded, and so are
 * its ground tiles, its character and its smoke. The ground and the smoke are CSS backgrounds,
 * which have no decode() of their own, so the same files are decoded here first; the stage does
 * not say idle before that.
 */
export function sceneReady(element: HTMLElement | null | undefined, id: SceneId): Promise<void> {
  const picture = decodeImage(element?.querySelector<HTMLImageElement>('img.scene__img'));
  return Promise.all([picture, ...sceneImages(id).map((url) => fetchImage(url, 'high'))]).then(() => undefined);
}

/**
 * Fetches and decodes scene art in the background: `first` (the scenes one step away from the one
 * on screen) ahead of the rest.
 */
export function preloadScenes(first: SceneId[] = []): void {
  const rest = (Object.keys(scenes) as SceneId[]).filter((id) => !first.includes(id));
  for (const id of first) for (const url of sceneImages(id)) void fetchImage(url, 'high');
  for (const id of rest) for (const url of sceneImages(id)) void fetchImage(url, 'low');
}
