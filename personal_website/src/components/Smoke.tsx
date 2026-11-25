import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { SCENE_HEIGHT, SCENE_WIDTH } from '@/world/assets';
import { puffSize, smokeCss, smokePuffs } from '@/world/smoke';
import type { SmokeSheet } from '@/world/types';
import { usePrefersReducedMotion } from '@/world/useMediaQuery';

type SmokeProps = {
  sheet: SmokeSheet;
  /** The box of the picture the smoke belongs to, where that is not the whole of what holds this layer. */
  style?: CSSProperties;
};

const share = (part: number, whole: number) => `${Math.round((1e6 * part) / whole) / 1e4}%`;

/**
 * The smoke rising from a picture's chimneys: a few puffs over each one, drawn from one small
 * sprite sheet. Part of the art layer and only a picture (no name, no pointer). The layer lies
 * exactly over its picture, so the smoke is scaled and moved with it.
 *
 * Each puff is a window one frame large; it climbs and fades while the row of frames slides
 * behind it, so the puff changes its look as it ages. Both are plain CSS animations of transform
 * and opacity, written from src/world/smoke.ts: that file has every number to tune. Under reduced
 * motion nothing moves and the puffs stand as a still plume.
 */
export function Smoke({ sheet, style }: SmokeProps) {
  const layer = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const css = useMemo(() => smokeCss(sheet), [sheet]);
  const chimneys = useMemo(() => sheet.chimneys.map((mouth, index) => ({ mouth, puffs: smokePuffs(sheet, index) })), [sheet]);
  const [width, height] = puffSize(sheet);
  // The sheet is named once, on the layer; every puff's row of frames paints it (.smoke__sheet).
  const layerStyle = { ...style, '--smoke-sheet': `url("${sheet.image}")` } as CSSProperties;

  // All smoke on the page keeps one clock. A CSS animation starts when its element appears; here
  // each one is moved to the page's own zero instead. The title screen's smoke and the overworld's
  // are then the same picture at every moment, and nothing jumps when one scene takes over from
  // the other.
  useLayoutEffect(() => {
    const element = layer.current;
    if (!element || typeof element.getAnimations !== 'function') return;
    for (const animation of element.getAnimations({ subtree: true })) animation.startTime = 0;
  }, [css, reducedMotion]);

  return (
    <div ref={layer} className="smoke" data-smoke="" style={layerStyle} aria-hidden="true">
      <style>{css}</style>
      {chimneys.map(({ mouth: [x, y], puffs }, chimney) =>
        puffs.map(({ rest, at }, puff) => {
          // The window's middle is on the chimney's opening; the transform carries it from there.
          const box = {
            left: share(x - width / 2, SCENE_WIDTH),
            top: share(y - height / 2, SCENE_HEIGHT),
            width: share(width, SCENE_WIDTH),
            height: share(height, SCENE_HEIGHT),
            transform: rest.puff,
            opacity: rest.opacity,
            '--smoke-at': at,
          } as CSSProperties;
          const frames: CSSProperties = { width: `${sheet.count * 100}%`, transform: rest.sheet };
          return (
            <div key={`${chimney}-${puff}`} className="smoke__puff" style={box}>
              <div className="smoke__sheet" style={frames} />
            </div>
          );
        }),
      )}
    </div>
  );
}
