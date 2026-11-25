import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { SceneView } from '@/components/SceneView';
import { Stage } from '@/components/Stage';
import { SCENE_WIDTH, grounds } from '@/world/assets';
import { DIALOG_TOP, MIN_BAND } from '@/world/camera';
import { focusAfterInput } from '@/world/input';
import { loadFonts, preloadScenes, sceneReady } from '@/world/preload';
import { parentRoute } from '@/world/routes';
import { ROOM_ORDER, findDialog, scenes } from '@/world/scenes';
import { planStep, restUi, runStep, samePlace, settle, type Place, type Step, type View } from '@/world/transitions';
import type { Hotspot, Route, SceneDef, SceneId } from '@/world/types';
import { usePrefersReducedMotion } from '@/world/useMediaQuery';
import { navigate, readRoute } from '@/world/useRoute';
import { useStageScale } from '@/world/useStageScale';
import { startMusic } from '@/world/music';

/** Every route but the list view, which is a page of its own. */
export type WorldRoute = Exclude<Route, { view: 'list' }>;

type State = {
  /** What the stage shows at rest (or the scene a move is leaving). */
  view: View;
  /** The camera move in progress. */
  step: Step | null;
  /** The first scene's art is decoded and the fonts are in. */
  ready: boolean;
  /** The scene the stage came from, once it has moved: an arrow key on the overworld starts from the room just left. */
  came: SceneId | null;
};

function placeOf(route: WorldRoute): Place {
  if (route.view === 'room') return { scene: route.room, item: route.item ?? null };
  return { scene: route.view === 'title' ? 'title' : 'world', item: null };
}

const selectorFor = (hotspotId: string) => `[data-hotspot="${CSS.escape(hotspotId)}"]`;

const goUp = () => {
  const parent = parentRoute(readRoute());
  if (parent) navigate(parent);
};

/** The scenes one step away from a scene. Their art is fetched first. */
function neighbours(scene: SceneId): SceneId[] {
  return scene === 'world' ? ROOM_ORDER : ['world'];
}

/**
 * How many scene pixels of the stage the open dialog leaves free above it. The camera frames an
 * opened object in that band, so a short dialog shows more of the room than a tall one. Never
 * less than MIN_BAND: on a small stage a long dialog covers nearly everything (dialogTop in
 * src/world/camera.ts), and the object then sits partly behind it.
 */
function freeBand(layer: HTMLElement | null): number {
  const dialog = layer?.firstElementChild;
  if (!layer || !dialog) return DIALOG_TOP;
  const stage = layer.getBoundingClientRect(); // the layer covers the stage
  if (stage.width <= 0) return DIALOG_TOP;
  const top = dialog.getBoundingClientRect().top - stage.top;
  return Math.max(MIN_BAND, (top * SCENE_WIDTH) / stage.width);
}

/**
 * Which scene is on the stage and how the camera gets from one to the next.
 * The URL is the target; the stage walks toward it one move at a time, and a route change that
 * arrives during a move is picked up when the move ends, so the stage always ends on the URL.
 */
