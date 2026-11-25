import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Character } from '@/components/Character';
import { Ground } from '@/components/Ground';
import { Hotspot, Pointer } from '@/components/Hotspot';
import { Smoke } from '@/components/Smoke';
import { TitleScreen } from '@/components/TitleScreen';
import { SCENE_HEIGHT, SCENE_WIDTH, smokeOver } from '@/world/assets';
import { groundBelow, itemDevicePx } from '@/world/camera';
import { focusByKey } from '@/world/input';
import { hotspotRect, layoutLabels, nameArea, regionRect, type LabelLayout, type Rect } from '@/world/labels';
import { useStageMetrics } from '@/world/StageContext';
import type { Box, Hotspot as HotspotDef, SceneDef } from '@/world/types';

type SceneViewProps = {
  /** Identity of this scene element; World finds it again through `register`. */
  uid: number;
  scene: SceneDef;
  /**
   * `on`: at rest. Labels show and hotspots are live.
   * `off`: the camera is moving. No labels, no pointer, and hotspots ignore the mouse.
   * `zoom`: at rest on an opened object, behind its dialog. The always-on labels show, laid out
   * for the zoomed camera; nothing is interactive.
   * src/world/transitions.ts writes the same values on the element while a move runs.
   */
  ui: 'on' | 'off' | 'zoom';
  /** Takes the scene out of the tab order and the accessibility tree. */
  inert: boolean;
  /** The hotspot whose dialog is open over this scene, or on its way open. */
  openItem?: string | null;
  /** The hotspot an arrow key lands on when nothing in the scene has focus yet. Default: the first in Tab order. */
  entry?: string;
  register: (uid: number, element: HTMLElement | null) => void;
  onActivate: (scene: SceneDef, hotspot: HotspotDef) => void;
  /** PRESS START on the title scene. */
  onStart: () => void;
};

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * The nearest hotspot from `current` in a direction, by box centers. One that lies mostly that way
 * (within 45 degrees) always beats one that is only slightly that way.
 */
function nearestHotspot(current: HTMLElement, all: HTMLElement[], [dx, dy]: [number, number]): HTMLElement | null {
  const center = (element: HTMLElement) => {
    const r = element.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const [cx, cy] = center(current);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const element of all) {
    if (element === current) continue;
    const [x, y] = center(element);
    const along = (x - cx) * dx + (y - cy) * dy;
    const across = Math.abs((x - cx) * dy) + Math.abs((y - cy) * dx);
    if (along <= 1) continue;
    const score = along + 2 * across + (across > along ? 100000 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = element;
    }
  }
  return best;
}

/**
 * The strip between a name's chip and its object's box where the two do not touch. A name that
 * shows only while its object is pointed at would vanish as the mouse crossed it on the way to the name.
 */
function bridge(chip: Rect, region: Rect): Rect | null {
  const chipBottom = chip.top + chip.height;
  const regionBottom = region.top + region.height;
  if (chipBottom < region.top) return { left: region.left, top: chipBottom, width: region.width, height: region.top - chipBottom };
  if (regionBottom < chip.top) return { left: region.left, top: regionBottom, width: region.width, height: chip.top - regionBottom };
  return null;
}

/** One name over the art. Box, type size and text offset come from src/world/labels.ts, on whole device pixels. */
function Label({ label }: { label: LabelLayout }) {
  const style = {
    left: label.left,
    top: label.top,
    width: label.width,
    height: label.height,
    fontSize: label.fontSize,
    paddingLeft: label.textLeft - label.border,
    paddingTop: label.textTop - label.border,
    '--edge': `${label.border}px`,
  } as CSSProperties;
  return (
    <span className={`label label--${label.look}`} data-label-for={label.id} style={style}>
      {label.text}
    </span>
  );
}

/** Where a picture that does not fill the scene goes (the title screen's small island), in scene units. */
const boxStyle = ([x, y, w, h]: Box): CSSProperties => ({
  left: `calc(${x} * var(--u))`,
  top: `calc(${y} * var(--u))`,
  width: `calc(${w} * var(--u))`,
  height: `calc(${h} * var(--u))`,
});

