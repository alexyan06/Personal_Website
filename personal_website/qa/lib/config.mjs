// Shared constants for the headless QA harness. ENGINE.md sections 3, 5, 9 and 10 are the source.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const QA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECT_DIR = path.resolve(QA_DIR, '..');

export const SCENE_W = 320;
export const SCENE_H = 180;
export const ROOMS = ['about', 'experience', 'projects', 'skills', 'learning', 'misc'];

/** No single wait in the walk may take longer than this. */
export const STEP_MS = 5000;
/** A state has to hold this long before a stop counts as settled. */
export const STABLE_MS = 120;
export const MIN_TARGET = 24; // CSS px, ENGINE.md section 8
export const POS_TOLERANCE = 1.5; // CSS px, hotspot rectangle against its region box
export const HUD_MIN = 24;
export const HUD_MAX = 48;
/** A dialog whose text scrolls shows at least this many lines of it at a time. */
export const DIALOG_MIN_LINES = 6;

/** Which ground lies behind a scene: the sea behind the title screen and the overworld, grass behind a room. */
export const groundFor = (scene) => (scene === 'title' || scene === 'world' ? 'ocean' : 'grass');
/** The character: the scene he stands in and the hotspot he is the look of (its dialog is #/about/me). */
export const CHARACTER = { scene: 'about', hotspot: 'me' };
/** Items that have moved: the old address and where it must lead now. */
export const MOVED_ROUTES = [['/about/portrait', '/about/me']];

/**
 * Window shapes the ground is checked at besides the profile's own: one much wider than the stage
 * and one much taller, so there is a broad band of ground beside it and then above and below it.
 * Both are large enough to show the world (no "make this window larger" screen).
 */
export const GROUND_SHAPES = {
  wide: { width: 2200, height: 600 },
  tall: { width: 720, height: 1200 },
};

export const FONTS = ['Press Start 2P', 'VT323'];

export const FLOWS = ['title', 'world', 'rooms', 'deeplinks', 'keyboard', 'list', 'gate', 'motion', 'ambient'];
const WALK = ['title', 'world', 'rooms', 'deeplinks', 'keyboard', 'list', 'ambient'];

/** Profiles from ENGINE.md section 10, with the flows each one runs. */
export const PROFILES = {
  desktop: { width: 1440, height: 900, dpr: 1, flows: WALK },
  'desktop-hd': { width: 1920, height: 1080, dpr: 1, flows: WALK },
  retina: { width: 1440, height: 900, dpr: 2, flows: WALK },
  small: { width: 1024, height: 640, dpr: 1, flows: WALK },
  'phone-landscape': { width: 844, height: 390, dpr: 3, touch: true, flows: [...WALK, 'gate'] },
  // What a browser really leaves of a phone on its side, once its own bars are taken off: one
  // scale step below the bare screen above (5 device px per scene px instead of 6).
  'phone-small': { width: 750, height: 340, dpr: 3, touch: true, flows: ['rooms', 'deeplinks'] },
  // The smallest stage in use: an iPhone SE on its side, 3 device px per scene px.
  'phone-se': { width: 667, height: 375, dpr: 2, touch: true, flows: ['rooms'] },
  'phone-portrait': { width: 390, height: 844, dpr: 3, touch: true, flows: ['gate', 'list'] },
  'reduced-motion': { width: 1440, height: 900, dpr: 1, reducedMotion: true, flows: ['title', 'rooms', 'motion', 'ambient'] },
};

/** Requests and console noise that are not the site's fault when it runs locally. */
export const IGNORED_URLS = [/\/_vercel\/(insights|speed-insights)\//];
