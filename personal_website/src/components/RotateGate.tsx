import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { NewTabIcon } from '@/components/BodyText';
import { Ground } from '@/components/Ground';
import { PixelArrow } from '@/components/PixelArrow';
import { profile } from '@/constants';
import { grounds, images } from '@/world/assets';
import { formatRoute } from '@/world/routes';
import type { Route } from '@/world/types';
import { useRotateGate, type Gate as GateKind } from '@/world/useRotateGate';
import '@/styles/gate.css';

const LIST = formatRoute({ view: 'list' });

// ---- the phone sprite ------------------------------------------------------------------------
//
// A 12 x 20 pixel phone on a 32 x 32 grid, drawn four times: upright, turned 30 and 60 degrees, and
// on its side. Each frame is sampled at pixel centers from the same few rectangles, the way a sprite
// is turned by nearest neighbor, so the tilted frames have honest stair-steps and no smoothing.

const GRID = 32;
const TURNS = [0, 30, 60, 90];
const INKS = ['body', 'screen', 'isle', 'key'] as const;
type Ink = (typeof INKS)[number];

/** What the upright phone is made of at (u, v), measured from its middle in pixels. */
function phoneAt(u: number, v: number): Ink | null {
  const au = Math.abs(u);
  const av = Math.abs(v);
  if (au > 6 || av > 10 || (au > 5 && av > 9)) return null; // outside; the corner pixels are left out
  if (au < 4 && v > -7 && v < 6) {
    // The screen: sea, with a small green island in the middle.
    const x = u / 2.4;
    const y = (v + 0.5) / 1.7;
    return x * x + y * y < 1 ? 'isle' : 'screen';
  }
  if (au < 1 && v > 7 && v < 9) return 'key';
  return 'body';
}

/** One SVG path per row of pixels, runs joined: `M x y h w v1 h-w z`. */
function toPath(rows: boolean[][]): string {
  let d = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let w = 1;
      while (row[x + w]) w++;
      d += `M${x} ${y}h${w}v1h-${w}z`;
      x += w;
    }
  });
  return d;
}

const grid = (fill: (x: number, y: number) => boolean): boolean[][] =>
  Array.from({ length: GRID }, (_, row) => Array.from({ length: GRID }, (_, col) => fill(col + 0.5 - GRID / 2, row + 0.5 - GRID / 2)));

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** The phone turned clockwise by `degrees`, as one path per color. */
function phoneFrame(degrees: number): Record<Ink, string> {
  const cos = Math.cos(radians(degrees));
  const sin = Math.sin(radians(degrees));
  const paths = {} as Record<Ink, string>;
  for (const ink of INKS) paths[ink] = toPath(grid((x, y) => phoneAt(x * cos + y * sin, -x * sin + y * cos) === ink));
  return paths;
}

/** Two arcs with arrowheads around the phone, turning clockwise: the "rotate" sign. */
function turnArrows(): string {
  const RADIUS = 15; // clear of the phone's corners in every frame
  const FROM = -78;
  const TO = -40;
  const HEAD_LENGTH = 3.4;
  const HEAD_HALF_WIDTH = 2.4;
  const baseX = RADIUS * Math.cos(radians(TO));
  const baseY = RADIUS * Math.sin(radians(TO));
  const alongX = -Math.sin(radians(TO)); // clockwise along the circle
  const alongY = Math.cos(radians(TO));
  const inArrow = (x: number, y: number) => {
    const angle = (Math.atan2(y, x) * 180) / Math.PI;
    if (Math.abs(Math.hypot(x, y) - RADIUS) < 0.8 && angle >= FROM && angle <= TO) return true;
    const along = (x - baseX) * alongX + (y - baseY) * alongY;
    const across = (x - baseX) * -alongY + (y - baseY) * alongX;
    return along >= -0.5 && along <= HEAD_LENGTH && Math.abs(across) <= HEAD_HALF_WIDTH * (1 - along / HEAD_LENGTH) + 0.35;
  };
  // The second arrow is the first one turned half way round.
  return toPath(grid((x, y) => inArrow(x, y) || inArrow(-x, -y)));
}

const FRAMES = TURNS.map(phoneFrame);
const ARROWS = turnArrows();

