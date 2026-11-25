import type { CSSProperties } from 'react';
import { PixelArrow } from '@/components/PixelArrow';
import { profile } from '@/constants';
import { currentDpr } from '@/world/pixels';
import { crumbsFor, formatRoute } from '@/world/routes';
import { ROOM_ORDER, scenes } from '@/world/scenes';
import type { Crumb, Route } from '@/world/types';
import { useMeasured } from '@/world/useMeasured';
import '@/styles/hud.css';

type HudProps = {
  route: Route;
  /** `World › Experience › Shopify`. Every crumb but the last has an href. */
  crumbs: Crumb[];
};

const LINKS = [
  { label: 'Resume', short: 'CV', href: profile.links.resume, external: true },
  { label: 'GitHub', short: 'GH', href: profile.links.github, external: true },
  { label: 'LinkedIn', short: 'In', href: profile.links.linkedin, external: true },
  { label: 'List', short: 'List', href: formatRoute({ view: 'list' }), external: false },
];

// ---- the bar as a row of tiles ----------------------------------------------------------------
//
// Press Start 2P is 8 font pixels wide for every character, so the bar is laid out like an NES
// status line: on a grid of character cells. These four numbers are in characters; hud.css gets
// them as em lengths (1em = one character), so this is the only place they are written down.
//
//   |1|ALEX YAN|2|SWE INTERN @ SHOPIFY|3|WORLD|2|EXPERIENCE|2|SHOPIFY|  ...  |3|RESUME|2|GITHUB|...|1|
//
// The cell left of every link is where its ▶ shows; it is part of the gap before the link.

/** Either end of the bar. */
const PAD = 1;
/** Name to role. */
const ID_GAP = 2;
/** Before the breadcrumb, and the least there is before the links. */
const GROUP_GAP = 3;
/** Crumb to crumb (the chevron sits in it) and link to link. */
const STEP = 2;

/** What gives way as the bar gets narrower, in this order. */
type Fit = {
  /** The role shows. */
  role: boolean;
  /** The links are abbreviated. */
  short: boolean;
  /** How many crumbs show, counted back from the current place. */
  keep: number;
};

const FITS: Fit[] = [
  { role: true, short: false, keep: Infinity },
  { role: false, short: false, keep: Infinity },
  { role: false, short: true, keep: Infinity },
  { role: false, short: true, keep: 2 },
  { role: false, short: true, keep: 1 },
];

const cells = (text: string) => [...text].length;

const row = (labels: string[]) => labels.reduce((sum, label) => sum + cells(label), 0) + STEP * Math.max(0, labels.length - 1);

/** Characters the whole bar takes with this much showing, for the widest of these breadcrumbs. */
function columnsFor(fit: Fit, trails: string[][]): number {
  const id = cells(profile.name) + (fit.role ? ID_GAP + cells(profile.role) : 0);
  const trail = trails.length > 0 ? GROUP_GAP + Math.max(...trails.map((labels) => row(labels.slice(-fit.keep)))) : 0;
  const links = row(LINKS.map((link) => (fit.short ? link.short : link.label)));
  return PAD + id + trail + GROUP_GAP + links + PAD;
}

/**
 * Every breadcrumb the site can show, by its number of crumbs (1: overworld, 2: a room, 3: an item).
 * The bar is fitted to the widest one of the current depth, not to the current one, so it does not
 * rearrange itself from room to room or from item to item.
 */
const TRAILS: string[][][] = [];
for (const route of [
  { view: 'world' } as Route,
  ...ROOM_ORDER.flatMap((room): Route[] => [
    { view: 'room', room },
    ...scenes[room].hotspots.filter((hotspot) => hotspot.kind === 'dialog').map((hotspot): Route => ({ view: 'room', room, item: hotspot.id })),
  ]),
]) {
  const labels = crumbsFor(route).map((crumb) => crumb.label);
  (TRAILS[labels.length] ??= []).push(labels);
}

