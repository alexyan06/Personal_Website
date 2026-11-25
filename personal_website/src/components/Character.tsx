import { useMemo, type CSSProperties } from 'react';
import { restingFrame, spriteCss, type Pose } from '@/world/character';
import type { Sprite } from '@/world/types';

type CharacterProps = {
  /** Id of the hotspot he stands for (`data-character`). */
  hotspot: string;
  sprite: Sprite;
  /** `wave` while he is pointed at, has keyboard focus, or his dialog is open; otherwise `idle`. */
  pose: Pose;
};

const u = (units: number) => `calc(${units} * var(--u))`;

/**
 * Someone standing in a scene, drawn from a sprite sheet: a window one frame large, with the whole
 * row of frames sliding behind it in steps. Part of the art layer, so the camera zooms it with the
 * room. It is only a picture: the hotspot over it carries the name and the click.
 *
 * Size, place, frames and speed all come from the sheet's JSON (src/world/assets.ts). The
 * animations are plain CSS written from it (src/world/character.ts): they cost nothing while they
 * run, and stop under reduced motion.
 */
export function Character({ hotspot, sprite, pose }: CharacterProps) {
  const css = useMemo(() => spriteCss('mascot', sprite), [sprite]);
  const [width, height] = sprite.size;
  const [x, y] = sprite.anchor; // the bottom center of a frame
  const box: CSSProperties = { left: u(x - width / 2), top: u(y - height), width: u(width), height: u(height) };
  const sheet: CSSProperties = { width: `${sprite.count * 100}%`, transform: restingFrame(sprite) };
  return (
    <div className="character" data-sprite="mascot" data-character={hotspot} data-pose={pose} style={box} aria-hidden="true">
      <style>{css}</style>
      <img className="character__sheet" src={sprite.image} alt="" draggable={false} style={sheet} />
    </div>
  );
}