/** The sea and the land on the little phone's screen: the world's own ground colors (gate.css). */
const SCREEN_INKS = { '--gate-sea': grounds.ocean.color, '--gate-land': grounds.grass.color } as CSSProperties;

/** The frames sit side by side on a reel; gate.css steps the reel past the window. */
function PhoneSprite() {
  return (
    <svg className="gate__phone" viewBox={`0 0 ${GRID} ${GRID}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path className="gate__ink-turn" d={ARROWS} />
      <g className="gate__reel">
        {FRAMES.map((frame, index) => (
          <g key={TURNS[index]} transform={`translate(${index * GRID} 0)`}>
            {INKS.map((ink) => (
              <path key={ink} className={`gate__ink-${ink}`} d={frame[ink]} />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}

// ---- the screen ------------------------------------------------------------------------------

/**
 * Focuses what `pick` finds once the world can take focus again. The app lifts `inert` from the
 * world in a render of its own, which may come just after this screen has gone, so wait for it.
 */
function focusWhenReachable(pick: () => HTMLElement | null) {
  let tries = 5;
  const attempt = () => {
    const target = pick();
    if (!target) return;
    if (target.closest('[inert]')) {
      if (tries-- > 0) window.requestAnimationFrame(attempt);
      return;
    }
    // Something else has taken focus in the meantime (the list view's heading): leave it there.
    if (document.activeElement && document.activeElement !== document.body) return;
    target.focus({ preventScroll: true });
  };
  window.setTimeout(attempt, 0);
}

function Gate({ kind }: { kind: GateKind }) {
  const root = useRef<HTMLDivElement>(null);
  const cameFrom = useRef<HTMLElement | null>(null);

  // Focus moves onto the screen when it comes up, so it is announced. Remember where it was.
  useLayoutEffect(() => {
    const gate = root.current;
    if (!gate) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !gate.contains(active)) cameFrom.current = active;
    gate.focus({ preventScroll: true });
  }, []);

  // When it goes (the device was turned), focus returns to where it was in the world: the same
  // control if it is still there, else the open dialog or the scene's heading. After a move to the
  // list view none of those exist and the app focuses the list's own heading.
  useEffect(
    () => () => {
      const before = cameFrom.current;
      focusWhenReachable(() => (before?.isConnected ? before : document.querySelector<HTMLElement>('[data-dialog], [data-scene-heading]')));
    },
    [],
  );

  return (
    <div ref={root} className="gate" data-rotate-gate={kind} role="dialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-text" tabIndex={-1} style={SCREEN_INKS}>
      <div className="gate__scene">
        {/* The title screen again: the sea, moving as it does there, and the island small on it. */}
        <Ground ground="ocean" className="gate__sea" />
        <img className="gate__isle" src={images.world} alt="" draggable={false} />
        <div className="gate__box">
          <span className="pixel-frame" aria-hidden="true" />
          {/* Whose site this is, and the resume, without turning anything: the status bar is under this screen. */}
          <h1 className="gate__name">{profile.name}</h1>
          <p className="gate__role">{profile.role}</p>
          {kind === 'rotate' && <PhoneSprite />}
          <h2 id="gate-title" className="gate__title">
            {kind === 'rotate' ? 'Rotate your device' : 'Make this window larger'}
          </h2>
          <p id="gate-text" className="gate__text">
            This world is drawn for a wide screen.
          </p>
          <a className="gate__link pixel-box" href={LIST}>
            <PixelArrow />
            View as a list
          </a>
          <a className="gate__link gate__link--quiet pixel-box" href={profile.links.resume} target="_blank" rel="noopener noreferrer" aria-label="Resume (opens in a new tab)">
            Resume
            <NewTabIcon />
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * The screen that stands in for the world where it cannot be shown: "Rotate your device" on a phone
 * held upright, "Make this window larger" in a small window with a mouse. On every route but the
 * list view. `useRotateGate` decides when; the app makes the world behind it inert from the same answer.
 */
export function RotateGate({ route }: { route: Route }) {
  const kind = useRotateGate(route);
  return kind ? <Gate key={kind} kind={kind} /> : null;
}
