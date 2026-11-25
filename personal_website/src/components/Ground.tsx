import type { CSSProperties } from 'react';
import { grounds } from '@/world/assets';
import type { GroundId } from '@/world/types';

type GroundProps = {
  ground: GroundId;
  className?: string;
  style?: CSSProperties;
};

/**
 * A ground from art/approved/hd/backdrops.json, tiled across the whole of its box: the sea or the
 * grass. Whoever uses it says how long one scene unit is there (--ground-unit) and may say where
 * the tile's corner goes (--ground-x, --ground-y); the look and the sea's idle motion are
 * `.ground` in src/index.css. A ground with two frames moves, one with a single frame is still.
 */
export function Ground({ ground, className, style }: GroundProps) {
  const { color, tile, frames } = grounds[ground];
  const moving = frames.length > 1;
  const vars = {
    '--tile-color': color,
    '--tile-w': tile[0],
    '--tile-h': tile[1],
    '--tile-a': `url("${frames[0]}")`,
    '--tile-b': moving ? `url("${frames[1]}")` : undefined,
    ...style,
  } as CSSProperties;
  const classes = ['ground', moving ? 'ground--moving' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={classes} data-ground={ground} style={vars} aria-hidden="true">
      <div className="ground__tiles">{moving && <div className="ground__frame" />}</div>
    </div>
  );
}
