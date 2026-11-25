// Device-pixel maths for the stage and for pixel type.
//
// A pixel font is crisp only when one font pixel covers a whole number of device pixels, so every
// size here is counted in device pixels first and turned into CSS px last.
//   Press Start 2P: 8 font pixels per em.  font-size = 8 x (font pixel).
//   VT323:          25 dots per em across (a glyph cell is 10 dots wide, a row is 2 dots tall).
//                   font-size = 25 x (dot).
import { SCENE_HEIGHT, SCENE_WIDTH } from './assets';

export type StageMetrics = {
  /** CSS px per scene pixel (ENGINE.md section 5). */
  k: number;
  /** window.devicePixelRatio when this was measured. */
  dpr: number;
  /** Device pixels per scene pixel: k x dpr, always a whole number. */
  d: number;
  /** Where the stage sits inside the stage area, CSS px, on whole device pixels. */
  left: number;
  top: number;
  /** Size of the stage area (the view below the status bar), CSS px. The ground covers all of it. */
  areaWidth: number;
  areaHeight: number;
};

const EPS = 1e-9;

export function currentDpr(): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

/** fit = min(w / 320, h / 180); k = max(1 / dpr, floor(fit x dpr) / dpr). The stage is centered. */
export function computeMetrics(availWidth: number, availHeight: number, dpr: number): StageMetrics {
  const fit = Math.min(availWidth / SCENE_WIDTH, availHeight / SCENE_HEIGHT);
  const d = Math.max(1, Math.floor(fit * dpr + EPS));
  const k = d / dpr;
  const snap = (free: number) => Math.max(0, Math.round((free / 2) * dpr)) / dpr;
  return { k, dpr, d, left: snap(availWidth - SCENE_WIDTH * k), top: snap(availHeight - SCENE_HEIGHT * k), areaWidth: availWidth, areaHeight: availHeight };
}

export function sameMetrics(a: StageMetrics, b: StageMetrics): boolean {
  return a.d === b.d && a.dpr === b.dpr && a.left === b.left && a.top === b.top && a.areaWidth === b.areaWidth && a.areaHeight === b.areaHeight;
}

/**
 * Device pixels per font pixel of a room label: half a scene pixel, rounded half up.
 * At 4 device px per scene px that is 2 (a 16 px font at 1x); at 3 it is also 2; at 5 it is 3.
 * Where that comes out under a 12 px font (phones), it goes up to two thirds of a scene pixel.
 */
export function roomLabelPx(d: number, dpr: number): number {
  const half = Math.max(1, Math.floor(d / 2 + 0.5));
  const legible = Math.min(Math.ceil(1.5 * dpr - EPS), Math.floor((2 * d) / 3));
  return Math.max(half, legible);
}

/**
 * Device pixels per font pixel of an overworld label: about three quarters of a scene pixel, never
 * under a 16 px font, never over one scene pixel and never smaller than a room label.
 */
export function worldLabelPx(d: number, dpr: number): number {
  return Math.min(d, Math.max(roomLabelPx(d, dpr), Math.round(2 * dpr), Math.round(0.75 * d)));
}

/**
 * Device pixels per VT323 dot for text inside the stage (dialog body): a quarter of a scene pixel,
 * rounded down, and never under a 16 CSS px font. Rounded down because the dialog box grows with
 * the stage a scene pixel at a time while the type can only double: the smaller step always fits
 * more of the text.
 */
export function stageDotPx(d: number, dpr: number): number {
  return Math.max(Math.ceil(0.64 * dpr - EPS), Math.floor(d / 4 + EPS));
}

/** CSS px per Press Start 2P font pixel outside the stage (HUD, list view): 1 px, or the next whole device pixel up. */
export function chromePx(dpr: number): number {
  return Math.ceil(dpr - EPS) / dpr;
}

/** CSS px per VT323 dot outside the stage: the whole device pixel nearest to 1 px. */
export function chromeDot(dpr: number): number {
  return Math.max(1, Math.round(dpr)) / dpr;
}

/** Writes --px and --dot on <html>. Call before the first paint and whenever devicePixelRatio changes. */
export function applyChromePixels(dpr: number = currentDpr()): void {
  const style = document.documentElement.style;
  style.setProperty('--px', `${chromePx(dpr)}px`);
  style.setProperty('--dot', `${chromeDot(dpr)}px`);
}

/** Calls back whenever devicePixelRatio changes (browser zoom, moving the window to another screen). */
export function watchDpr(onChange: () => void): () => void {
  let query: MediaQueryList | null = null;
  const listen = () => {
    query?.removeEventListener('change', handle);
    query = window.matchMedia(`(resolution: ${currentDpr()}dppx)`);
    query.addEventListener('change', handle);
  };
  const handle = () => {
    listen();
    onChange();
  };
  listen();
  return () => query?.removeEventListener('change', handle);
}
