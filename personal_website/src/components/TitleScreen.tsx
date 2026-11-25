import { useEffect, useRef } from 'react';
import { PixelArrow } from '@/components/PixelArrow';
import { profile } from '@/constants';
import { titleTextAreas } from '@/world/assets';

const START_TEXT = 'Press Start';

/** Scene pixels per font pixel of the name. */
const NAME_PX = 3;
const u = (scenePx: number) => `calc(${scenePx} * var(--u))`;

// Both texts are centered in their areas from title.json by counting pixels (Press Start 2P is
// 8 pixels per character, 7 of them ink), so they sit on the art's grid instead of between pixels.
const nameArea = titleTextAreas.title;
const nameWidth = (profile.name.length * 8 - 1) * NAME_PX + NAME_PX; // ink plus the drop shadow
const nameHeight = 7 * NAME_PX + NAME_PX;
const namePosition = {
  left: u(nameArea[0] + Math.floor((nameArea[2] - nameWidth) / 2)),
  top: u(nameArea[1] + Math.floor((nameArea[3] - nameHeight) / 2)),
};

const START_PAD = 4; // padding of .title__start, scene px
const startArea = titleTextAreas.pressStart;
const startWidth = 4 + 4 + (START_TEXT.length * 8 - 1); // arrow, gap, text
const startPosition = {
  left: u(startArea[0] + Math.floor((startArea[2] - startWidth) / 2) - START_PAD),
  top: u(startArea[1] + Math.floor((startArea[3] - 7) / 2) - START_PAD),
};

const isControl = (target: EventTarget | null) => target instanceof Element && target.closest('a, button, input, select, textarea, summary') !== null;

/**
 * The name and PRESS START over the title art. Enter, Space, or a click anywhere below the status
 * bar starts: on the stage and on the sea around it alike.
 */
export function TitleScreen({ onStart }: { onStart: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Out of reach (behind the gate screen, or the title scene on its way out): these listeners
    // are on the window, which `inert` does not cover, so they check for it themselves.
    const unreachable = () => !root.current || root.current.closest('[inert]') !== null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isControl(event.target) || unreachable()) return; // a focused link or button does its own thing
      event.preventDefault();
      onStart();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || isControl(event.target) || unreachable()) return;
      if (event.target instanceof Element && event.target.closest('.stage-area')) onStart();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', onClick);
    };
  }, [onStart]);

  return (
    <div ref={root} className="title">
      <div className="title__ui">
        <h1 className="title__name" style={namePosition} tabIndex={-1} data-scene-heading="">
          {profile.name}
        </h1>
        <button type="button" className="title__start" style={startPosition} data-press-start="" onClick={onStart}>
          <span className="title__start-text">
            <PixelArrow />
            {START_TEXT}
          </span>
        </button>
      </div>
    </div>
  );
}
