// Camera moves between views (ENGINE.md section 6): which move to make, and the code that runs it.
// A move works directly on the scene elements, frame by frame, so the art is drawn again at every
// scale instead of being stretched from a cached texture. A scene's ground is part of its element,
// so the sea and the grass travel with the camera.
import { animate } from 'motion';
import { HOME, cameraCss, diveCamera, itemCamera, mixCamera, titleCamera, type Camera } from './camera';
import { sceneReady } from './preload';
import { findHotspot, scenes, worldRegionOf } from './scenes';
import type { RoomId, SceneId } from './types';

/** What the stage shows: a scene, and in a room possibly an open item. */
export type Place = { scene: SceneId; item: string | null };

/**
 * A Place with the identity of the element that draws it. Two views with the same `uid` are the
 * same scene element (the camera moves it); a new `uid` is a new element (it replaces the old one).
 */
export type View = Place & { uid: number };

export type StepKind = 'camera' | 'fade' | 'title-in' | 'title-out' | 'dive-in' | 'dive-out';
export type Step = { kind: StepKind; from: View; to: View };

export const samePlace = (a: Place, b: Place) => a.scene === b.scene && a.item === b.item;

const isRoom = (scene: SceneId): scene is RoomId => scene !== 'title' && scene !== 'world';

/**
 * The next move from where the stage is toward where the URL points. One step may stop short
 * (overworld to an item is a dive, then an ease toward the object); the caller plans again after it.
 */
export function planStep(from: View, target: Place, reducedMotion: boolean): Step {
  const fresh = (place: Place): View => ({ uid: from.uid + 1, scene: place.scene, item: place.item });
  // Reduced motion: every change is one opacity cross-fade to the final picture.
  if (reducedMotion) return { kind: 'fade', from, to: fresh(target) };
  if (from.scene === target.scene) return { kind: 'camera', from, to: { ...target, uid: from.uid } };
  if (from.item !== null) {
    // Leaving with a dialog open: close it first when the way out is the dive, else just cross-fade.
    if (target.scene === 'world') return { kind: 'camera', from, to: { uid: from.uid, scene: from.scene, item: null } };
    return { kind: 'fade', from, to: fresh(target) };
  }
  if (from.scene === 'title' && target.scene === 'world') return { kind: 'title-in', from, to: fresh(target) };
  if (from.scene === 'world' && target.scene === 'title') return { kind: 'title-out', from, to: fresh(target) };
  if (from.scene === 'world' && isRoom(target.scene)) return { kind: 'dive-in', from, to: fresh({ scene: target.scene, item: null }) };
  if (isRoom(from.scene) && target.scene === 'world') return { kind: 'dive-out', from, to: fresh(target) };
  return { kind: 'fade', from, to: fresh(target) };
}

/**
 * Where the camera rests for a view. `d` is device pixels per scene pixel; `band` is how many scene
 * pixels of the stage the open dialog leaves free above it, where an opened object is framed.
 */
export function restCamera(view: Place, d: number, band: number): Camera {
  if (view.item === null) return HOME;
  const hotspot = findHotspot(view.scene, view.item);
  return hotspot ? itemCamera(hotspot.region.box, d, band) : HOME;
}

// ---- timings (ms) and curves; ENGINE.md section 6 gives the starting points -------------------

const TITLE_ZOOM = 800;
/**
 * The map fades in over the zoomed title screen, sea and all. The island is the same picture in
 * the same place, so only the waves change (they are 4x their size by then): this softens that.
 */
const TITLE_SWAP = 180;
const DIVE = 500;
const DIVE_OUT = 450;
const FLASH_IN = 120;
const FLASH_OUT = 150;
const ITEM = 300;
/**
 * A cross-fade, which is every move under reduced motion. The whole change has to stay inside
 * 200 ms, and before the fade the new scene's large picture has to be put on screen, so the fade
 * itself is kept well short of that.
 */
const FADE = 120;
/** How long labels take to come back once the camera has stopped (matches .scene__labels in world.css). */
const LABELS_IN = 100;

/**
 * `data-ui` of a scene element at rest: `on` (labels and hotspots live) or, behind an open dialog,
 * `zoom` (only the labels laid out for the zoomed camera). While the camera moves it is `off`.
 * This file writes it while a move runs and React writes the same value when the move is over
 * (World.tsx), so the two never disagree at rest.
 */
export const restUi = (view: Place): 'on' | 'zoom' => (view.item === null ? 'on' : 'zoom');

