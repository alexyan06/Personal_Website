// Marks in the body text (VT323) that are drawn as pixels instead of being set as type. They are
// sized in --dot (.pixel-glyph and .pixel-new-tab in src/index.css), so they sit on the type's grid.
import type { ReactNode } from 'react';

/**
 * Characters in the content that the body face has no glyph for, drawn in its pixels instead of
 * being left to a fallback font: 5 x 5 of them, the size of a lowercase letter.
 */
const PIXEL_GLYPHS: Record<string, string> = {
  '→': 'M2 0h1v1h-1zM3 1h1v1h-1zM0 2h5v1h-5zM3 3h1v1h-1zM2 4h1v1h-1z',
};
const PIXEL_GLYPH = new RegExp(`([${Object.keys(PIXEL_GLYPHS).join('')}])`);

/** Body text with those characters swapped for their drawings. The character stays in the page for screen readers and for copying. */
export function BodyText({ children }: { children: string }): ReactNode {
  if (!PIXEL_GLYPH.test(children)) return children;
  return children.split(PIXEL_GLYPH).map((part, index) =>
    part in PIXEL_GLYPHS ? (
      <span key={index} className="pixel-glyph">
        <svg viewBox="0 0 5 5" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
          <path d={PIXEL_GLYPHS[part]} />
        </svg>
        <span className="sr-only">{part}</span>
      </span>
    ) : (
      part
    ),
  );
}

/** Marks a link that opens a new tab: an arrow up and to the right, 5 x 5 pixels of the body face. */
export function NewTabIcon() {
  return (
    <svg className="pixel-new-tab" viewBox="0 0 5 5" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path d="M1 0h4v4h-1v-3h-3zM3 1h1v1h-1zM2 2h1v1h-1zM1 3h1v1h-1zM0 4h1v1h-1z" />
    </svg>
  );
}
