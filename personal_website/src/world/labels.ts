// Where every label and hotspot goes, worked out in device pixels so text and chip edges stay crisp.
//
// A label is a solid chip. Its fill is a whole number of scene pixels wide and tall, so its edges line
// up with the art; the text sits inside it on whole device pixels. Press Start 2P is monospaced on an
// 8-pixel grid, so the text size is known without measuring the page.
import { SCENE_HEIGHT, SCENE_WIDTH } from './assets';
import { roomLabelPx, worldLabelPx } from './pixels';
import { scenes } from './scenes';
import type { Box, Hotspot, SceneId } from './types';

/**
 * tag:   black chip, white text. Objects without a plate, overworld names, EXIT.
 * tip:   white chip with a black edge. A name that shows only while its hotspot is active.
 * sand:  the peach floor plate of the workshop (no edge in the art).
 * sign:  the peach sidewalk plate of the town, with the art's black edge.
 * steel: the pale grey plate of the trophy hall, with the art's black edge.
 * The plate looks take their colors from the pictures (the --color-plate-* tokens in src/index.css).
 */
export type LabelLook = 'tag' | 'tip' | 'sand' | 'sign' | 'steel';

/** The scale labels and hotspots are laid out for: device pixels per scene pixel, and the screen's pixel ratio. */
export type Scale = { d: number; dpr: number };

export type LabelLayout = {
  id: string;
  text: string;
  look: LabelLook;
  /**
   * False for names that show only while their hotspot is hovered or focused: Skills items, and
   * any name that fits its place at no size on a very small stage.
   */
  always: boolean;
  /** Border box in CSS px from the stage's top left corner. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Border width, CSS px (0 for none). */
  border: number;
  fontSize: number;
  /** Text offset inside the border box, CSS px. */
  textLeft: number;
  textTop: number;
  /** Top left corner of the pointer while this label's hotspot is active, CSS px. */
  pointerLeft: number;
  pointerTop: number;
};

export type Rect = { left: number; top: number; width: number; height: number };

/** ENGINE.md section 8: every hotspot is at least this big, in CSS px. */
const MIN_TARGET = 24;

/** Border width per look, in scene units. */
const EDGE: Record<LabelLook, number> = { tag: 0, tip: 1, sand: 0, sign: 1, steel: 1 };

/**
 * How far a chip's fill reaches past its plate box: [left, top, right, bottom] in scene units.
 * The plates painted in the pictures have a black line round them that is a little wider than one
 * unit and does not lie on the grid (the town's sits most of a unit up and left of its box, the
 * trophy hall's reaches about one and a half units out on every side). The chip grows by this
 * much, so its own one-unit border covers that line whole and no soft edge shows beside the hard one.
 */
const GROW: Partial<Record<LabelLook, [number, number, number, number]>> = { sign: [1, 1, 0, 0], steel: [1, 1, 1, 1] };

/** The box a chip on a plate has to fill: the plate, grown for its look. */
function plateFill([x, y, w, h]: Box, look: LabelLook): Box {
  const [left, top, right, bottom] = GROW[look] ?? [0, 0, 0, 0];
  return [x - left, y - top, w + left + right, h + top + bottom];
}

type Placement = {
  look: LabelLook;
  /** A plate (in the art, or stood in for by the chip) that the chip covers and is centered on. */
  plate?: Box;
  /** Without a plate: horizontal center, or a pinned left edge; and the top or bottom edge. Scene px. */
  cx?: number;
  left?: number;
  top?: number;
  bottom?: number;
  /** The horizontal room the chip may use, scene px [from, to]. It slides to stay inside. */
  span?: [number, number];
};

/** Plates drawn in the art take the look of their room. */
const PLATE_LOOK: Partial<Record<SceneId, LabelLook>> = { experience: 'sign', projects: 'sand', misc: 'steel' };

/**
 * What the art needs that the default rules do not give. Spans are the clear floor or wall around a
 * label, measured from the approved art, so a wide name slides instead of covering the next object.
 */
const PLACES: Partial<Record<SceneId, Record<string, Partial<Placement>>>> = {
  world: {
    // Keep clear of the cottage roof and of the clock tower.
    learning: { span: [60, 135] },
    projects: { span: [176, 246] },
  },
  about: {
    diploma: { span: [40, 91] },
    computer: { span: [33, 70] },
    // The computer's name takes the desk under both objects, so the scroll's sits beside the desk,
    // level with the scroll.
    scroll: { left: 89, top: 63 },
    corkboard: { span: [207, 254] },
  },
  experience: {
    shopify: { span: [13, 82] },
    pnc: { span: [84, 160] },
    purduestack: { span: [161, 237] },
    rooh: { span: [239, 307] },
  },
  projects: {
    // No usable plate in the art: Raft's is behind the key cabinet, PyroTech's is under the
    // microphone, BoilerFit has none. Each gets a plate of the same kind on the front of its bench.
    raft: { plate: [72, 61, 27, 7] },
    pyrotech: { plate: [222, 61, 26, 7] },
    boilerfit: { plate: [147, 132, 27, 6] },
  },
  skills: {
    // Shelf names go on the blank paneling under the items.
    languages: { cx: 66, top: 44, span: [39, 94] },
    frameworks: { cx: 129, top: 44, span: [100, 158] },
    infrastructure: { cx: 193, top: 44, span: [164, 222] },
    tools: { cx: 255.5, top: 44, span: [228, 283] },
  },
  misc: {
    // Wall plates sit between the columns and the trophy cups; floor plates stop at the carpet.
    lahacks: { span: [51, 105] },
    tartanhacks: { span: [137, 185] },
    plaque: { span: [215, 270] },
    yc: { span: [52, 139] },
    capitalone: { span: [182, 268] },
  },
};

