import type { CSSProperties, FocusEvent } from 'react';
import { PixelArrow } from '@/components/PixelArrow';
import type { Rect } from '@/world/labels';
import type { Hotspot as HotspotDef } from '@/world/types';

type HotspotProps = {
  hotspot: HotspotDef;
  /** Box on the stage in CSS px (already grown to the minimum target size). */
  rect: Rect;
  /** The region itself, where `rect` had to be grown past it. */
  core?: Rect;
  /** Where the hotspot's name is on the stage while it shows: its chip and the cell of its ▶. */
  areas?: Rect[];
  onActivate: (hotspot: HotspotDef) => void;
  /** The mouse or a finger is over this hotspot, or has left it. */
  onPoint: (id: string, over: boolean) => void;
  /** Focus came or went. `byKey`: it came by the keyboard (the browser shows its focus ring), not by a click or a tap. */
  onFocusChange: (id: string, focused: boolean, byKey: boolean) => void;
};

/** A rectangle given on the stage, as a position inside the hotspot's own box. */
const within = (area: Rect, rect: Rect): CSSProperties => ({ left: area.left - rect.left, top: area.top - rect.top, width: area.width, height: area.height });

/**
 * One real button or link over a region of the art. It has no look of its own: the art is the look.
 * Its name, drawn in the label layer, is part of it: pointing at or clicking the name (or the ▶
 * beside it) does what the object does.
 */
export function Hotspot({ hotspot, rect, core, areas, onActivate, onPoint, onFocusChange }: HotspotProps) {
  const over = () => onPoint(hotspot.id, true);
  const focus = (event: FocusEvent<HTMLElement>) => onFocusChange(hotspot.id, true, event.currentTarget.matches(':focus-visible'));
  const shared = {
    'data-hotspot': hotspot.id,
    className: 'hotspot',
    style: rect as CSSProperties,
    'aria-label': hotspot.name,
    onPointerEnter: over,
    // A mouse that moves again takes the pointer back from the keyboard (see SceneView).
    onPointerMove: over,
    onPointerLeave: () => onPoint(hotspot.id, false),
    onFocus: focus,
    onBlur: () => onFocusChange(hotspot.id, false, false),
  };

  const parts = (
    <>
      {core && <span className="hotspot__core" style={within(core, rect)} />}
      {areas?.map((area, index) => (
        <span key={index} className="hotspot__name" style={within(area, rect)} />
      ))}
    </>
  );

  if (hotspot.kind === 'link') {
    return (
      <a {...shared} href={hotspot.href} target={hotspot.external ? '_blank' : undefined} rel={hotspot.external ? 'noopener noreferrer' : undefined}>
        {parts}
      </a>
    );
  }
  return (
    <button {...shared} type="button" onClick={() => onActivate(hotspot)}>
      {parts}
    </button>
  );
}

type PointerProps = {
  /** Top left corner on the stage, CSS px. */
  left: number;
  top: number;
  /** Font size of the label it points at; the arrow is drawn in that label's font pixels. */
  fontSize: number;
};

/** The blinking ▶ beside the hovered or focused hotspot's label. There is only ever one. */
export function Pointer({ left, top, fontSize }: PointerProps) {
  return (
    <span data-pointer="" className="pointer" style={{ left, top, fontSize }}>
      <PixelArrow outlined />
    </span>
  );
}