export function World({ route }: { route: WorldRoute }) {
  const target = placeOf(route);
  const reducedMotion = usePrefersReducedMotion();
  const scale = useStageScale();
  const d = scale.metrics.d;

  const [state, setState] = useState<State>(() => ({ view: { uid: 1, ...target }, step: null, ready: false, came: null }));
  /** The step whose destination scene has taken over the screen (the backdrop follows it). */
  const [swapped, setSwapped] = useState<Step | null>(null);

  // The stage is free and is not where the URL points: latch the next move. While the first
  // scene is still loading there is nothing to animate from, so the view simply follows the URL.
  if (!state.step && !samePlace(state.view, target)) {
    if (state.ready) setState({ ...state, step: planStep(state.view, target, reducedMotion) });
    else setState({ ...state, view: { uid: state.view.uid + 1, ...target } });
  }

  const { view, step, ready, came } = state;
  const elements = useRef(new Map<number, HTMLElement>());
  const flashRef = useRef<HTMLDivElement>(null);
  const dialogLayer = useRef<HTMLDivElement>(null);
  const dRef = useRef(d);
  const busy = useRef(false);
  /** The band above the dialog (see freeBand) that the scene on the stage was last framed in. */
  const band = useRef(DIALOG_TOP);
  /** The hotspot that opened the current dialog, so focus can go back to exactly it. */
  const opener = useRef<{ dialog: string; hotspot: string } | null>(null);
  /** A hotspot that should have focus once the stage is at rest. */
  const focusOwed = useRef<string | null>(null);

  const register = useCallback((uid: number, element: HTMLElement | null) => {
    if (element) elements.current.set(uid, element);
    else elements.current.delete(uid);
  }, []);

  const running = step !== null || (ready && !samePlace(view, target));
  const transition = !ready ? 'loading' : running ? 'running' : 'idle';

  useLayoutEffect(() => {
    dRef.current = d;
    busy.current = running;
  }, [d, running]);

  // ---- the first scene: idle only once it can be painted as it will stay ----------------------

  useEffect(() => {
    if (ready) return;
    let alive = true;
    const art = sceneReady(elements.current.get(view.uid), view.scene);
    // The rest of the art is fetched as soon as this scene's own is in, the scenes one step away
    // first. It does not wait for the fonts.
    void art.then(() => {
      if (alive) preloadScenes(neighbours(view.scene));
    });
    void Promise.all([art, loadFonts()]).then(() => {
      if (alive) setState((now) => (now.ready ? now : { ...now, ready: true }));
    });
    return () => {
      alive = false;
    };
  }, [ready, view.uid, view.scene]);

  // ---- the camera -----------------------------------------------------------------------------

  // Runs the latched move on the scene elements, then makes its destination the view.
  useLayoutEffect(() => {
    if (!step) return;
    const from = elements.current.get(step.from.uid);
    const to = elements.current.get(step.to.uid);
    const flash = flashRef.current;
    const finish = () =>
      setState((now) => (now.step === step ? { ...now, view: step.to, step: null, came: step.from.scene === step.to.scene ? now.came : step.from.scene } : now));
    if (!from || !to || !flash) {
      finish();
      return;
    }
    // The destination's dialog, if it has one, is already in the page: frame against its height.
    const framed = { from: band.current, to: freeBand(dialogLayer.current) };
    band.current = framed.to;
    // The URL may have moved on while this step ran: then another follows, and labels stay away.
    const last = () => {
      const now = readRoute();
      return now.view !== 'list' && samePlace(step.to, placeOf(now));
    };
    const run = runStep(step, { from, to, flash, d: () => dRef.current, band: framed, onSwap: () => setSwapped(step), last });
    void run.done.then((completed) => {
      if (completed) finish();
    });
    return run.cancel;
  }, [step]);

  // At rest: the scene sits where its view says, at the current scale and above the dialog as it is
  // now. `ready` is here because the dialog is laid out again when the fonts arrive.
  const rest = useCallback(() => {
    const element = elements.current.get(view.uid);
    if (!element) return;
    band.current = freeBand(dialogLayer.current);
    settle(element, view, d, band.current);
  }, [view, d]);

  useLayoutEffect(() => {
    if (!step) rest();
  }, [step, rest, ready]);

  // ---- dialog ---------------------------------------------------------------------------------

  // The dialog belongs to the destination: it opens as the camera starts toward the object and
  // closes as the camera starts back.
  const dialogPlace = step ? step.to : view;
  const dialogScene = dialogPlace.scene;
  const dialogHotspot = dialogPlace.item !== null && dialogScene !== 'title' && dialogScene !== 'world' ? findDialog(dialogScene, dialogPlace.item) : undefined;
  const dialogKey = dialogHotspot ? `${dialogScene}/${dialogHotspot.id}` : null;

  // Should the dialog change height under a resting camera, the object is framed again. Not while
  // the first view is still loading: it is framed once more when the fonts are in (see above), so
  // a page that opens on an item moves at most once.
  const atRest = ready && !running;
  useEffect(() => {
    const dialog = dialogLayer.current?.firstElementChild;
    if (!dialog || !atRest) return;
    const observer = new ResizeObserver(rest);
    observer.observe(dialog);
    return () => observer.disconnect();
  }, [dialogKey, atRest, rest]);

  // ---- focus ----------------------------------------------------------------------------------

  // The ring shows when the dialog was closed with a key (Escape, Enter on BACK), not after a click.
  const focusHotspot = useCallback((uid: number, hotspotId: string) => {
    const hotspot = elements.current.get(uid)?.querySelector<HTMLElement>(selectorFor(hotspotId));
    if (hotspot && document.activeElement !== hotspot) focusAfterInput(hotspot);
  }, []);

  // A dialog closed and we are staying in its room: focus returns to the hotspot that opened it.
  const lastDialog = useRef(dialogKey);
  useEffect(() => {
    const closed = lastDialog.current;
    lastDialog.current = dialogKey;
    if (closed === null || dialogKey !== null) return;
    const [scene, id] = closed.split('/');
    if (scene !== dialogScene) return;
    const hotspotId = opener.current?.dialog === closed ? opener.current.hotspot : id;
    opener.current = null;
    focusOwed.current = hotspotId;
    focusHotspot(view.uid, hotspotId);
  }, [dialogKey, dialogScene, focusHotspot, view.uid]);

  // The stage has come to rest on a new scene element: focus moves to its heading, which announces
  // the scene's name. Not on the first load (the skip link must stay the first Tab stop), not under
  // an open dialog (it has the focus), and not when a hotspot is owed the focus instead.
  const rested = useRef({ uid: view.uid, scene: view.scene });
  useEffect(() => {
    if (step) return;
    const before = rested.current;
    rested.current = { uid: view.uid, scene: view.scene };
    if (before.scene !== view.scene) focusOwed.current = null;
    if (dialogKey !== null) return;
    if (focusOwed.current !== null) {
      // The scene element may have been replaced since the dialog closed (a cross-fade): focus again.
      focusHotspot(view.uid, focusOwed.current);
      focusOwed.current = null;
    } else if (ready && before.uid !== view.uid) {
      elements.current.get(view.uid)?.querySelector<HTMLElement>('[data-scene-heading]')?.focus({ preventScroll: true });
    }
  }, [step, view, ready, dialogKey, focusHotspot]);

  // ---- input ----------------------------------------------------------------------------------

  // PRESS START. Like the hotspots, it ignores input while the camera moves (the zoom back out to
  // the title screen); while the first scene is still loading it works.
  const start = useCallback(() => {
    if (busy.current) return;
    startMusic(); // from inside the click or key press, which is when browsers allow sound to begin
    navigate({ view: 'world' });
  }, []);

  const onActivate = useCallback((scene: SceneDef, hotspot: Hotspot) => {
    if (busy.current) return; // hotspots ignore input while the camera moves
    if (hotspot.kind === 'scene') {
      navigate(hotspot.to);
    } else if (scene.id !== 'title' && scene.id !== 'world' && (hotspot.kind === 'dialog' || hotspot.kind === 'item')) {
      const item = hotspot.kind === 'item' ? hotspot.parent : hotspot.id;
      opener.current = { dialog: `${scene.id}/${item}`, hotspot: hotspot.id };
      navigate({ view: 'room', room: scene.id, item });
    }
  }, []);

  // ---- render ---------------------------------------------------------------------------------

  const layers = step && step.to.uid !== view.uid ? [view, step.to] : [view];
  const backdropScene = step ? (swapped === step ? step.to.scene : step.from.scene) : view.scene;

  return (
    <Stage
      scale={scale}
      transition={transition}
      backdrop={grounds[scenes[backdropScene].ground].color}
      flashRef={flashRef}
      dialogLayerRef={dialogLayer}
      dialog={dialogHotspot ? <Dialog key={dialogKey} id={dialogHotspot.id} content={dialogHotspot.dialog} onClose={goUp} /> : null}
      onDismiss={goUp}
    >
      {layers.map((layer) => (
        <SceneView
          key={layer.uid}
          uid={layer.uid}
          scene={scenes[layer.scene]}
          ui={step ? 'off' : restUi(layer)}
          // Behind a dialog, and on its way out, a scene takes no focus.
          inert={dialogKey !== null || (layers.length > 1 && layer === view)}
          openItem={dialogHotspot && layer.uid === dialogPlace.uid ? dialogHotspot.id : null}
          entry={came ?? undefined}
          register={register}
          onActivate={onActivate}
          onStart={start}
        />
      ))}
    </Stage>
  );
}