/** The overworld's bar with everything showing. The type is as large as this allows. */
const LANDING_COLUMNS = columnsFor(FITS[0], TRAILS[1] ?? []);
/** The widest item's bar with the links spelled out (the role already gone). */
const ITEM_COLUMNS = columnsFor(FITS[1], TRAILS[3] ?? []);
/** Type is taken down a size to keep the links spelled out only if it stays at least this large, CSS px. */
const WHOLE_LINKS_MIN_PX = 12;

const EPS = 1e-6;

/** The bar's width, the most height it may take (--hud-h in src/index.css) and the screen's pixel ratio. */
type Bar = { width: number; maxHeight: number; dpr: number };

/**
 * Type size, bar height and what shows, for a bar of this width.
 *
 * `n` is the device pixels per font pixel, a whole number so the type is crisp: never under 8 CSS
 * px, and otherwise the largest that is at most half of --hud-h and still fits the overworld's bar
 * in full (so the role is there on landing wherever a screen can show it at all). One exception:
 * in the narrow band of widths where that size fits the overworld's bar but not an item's with
 * the links spelled out (an 11-inch tablet on its side), the type is one size smaller, so RESUME,
 * GITHUB and LINKEDIN do not turn into CV, GH and IN on a screen that wide. Only where the smaller
 * size is still 12 CSS px or more, and for every route alike, so the bar never changes height
 * from one route to the next.
 * `rows` is the bar's height in device pixels: twice its type, 24 CSS px at least, and even, so the
 * stage below starts on a whole device pixel and the type can sit in the middle.
 * `level` indexes FITS: the role goes, the links shorten and the breadcrumb loses its first crumbs,
 * in that order, until the row fits.
 */
function layOut(bar: Bar, labels: string[]) {
  const { dpr } = bar;
  const deviceWidth = bar.width * dpr;
  const smallest = Math.max(1, Math.ceil(dpr - EPS));
  const largest = Math.max(smallest, Math.floor((bar.maxHeight * dpr) / 16 + EPS));
  let n = smallest;
  for (let candidate = largest; candidate > smallest; candidate--) {
    if (LANDING_COLUMNS * 8 * candidate <= deviceWidth + EPS) {
      n = candidate;
      break;
    }
  }
  const wholeLinksAt = (size: number) => ITEM_COLUMNS * 8 * size <= deviceWidth + EPS;
  if (n > smallest && !wholeLinksAt(n) && wholeLinksAt(n - 1) && (8 * (n - 1)) / dpr >= WHOLE_LINKS_MIN_PX - EPS) n -= 1;
  const height = Math.max(24, Math.min((16 * n) / dpr, bar.maxHeight));
  const rows = 2 * Math.ceil((height * dpr) / 2 - EPS);
  const columns = deviceWidth / (8 * n) + EPS;
  const trails = labels.length > 0 ? [...(TRAILS[labels.length] ?? []), labels] : [];
  const level = FITS.findIndex((fit) => columnsFor(fit, trails) <= columns);
  return { n, rows, level: level === -1 ? FITS.length - 1 : level };
}

const maxHeightOf = (element: Element) => parseFloat(getComputedStyle(element).getPropertyValue('--hud-h')) || 32;

/** Before the bar is in the page: it will be as wide as the window. */
const guessBar = (): Bar => ({ width: window.innerWidth, maxHeight: maxHeightOf(document.documentElement), dpr: currentDpr() });

function measureBar(element: HTMLElement): Bar | null {
  const width = element.getBoundingClientRect().width;
  if (width <= 0) return null;
  return { width, maxHeight: maxHeightOf(element), dpr: currentDpr() };
}

const sameBar = (a: Bar, b: Bar) => a.width === b.width && a.maxHeight === b.maxHeight && a.dpr === b.dpr;