function placementFor(sceneId: SceneId, hotspot: Hotspot): Placement {
  const [x, y, w, h] = hotspot.region.box;
  const extra = PLACES[sceneId]?.[hotspot.id] ?? {};
  let base: Placement;
  if (hotspot.id === 'door' && sceneId !== 'world') {
    // On the doorway itself: the opening is 24 px wide, 15 px in from the frame.
    base = { look: 'tag', cx: x + 27, top: 151 };
  } else if (hotspot.labelMode === 'active') {
    base = { look: 'tip', cx: x + w / 2, bottom: y - 2 };
  } else if (sceneId === 'world') {
    base = { look: 'tag', cx: x + w / 2, top: y + h + 2 };
  } else if (extra.plate ?? hotspot.region.plate) {
    base = { look: PLATE_LOOK[sceneId] ?? 'tag', plate: hotspot.region.plate };
  } else {
    base = { look: 'tag', cx: x + w / 2, top: y + h + 1 };
  }
  return { ...base, ...extra };
}

/** A label before it is turned into CSS px. Positions are scene px, text sizes device px. */
type Laid = {
  hotspot: Hotspot;
  look: LabelLook;
  /** Shown all the time (see LabelLayout). */
  always: boolean;
  /** Border box. */
  x: number;
  y: number;
  w: number;
  h: number;
  edge: number;
  /** Device px per font pixel. */
  f: number;
  inkLeft: number;
  inkTop: number;
  /** False when the chip does not fit its span or had to leave its plate. */
  fits: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function lay(hotspot: Hotspot, place: Placement, f: number, d: number): Laid {
  const inkW = (hotspot.label.length * 8 - 1) * f;
  const inkH = 7 * f;
  const edge = EDGE[place.look];
  // The fill: the text with one font pixel of room all round, rounded up to whole scene pixels.
  let fw = Math.ceil((inkW + 2 * f) / d);
  let fh = Math.ceil((inkH + 2 * f) / d);
  let fx: number;
  let fy: number;
  const plate = place.plate ? plateFill(place.plate, place.look) : null;
  if (plate) {
    const [px, py, pw, ph] = plate;
    fw = Math.max(fw, pw);
    fh = Math.max(fh, ph);
    fx = fw === pw ? px : Math.round(px + pw / 2 - fw / 2);
    fy = py - Math.floor((fh - ph) / 2);
  } else {
    fx = place.left ?? Math.round((place.cx ?? 0) - fw / 2);
    fy = place.top ?? (place.bottom ?? 0) - fh;
  }

  // Slide sideways to stay inside the span and the stage, leaving room for the pointer on the left.
  const pointerRoom = Math.ceil((8 * f) / d);
  const from = Math.max(place.span?.[0] ?? 0, pointerRoom) + edge;
  const to = Math.min(place.span?.[1] ?? SCENE_WIDTH, SCENE_WIDTH) - edge - fw;
  let fits = to >= from;
  fx = fits ? clamp(fx, from, to) : Math.round((from + to) / 2);
  fy = clamp(fy, edge, SCENE_HEIGHT - edge - fh);
  if (plate) {
    const [px, , pw] = plate;
    if (fx > px || fx + fw < px + pw) fits = false;
  }
  if (fx - edge < 0 || fx + fw + edge > SCENE_WIDTH) fits = false;

  return {
    hotspot,
    look: place.look,
    always: hotspot.labelMode === 'always',
    x: fx - edge,
    y: fy - edge,
    w: fw + 2 * edge,
    h: fh + 2 * edge,
    edge,
    f,
    inkLeft: edge * d + Math.floor((fw * d - inkW) / 2),
    inkTop: edge * d + Math.floor((fh * d - inkH) / 2),
    fits,
  };
}

const overlaps = (a: Laid, b: Laid) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Every always-on label fits its place, and no two labels that can show together overlap. */
function works(laid: Laid[]): boolean {
  const steady = laid.filter((l) => l.always);
  if (steady.some((l) => !l.fits)) return false;
  for (let i = 0; i < steady.length; i++) {
    for (let j = i + 1; j < steady.length; j++) if (overlaps(steady[i], steady[j])) return false;
  }
  const passing = laid.filter((l) => !l.always);
  return !passing.some((tip) => steady.some((label) => overlaps(tip, label)));
}

/**
 * For a scene where no one size of 8 CSS px or more fits every name: the scene is set at that
 * smallest size, and only the names that do not fit there go smaller, one at a time and each as
 * little as it has to. A name that fits at no size leaves the art and shows while its hotspot is
 * hovered or focused, like a Skills item's. Nothing ever overlaps.
 */
function squeeze(hotspots: Hotspot[], least: number, at: (hotspot: Hotspot, f: number) => Laid): Laid[] {
  const laid = hotspots.map((hotspot) => at(hotspot, least));
  const clear = (label: Laid, others: Laid[]) => label.fits && !others.some((other) => other !== label && overlaps(label, other));
  const steady = laid.filter((l) => l.always);
  // Names that are fine where they are stay; the rest are fitted around them.
  const kept = steady.filter((l) => clear(l, steady));
  return laid.map((l) => {
    if (!l.always || kept.includes(l)) return l;
    for (let f = least; f >= 1; f--) {
      const smaller = f === least ? l : at(l.hotspot, f);
      if (!clear(smaller, kept)) continue;
      kept.push(smaller);
      return smaller;
    }
    return { ...l, always: false };
  });
}

const cache = new Map<string, LabelLayout[]>();

/**
 * Labels for a scene at a scale. The type starts at the scale's natural size and steps down a
 * device pixel at a time until every label in the scene fits, so a room does not mix sizes; it
 * stops at an 8 CSS px font, below which only the names that still do not fit go (see squeeze).
 */
export function layoutLabels(sceneId: SceneId, m: Scale): LabelLayout[] {
  const key = `${sceneId}:${m.d}:${m.dpr}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const hotspots = scenes[sceneId].hotspots;
  const at = (hotspot: Hotspot, f: number) => lay(hotspot, placementFor(sceneId, hotspot), f, m.d);
  // An 8 CSS px font, or one scene pixel per font pixel where that is smaller (a stage at 1x).
  const least = Math.max(1, Math.min(m.d, Math.ceil(m.dpr - 1e-9)));
  const natural = Math.max(least, sceneId === 'world' ? worldLabelPx(m.d, m.dpr) : roomLabelPx(m.d, m.dpr));
  let laid: Laid[] | null = null;
  for (let f = natural; f >= least && !laid; f--) {
    const attempt = hotspots.map((hotspot) => at(hotspot, f));
    if (works(attempt)) laid = attempt;
  }
  laid ??= squeeze(hotspots, least, at);

  const css = (devicePx: number) => devicePx / m.dpr;
  const out = laid.map((l): LabelLayout => {
    const left = l.x * m.d;
    const top = l.y * m.d;
    return {
      id: l.hotspot.id,
      text: l.hotspot.label,
      look: l.look,
      always: l.always,
      left: css(left),
      top: css(top),
      width: css(l.w * m.d),
      height: css(l.h * m.d),
      border: css(l.edge * m.d),
      fontSize: css(8 * l.f),
      textLeft: css(l.inkLeft),
      textTop: css(l.inkTop),
      // The pointer is 6 x 9 font pixels with its outline; one font pixel of air before the chip.
      pointerLeft: css(left - 7 * l.f),
      pointerTop: css(top + l.inkTop - l.f),
    };
  });
  cache.set(key, out);
  return out;
}

/**
 * Where the mouse or a click counts as being on a name that is always shown: its chip, and the
 * cell to the left of it where the ▶ is drawn, so the ▶ belongs to the thing it points at. The
 * cell stops at any other name's chip.
 */
export function nameArea(label: LabelLayout, all: LabelLayout[]): Rect {
  let left = label.pointerLeft;
  for (const other of all) {
    if (other === label || !other.always) continue;
    const right = other.left + other.width;
    const beside = other.top < label.top + label.height && label.top < other.top + other.height;
    if (beside && right <= label.left + 0.01 && right > left) left = right;
  }
  return { left, top: label.top, width: label.left + label.width - left, height: label.height };
}

/** A region's box on the stage in CSS px, as it is drawn. */
export function regionRect(box: Box, m: Scale): Rect {
  const css = (scenePx: number) => (scenePx * m.d) / m.dpr;
  return { left: css(box[0]), top: css(box[1]), width: css(box[2]), height: css(box[3]) };
}

/** A hotspot's box on the stage in CSS px, grown evenly to the minimum target size where it is smaller. */
export function hotspotRect(box: Box, m: Scale): Rect {
  const min = Math.ceil(MIN_TARGET * m.dpr - 1e-9);
  const axis = (start: number, size: number): [number, number] => {
    let from = start * m.d;
    let length = size * m.d;
    if (length < min) {
      const grow = Math.ceil((min - length) / 2);
      from -= grow;
      length += 2 * grow;
    }
    return [from / m.dpr, length / m.dpr];
  };
  const [left, width] = axis(box[0], box[2]);
  const [top, height] = axis(box[1], box[3]);
  return { left, top, width, height };
}