/** One scene: its ground and its picture, a hotspot per region, the labels over them and the pointer. */
export function SceneView({ uid, scene, ui, inert, openItem = null, entry, register, onActivate, onStart }: SceneViewProps) {
  const metrics = useStageMetrics();
  const headingId = useId();
  const root = useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  /** The hotspot that has focus from the keyboard: the browser shows its ring. Not one focused by a click or a tap. */
  const [keyFocused, setKeyFocused] = useState<string | null>(null);
  /** Which of the two changed last. */
  const [lead, setLead] = useState<'hover' | 'focus'>('hover');
  const [broken, setBroken] = useState(false);

  const ref = useCallback(
    (element: HTMLElement | null) => {
      root.current = element;
      register(uid, element);
    },
    [register, uid],
  );
  const onPoint = useCallback((id: string, over: boolean) => {
    if (over) setLead('hover');
    setHovered((now) => (over ? id : now === id ? null : now));
  }, []);
  const onFocusChange = useCallback((id: string, on: boolean, byKey: boolean) => {
    if (on) setLead('focus');
    setFocused((now) => (on ? id : now === id ? null : now));
    setKeyFocused((now) => (on && byKey ? id : now === id ? null : now));
  }, []);
  const activate = useCallback((hotspot: HotspotDef) => onActivate(scene, hotspot), [onActivate, scene]);

  const labels = useMemo(() => layoutLabels(scene.id, metrics), [scene.id, metrics]);
  // Behind a dialog the camera rests at a larger whole number of device pixels per scene pixel.
  // The labels are laid out for that scale, in a layer that undoes the camera's scale, so their
  // type is set at a crisp size instead of being stretched with the art.
  const zoomed = ui === 'zoom';
  const zoomD = itemDevicePx(metrics.d);
  const zoomLabels = useMemo(() => (zoomed ? layoutLabels(scene.id, { d: zoomD, dpr: metrics.dpr }) : null), [zoomed, scene.id, zoomD, metrics.dpr]);

  // The pointer marks one thing: whichever of the mouse and the keyboard moved last. A mouse left
  // resting on a hotspot does not hold it while Tab or the arrow keys move on.
  const active = lead === 'focus' ? (focused ?? hovered) : (hovered ?? focused);
  const activeLabel = active === null ? undefined : labels.find((label) => label.id === active);

  const isTitle = scene.id === 'title';
  const isRoom = !isTitle && scene.id !== 'world';

  // The ground covers the view at rest. A room's also reaches below it: the camera lifts the room
  // to frame an opened object, and the ground has to follow its bottom edge up.
  const groundStyle = useMemo(() => (isRoom ? ({ '--ground-below': `calc(${groundBelow(metrics.d)} * var(--u))` } as CSSProperties) : undefined), [isRoom, metrics.d]);

  // The character waves while he is pointed at, has keyboard focus, or his dialog is open. Focus
  // left on him by a click or a tap (it returns to him when his dialog is closed that way) does
  // not count: on a phone nothing would ever take it away again, and he would wave for good.
  const character = scene.character;
  const waving = character !== undefined && (hovered === character.hotspot || keyFocused === character.hotspot || openItem === character.hotspot);

  // Chimney smoke belongs to the picture: the island has it wherever it is shown, here and small
  // on the title screen, so the title's zoom ends on the overworld's own smoke.
  const smoke = smokeOver(scene.image);

  // Arrow keys between hotspots, from the one that has focus.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = ARROWS[event.key];
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    const current = (event.target as HTMLElement).closest<HTMLElement>('[data-hotspot]');
    if (!current) return;
    const next = nearestHotspot(current, [...event.currentTarget.querySelectorAll<HTMLElement>('[data-hotspot]')], direction);
    if (!next) return;
    event.preventDefault();
    focusByKey(next);
  };

  // An arrow key with nothing chosen yet: focus is on the page (a direct load) or on the scene's
  // heading (where it goes after every scene change). The first press puts the pointer on a
  // hotspot; from there the handler above takes over. Keys pressed anywhere else (the status bar,
  // a dialog, which scrolls with them) are left alone.
  const live = !isTitle && ui === 'on' && !inert;
  useEffect(() => {
    if (!live) return;
    const onWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!ARROWS[event.key] || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const section = root.current;
      if (!section || section.closest('[inert]') || section.dataset.ui !== 'on') return;
      const at = document.activeElement;
      const nowhere = !at || at === document.body || at === section || (at.hasAttribute('data-scene-heading') && section.contains(at));
      if (!nowhere) return;
      const all = [...section.querySelectorAll<HTMLElement>('[data-hotspot]')];
      const first = all.find((element) => element.dataset.hotspot === entry) ?? all[0];
      if (!first) return;
      event.preventDefault();
      focusByKey(first);
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [live, entry]);

  return (
    <section ref={ref} className="scene" data-scene={scene.id} data-ui={ui} aria-labelledby={isTitle ? undefined : headingId} inert={inert}>
      {!isTitle && (
        <h1 id={headingId} className="scene__heading sr-only" tabIndex={-1} data-scene-heading="">
          {scene.name}
        </h1>
      )}
      <Ground ground={scene.ground} className="scene__ground" style={groundStyle} />
      <img
        className="scene__img"
        src={scene.image}
        alt=""
        width={scene.imageBox ? scene.imageBox[2] : SCENE_WIDTH}
        height={scene.imageBox ? scene.imageBox[3] : SCENE_HEIGHT}
        style={scene.imageBox ? boxStyle(scene.imageBox) : undefined}
        draggable={false}
        // Art that fails to load leaves the ground, not the browser's broken-image mark.
        data-broken={broken ? '' : undefined}
        onError={() => setBroken(true)}
      />
      {smoke && !broken && <Smoke sheet={smoke} style={scene.imageBox ? boxStyle(scene.imageBox) : undefined} />}
      {character && <Character hotspot={character.hotspot} sprite={character.sprite} pose={waving ? 'wave' : 'idle'} />}
      {isTitle ? (
        <TitleScreen onStart={onStart} />
      ) : (
        <>
          <div className="scene__hotspots" onKeyDown={onKeyDown}>
            {scene.hotspots.map((hotspot) => {
              const rect = hotspotRect(hotspot.region.box, metrics);
              const region = regionRect(hotspot.region.box, metrics);
              const label = labels.find((candidate) => candidate.id === hotspot.id);
              let areas: Rect[] | undefined;
              if (label?.always) areas = [nameArea(label, labels)];
              else if (label && label.id === active) {
                const chip: Rect = { left: label.left, top: label.top, width: label.width, height: label.height };
                const gap = bridge(chip, region);
                areas = gap ? [chip, gap] : [chip];
              }
              return (
                <Hotspot
                  key={hotspot.id}
                  hotspot={hotspot}
                  rect={rect}
                  core={rect.width > region.width || rect.height > region.height ? region : undefined}
                  areas={areas}
                  onActivate={activate}
                  onPoint={onPoint}
                  onFocusChange={onFocusChange}
                />
              );
            })}
          </div>
          {/* Names are on the hotspots (aria-label); this layer is for the eye only. A new element
              for each layout, so one never fades into the other. */}
          {zoomLabels ? (
            <div key="zoom" className="scene__labels" data-labels="zoom" aria-hidden="true" style={{ transform: `scale(${metrics.d / zoomD})` }}>
              {zoomLabels.map((label) => label.always && <Label key={label.id} label={label} />)}
            </div>
          ) : (
            <div key="rest" className="scene__labels" data-labels="rest" aria-hidden="true">
              {labels.map((label) => (label.always || label.id === active) && <Label key={label.id} label={label} />)}
              {activeLabel && <Pointer left={activeLabel.pointerLeft} top={activeLabel.pointerTop} fontSize={activeLabel.fontSize} />}
            </div>
          )}
        </>
      )}
    </section>
  );
}