type Curve = [number, number, number, number];
const EASE_OUT: Curve = [0.2, 0, 0, 1];
const EASE_IN_OUT: Curve = [0.5, 0, 0.2, 1];
const LINEAR: Curve = [0, 0, 1, 1];

/** A hard-stepped fade, like an NES palette fade: 1/3, 2/3, then all the way. */
const stepped = (t: number) => (t <= 0 ? 0 : Math.min(1, Math.ceil(t * 3 - 1e-6) / 3));

export type StepEnv = {
  from: HTMLElement;
  to: HTMLElement;
  /** The overlay used for the color flash of a dive. */
  flash: HTMLElement;
  /** Device pixels per scene pixel, read when needed (the window may be resized mid-move). */
  d: () => number;
  /** The band above the dialog (see restCamera) that `step.from` rested in and that `step.to` will rest in. */
  band: { from: number; to: number };
  /** Called at the moment the destination scene becomes the one on screen. */
  onSwap: (scene: SceneId) => void;
  /** True when `step.to` is where the URL points, so the stage comes to rest after this move. Asked when the move ends. */
  last: () => boolean;
};

export type Run = {
  /** Resolves true when the move finished, false when it was cancelled. */
  done: Promise<boolean>;
  cancel: () => void;
};

/**
 * Puts a scene element in its resting state for a view. `staying` is false when another move
 * follows at once: the labels then stay away instead of flickering in between the two.
 */
export function settle(element: HTMLElement, view: Place, d: number, band: number, staying = true): void {
  element.style.transform = cameraCss(restCamera(view, d, band));
  element.style.opacity = '';
  element.style.visibility = '';
  element.dataset.ui = staying ? restUi(view) : 'off';
}