/** The › between crumbs, drawn in font pixels: 5 x 7, two pixels thick like the letters' stems. */
function PixelChevron() {
  return (
    <svg className="hud__chevron" viewBox="0 0 5 7" shapeRendering="crispEdges" focusable="false">
      {[0, 1, 2, 3, 2, 1, 0].map((x, y) => (
        <rect key={y} x={x} y={y} width={2} height={1} />
      ))}
    </svg>
  );
}

/** The cell left of a crumb or link: the chevron between crumbs, and the ▶ while a link is pointed at. */
function Mark({ chevron = false, pointer = false }: { chevron?: boolean; pointer?: boolean }) {
  return (
    <span className="hud__mark" aria-hidden="true">
      {chevron && <PixelChevron />}
      {pointer && (
        <span className="hud__pointer">
          <PixelArrow />
        </span>
      )}
    </span>
  );
}

/**
 * The status bar: name and role, then the breadcrumb, with the links at the right. Always one row.
 * The stage is sized from what this bar leaves of the viewport.
 */
export function Hud({ route, crumbs }: HudProps) {
  const { value: bar, ref: barRef } = useMeasured(guessBar, measureBar, sameBar);
  const { dpr } = bar;
  const trail = route.view === 'title' ? [] : crumbs;
  const { n, rows, level } = layOut(bar, trail.map((crumb) => crumb.label));
  const fit = FITS[level];

  // The row inside the bar is laid out in device pixels and scaled back by the pixel ratio, so its
  // type has a whole-number size and every box in it a whole-number place, whatever the screen.
  const rowStyle = {
    width: `${100 * dpr}%`,
    height: rows,
    transform: dpr === 1 ? undefined : `scale(${1 / dpr})`,
    fontSize: 8 * n,
    // The letters fill the top 7 of their 8 pixels; this much above them centers them in the bar.
    '--hud-drop': `${n - (n % 2)}px`,
    // Focus ring: 2 CSS px, or one font pixel where that is more.
    '--hud-ring': `${Math.max(n, Math.round(2 * dpr))}px`,
    '--hud-pad': `${PAD}em`,
    '--hud-id-gap': `${ID_GAP}em`,
    '--hud-group-gap': `${GROUP_GAP}em`,
    '--hud-step': `${STEP}em`,
  } as CSSProperties;

  return (
    <header ref={barRef} className="hud" style={{ height: rows / dpr }} data-hud="" data-fit={level}>
      <div className="hud__lens">
        <div className="hud__row" style={rowStyle}>
          <div className="hud__id">
            {/* Spans, not paragraphs: a reader's own text-spacing styles add space after every <p>, which pushed these out of the bar. */}
            <span className="hud__name hud__text">{profile.name}</span>
            {fit.role && <span className="hud__role hud__text">{profile.role}</span>}
          </div>
          {trail.length > 0 && (
            <nav className="hud__crumbs" aria-label="Breadcrumb" data-breadcrumb="">
              <ol>
                {trail.map((crumb, index) => (
                  <li key={crumb.href ?? 'here'} hidden={index < trail.length - fit.keep}>
                    {crumb.href ? (
                      <a className="hud__link" href={crumb.href}>
                        <Mark chevron={index > 0} pointer />
                        <span className="hud__text">{crumb.label}</span>
                      </a>
                    ) : (
                      <span className="hud__here" aria-current="page">
                        <Mark chevron={index > 0} />
                        <span className="hud__text">{crumb.label}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <nav className="hud__links" aria-label="Quick links">
            <ul>
              {LINKS.map((link) => {
                const shown = fit.short ? link.short : link.label;
                // The accessible name starts with what is shown: "CV, Resume (opens in a new tab)".
                const name = `${shown === link.label ? '' : `${shown}, `}${link.label}${link.external ? ' (opens in a new tab)' : ' view'}`;
                return (
                  <li key={link.label}>
                    <a
                      className="hud__link"
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      aria-label={name}
                      title={shown === link.label ? undefined : link.label}
                    >
                      <Mark pointer />
                      <span className="hud__text">{shown}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
