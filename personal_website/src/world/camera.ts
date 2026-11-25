// Where the camera is for each view, and how it travels between two places.
// A camera is a transform on the scene layer: scene point q is drawn at q x s + (x, y), in scene pixels.
import { SCENE_HEIGHT, SCENE_WIDTH, titleOverworldRect } from './assets';
import type { Box } from './types';

export type Camera = { x: number; y: number; s: number };

export const HOME: Camera = { x: 0, y: 0, s: 1 };

/**
 * Top of the dialog layer, in scene pixels: a dialog never reaches higher than this (see
 * .stage__dialog in src/styles/world.css), so at least this much of the stage stays free above it
 * and an opened object is framed there.
 */
export const DIALOG_TOP = 68;

/**
 * Top of the dialog layer on a stage too small for that (see dialogTop): the dialog may then grow
 * over nearly the whole stage, because the text matters more than the room behind it.
 */
export const DIALOG_TOP_TIGHT = 8;

/** The least band the camera frames an opened object in, however tall the dialog. */
export const MIN_BAND = 40;

/** Scene pixels kept free under the dialog (the bottom padding of .stage__dialog). */
const DIALOG_BOTTOM = 6;
/** A line of dialog text, in dots of the body face (dialog.css). */
const LINE_DOTS = 30;

/**
 * Where the dialog layer starts for a stage at `d` device pixels per scene pixel whose body text
 * is set at `dot` device pixels per dot. Body type cannot go under 16 CSS px, so on a small stage
 * the layer under DIALOG_TOP holds only a few lines: when it is shorter than ten of them (frame
 * and BACK row included), the layer starts at DIALOG_TOP_TIGHT instead. A short dialog is still
 * only as tall as its content.
 */
export function dialogTop(d: number, dot: number): number {
  const roomy = (SCENE_HEIGHT - DIALOG_TOP - DIALOG_BOTTOM) * d;
  return roomy < 10 * LINE_DOTS * dot ? DIALOG_TOP_TIGHT : DIALOG_TOP;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * CSS transform for a camera. Lengths are in --u, so the value survives a resize. The scale is
 * written in full: SceneView undoes it for the labels of a zoomed room (1 / s), and the two have
 * to cancel exactly for that type to stay on the pixel grid.
 */
export function cameraCss(camera: Camera): string {
  if (camera.s === 1 && camera.x === 0 && camera.y === 0) return 'none';
  return `translate(calc(${round6(camera.x)} * var(--u)), calc(${round6(camera.y)} * var(--u))) scale(${camera.s})`;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Title screen zoomed so that the small island (the overworld's rect) exactly fills the stage. */
export function titleCamera(): Camera {
  const [x, y, w] = titleOverworldRect;
  const s = SCENE_WIDTH / w;
  return { x: -x * s, y: -y * s, s };
}

/** The overworld zoomed until a location's box nearly fills the stage, centered on the box. */
export function diveCamera(box: Box): Camera {
  const [bx, by, bw, bh] = box;
  const s = 0.9 * Math.min(SCENE_WIDTH / bw, SCENE_HEIGHT / bh);
  return {
    s,
    x: clamp(SCENE_WIDTH / 2 - (bx + bw / 2) * s, SCENE_WIDTH * (1 - s), 0),
    y: clamp(SCENE_HEIGHT / 2 - (by + bh / 2) * s, SCENE_HEIGHT * (1 - s), 0),
  };
}

/**
 * Device pixels per scene pixel while the camera is on an opened object: the whole number nearest
 * to 1.3 times the stage's own `d`, so the zoomed art keeps even pixels. The labels of a zoomed
 * room are laid out for this number (SceneView).
 */
export function itemDevicePx(d: number): number {
  return Math.max(d, Math.round(1.3 * d));
}

/**
 * A room eased toward one object, with the object in the band of the stage that the open dialog
 * leaves free: `band` scene pixels from the top (the dialog's top edge; a short dialog leaves more).
 * The scale is itemDevicePx(d) / d; the offset is on whole device pixels. `d` is device pixels per
 * scene pixel.
 */
export function itemCamera(box: Box, d: number, band: number = DIALOG_TOP): Camera {
  const [bx, by, bw, bh] = box;
  const s = itemDevicePx(d) / d;
  const snap = (n: number) => Math.round(n * d) / d;
  // The room rises to bring a low object into the band, but its bottom edge stays behind the
  // dialog: no bare ground shows between the art and the box.
  const lowest = Math.min(0, Math.ceil((band - SCENE_HEIGHT * s) * d) / d);
  return {
    s,
    // Never show past the left, right or top edge of the art.
    x: snap(clamp(SCENE_WIDTH / 2 - (bx + bw / 2) * s, SCENE_WIDTH * (1 - s), 0)),
    y: clamp(snap(band / 2 - (by + bh / 2) * s), lowest, 0),
  };
}

/**
 * How far below the view a room's ground has to reach, in scene units. With a dialog open the
 * camera may lift the room until its bottom edge is MIN_BAND from the top of the stage; whatever
 * the view then shows under the room (around the dialog) is ground, and it moves up with the room.
 */
export function groundBelow(d: number): number {
  return Math.ceil(((SCENE_HEIGHT - MIN_BAND) * d) / itemDevicePx(d));
}

/**
 * The camera a fraction `t` of the way from `a` to `b`. The scale moves geometrically (a zoom that
 * looks even) about the one point of the stage that shows the same scene point at both ends.
 */
export function mixCamera(a: Camera, b: Camera, t: number): Camera {
  if (t <= 0) return a;
  if (t >= 1) return b;
  if (Math.abs(a.s - b.s) < 1e-6) {
    return { s: b.s, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  const s = a.s * Math.pow(b.s / a.s, t);
  // Scene point that stays put on screen: q x a.s + a = q x b.s + b.
  const qx = (b.x - a.x) / (a.s - b.s);
  const qy = (b.y - a.y) / (a.s - b.s);
  return { s, x: qx * a.s + a.x - qx * s, y: qy * a.s + a.y - qy * s };
}