export function runStep(step: Step, env: StepEnv): Run {
  let cancelled = false;
  const stops = new Set<() => void>();

  const tween = (ms: number, ease: Curve, update: (t: number) => void) =>
    new Promise<void>((resolve) => {
      if (cancelled) return resolve();
      update(0);
      let stop = () => resolve();
      const controls = animate(0, 1, {
        duration: ms / 1000,
        ease,
        onUpdate: (t) => {
          if (!cancelled) update(t);
        },
        onComplete: () => {
          stops.delete(stop);
          resolve();
        },
      });
      stop = () => {
        controls.stop();
        resolve();
      };
      stops.add(stop);
    });

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        stops.delete(stop);
        resolve();
      }, ms);
      const stop = () => {
        window.clearTimeout(timer);
        resolve();
      };
      stops.add(stop);
    });

  const { from, to, flash } = env;
  const sameElement = from === to;
  /** The destination's picture, ground and character are decoded: it can be painted whole. */
  const ready = () => sceneReady(to, step.to.scene);
  const camera = (element: HTMLElement, c: Camera) => {
    element.style.transform = cameraCss(c);
  };
  const show = (element: HTMLElement, opacity: number) => {
    element.style.opacity = opacity >= 1 ? '' : String(opacity);
    element.style.visibility = opacity <= 0 ? 'hidden' : '';
  };
  const flashTo = (opacity: number) => {
    flash.style.opacity = String(opacity);
  };
  /**
   * Brings the destination's labels back, then waits for them before the stage reports idle. Not
   * when another move follows, and no wait behind a dialog: those labels cut in (SceneView draws
   * them once the move is over).
   */
  const labelsBack = async () => {
    if (!env.last()) return;
    to.dataset.ui = restUi(step.to);
    if (step.to.item === null) await wait(LABELS_IN);
  };

  // Labels and the pointer leave as the camera starts, whichever move this is.
  from.dataset.ui = 'off';
  to.dataset.ui = 'off';

  const moves: Record<StepKind, () => Promise<void>> = {
    // Same scene: ease toward the opened object, or back out.
    camera: async () => {
      const a = restCamera(step.from, env.d(), env.band.from);
      const b = restCamera(step.to, env.d(), env.band.to);
      await tween(ITEM, EASE_OUT, (t) => camera(to, mixCamera(a, b, t)));
      if (cancelled) return;
      await labelsBack();
    },

    // Opacity only. The destination fades in on top of the old scene, already in its final place.
    fade: async () => {
      show(to, 0);
      camera(to, restCamera(step.to, env.d(), env.band.to));
      to.dataset.ui = restUi(step.to);
      await ready();
      if (cancelled) return;
      env.onSwap(step.to.scene);
      await tween(FADE, LINEAR, (t) => show(to, t));
    },

    // Title to overworld: the small island grows 4x, sea and all, until it fills the stage. It is
    // then exactly the map's own picture, and the map fades in over it.
    'title-in': async () => {
      const zoomed = titleCamera();
      show(to, 0);
      // The zoom starts at once; the map is only needed when it ends, and the zoomed title waits for it.
      const decoded = ready();
      await tween(TITLE_ZOOM, EASE_IN_OUT, (t) => camera(from, mixCamera(HOME, zoomed, t)));
      await decoded;
      if (cancelled) return;
      env.onSwap(step.to.scene);
      await tween(TITLE_SWAP, LINEAR, (t) => show(to, t));
      if (cancelled) return;
      // The map and its sea now cover the whole view: the title screen under them can go.
      show(from, 0);
      await labelsBack();
    },

    // Overworld back to the title: the zoomed title screen fades in over the map, then shrinks to the small island.
    'title-out': async () => {
      const zoomed = titleCamera();
      show(to, 0);
      camera(to, zoomed);
      await ready();
      if (cancelled) return;
      env.onSwap(step.to.scene);
      await tween(TITLE_SWAP, LINEAR, (t) => show(to, t));
      if (cancelled) return;
      show(from, 0);
      await tween(TITLE_ZOOM, EASE_IN_OUT, (t) => camera(to, mixCamera(zoomed, HOME, t)));
      if (cancelled) return;
      await labelsBack();
    },

    // Overworld into a room: zoom at the building until its pixels are chunky, flash its color, reveal.
    'dive-in': async () => {
      const region = isRoom(step.to.scene) ? worldRegionOf(step.to.scene) : undefined;
      const zoomed = region ? diveCamera(region.box) : HOME;
      flash.style.backgroundColor = scenes[step.to.scene].flash;
      show(to, 0);
      // The camera moves at once. If the room's art is still on its way when the dive ends, the
      // flash color holds until it can be painted whole.
      const decoded = ready();
      const flashFrom = 1 - FLASH_IN / DIVE;
      await tween(DIVE, LINEAR, (t) => {
        camera(from, mixCamera(HOME, zoomed, easeIn(t)));
        flashTo(t <= flashFrom ? 0 : stepped((t - flashFrom) / (1 - flashFrom)));
      });
      if (cancelled) return;
      flashTo(1);
      await decoded;
      if (cancelled) return;
      show(to, 1);
      show(from, 0);
      env.onSwap(step.to.scene);
      await tween(FLASH_OUT, LINEAR, (t) => flashTo(1 - stepped(t)));
      if (cancelled) return;
      flashTo(0);
      await labelsBack();
    },

    // A room back to the overworld: flash, then pull back from the building.
    'dive-out': async () => {
      const region = isRoom(step.from.scene) ? worldRegionOf(step.from.scene) : undefined;
      const zoomed = region ? diveCamera(region.box) : HOME;
      flash.style.backgroundColor = scenes[step.from.scene].flash;
      show(to, 0);
      camera(to, zoomed);
      await ready();
      if (cancelled) return;
      await tween(FLASH_IN, LINEAR, (t) => flashTo(stepped(t)));
      if (cancelled) return;
      flashTo(1);
      show(to, 1);
      show(from, 0);
      env.onSwap(step.to.scene);
      const flashUntil = FLASH_OUT / DIVE_OUT;
      await tween(DIVE_OUT, EASE_OUT, (t) => {
        camera(to, mixCamera(zoomed, HOME, t));
        flashTo(t >= flashUntil ? 0 : 1 - stepped(t / flashUntil));
      });
      if (cancelled) return;
      flashTo(0);
      await labelsBack();
    },
  };

  const done = moves[step.kind]().then(() => {
    if (cancelled) return false;
    // Leave the destination exactly at rest; the caller unmounts the old scene.
    settle(to, step.to, env.d(), env.band.to, env.last());
    if (!sameElement) show(from, 0);
    flash.style.opacity = '0';
    return true;
  });

  return {
    done,
    cancel: () => {
      cancelled = true;
      for (const stop of [...stops]) stop();
      stops.clear();
      flash.style.opacity = '0';
    },
  };
}

/** Ease-in for the dive. A plain power, so the color flash can be timed against the same clock. */
function easeIn(t: number): number {
  return Math.pow(t, 1.8);
}
