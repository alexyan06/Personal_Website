import { useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode, type RefObject, type SyntheticEvent } from 'react';
import { SCENE_HEIGHT, SCENE_WIDTH } from '@/world/assets';
import { dialogTop } from '@/world/camera';
import { isSecondClick, noteOpening, type Opening } from '@/world/input';
import { roomLabelPx, stageDotPx } from '@/world/pixels';
import { StageContext } from '@/world/StageContext';
import type { StageScale } from '@/world/useStageScale';
import '@/styles/world.css';

type StageProps = {
  scale: StageScale;
  /** `loading` until the first scene's art is decoded, `running` during a camera move, else `idle`. */
  transition: 'loading' | 'running' | 'idle';
  /** The base color of the scene's ground: the page background, and what shows until the ground's tile has loaded. */
  backdrop: string;
  /** The overlay a dive flashes its color on. */
  flashRef: RefObject<HTMLDivElement | null>;
  /** The stage's dialog layer; the camera reads from it how much of the stage the dialog leaves free. */
  dialogLayerRef: RefObject<HTMLDivElement | null>;
  /** The open dialog, if any. It mounts in the dialog layer. */
  dialog: ReactNode;
  /** A click outside the open dialog: on the stage around it or on the background around the stage. */
  onDismiss: () => void;
  /** The scene layers. */
  children: ReactNode;
};


/**
 * The 320x180 stage at a whole number of device pixels per scene unit, centered in what the HUD
 * leaves of the viewport. Layers, bottom to top: page background, scenes, dialog; and over the
 * stage and the view around it alike, the flash of a dive. Scenes are not clipped to the stage:
 * each one's ground covers the whole area below the HUD, and a zoomed camera fills it too (see
 * .stage and .scene__ground in world.css).
 */
export function Stage({ scale, transition, backdrop, flashRef, dialogLayerRef, dialog, onDismiss, children }: StageProps) {
  const { metrics, areaRef } = scale;
  const { k, d, dpr } = metrics;

  // The page behind the app takes the same color, so overscroll and the HUD's surroundings match.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--page-bg', backdrop);
  }, [backdrop]);

  const dot = stageDotPx(d, dpr);
  const style = {
    '--k': k,
    '--u': `${k}px`,
    // Inside the stage --px is a room label's font pixel and --dot a dialog's VT323 dot.
    '--px': `${roomLabelPx(d, dpr) / dpr}px`,
    '--dot': `${dot / dpr}px`,
    // Scene pixels at the top of the stage that the dialog layer never covers.
    '--dialog-top': dialogTop(d, dot),
    // The view below the status bar, seen from the stage: where it starts and how large it is.
    // A scene's ground covers exactly this.
    '--area-x': `${metrics.left}px`,
    '--area-y': `${metrics.top}px`,
    '--area-w': `${metrics.areaWidth}px`,
    '--area-h': `${metrics.areaHeight}px`,
    left: metrics.left,
    top: metrics.top,
    width: SCENE_WIDTH * k,
    height: SCENE_HEIGHT * k,
    backgroundColor: backdrop,
  } as CSSProperties;

  // A click outside the dialog: on the dialog layer itself (it covers the stage) or on the
  // background around the stage. Press and release both have to be outside, so a text selection
  // dragged out of the dialog does not close it. The dialog layer is under the mouse the moment an
  // object is clicked, so the second click of a double click (or a second tap) would land on it
  // and close what the first one opened: such a click is not counted (isSecondClick).
  const open = Boolean(dialog);
  const opening = useRef<Opening>(null);
  useLayoutEffect(() => {
    if (open) opening.current = noteOpening();
  }, [open]);
  const pressedOutside = useRef(false);
  const isOutside = (event: SyntheticEvent<HTMLElement>) => event.target === event.currentTarget || event.target === dialogLayerRef.current;
  const onAreaDown = (event: PointerEvent<HTMLElement>) => {
    pressedOutside.current = isOutside(event);
  };
  const onAreaClick = (event: MouseEvent<HTMLElement>) => {
    if (pressedOutside.current && isOutside(event) && !isSecondClick(event, opening.current)) onDismiss();
    pressedOutside.current = false;
  };

  return (
    <main
      ref={areaRef}
      className="stage-area"
      style={{ backgroundColor: backdrop }}
      onPointerDown={open ? onAreaDown : undefined}
      onClick={open ? onAreaClick : undefined}
    >
      <StageContext value={metrics}>
        <div className="stage" style={style} data-stage="" data-k={k} data-transition={transition}>
          <div className="stage__scenes">{children}</div>
          <div ref={dialogLayerRef} className="stage__dialog" data-open={open ? '' : undefined}>
            {dialog}
          </div>
        </div>
      </StageContext>
      <div ref={flashRef} className="stage-area__flash" />
    </main>
  );
}
