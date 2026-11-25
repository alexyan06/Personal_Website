// How the chimney smoke on the overworld moves. The puffs are art: art/approved/hd/smoke.webp and
// smoke.json, cut from the picture's own smoke by art/scripts/smoke.mjs. This file is the motion:
// the numbers to tune, and the CSS written from them (as character.ts does for the character).
// The animations change only transform and opacity, and there are none under reduced motion.
import type { SmokeSheet } from './types';

/**
 * Everything to tune about the smoke, in one place. Lengths are in scene units: one unit is one
 * "pixel" of the art (the overworld is 320 x 180 of them).
 *
 * A puff leaves the chimney as the first frame of the sheet and climbs, leaning over. Along the
 * way it turns into the next frames (the sheet has three: a wisp, a billow, a last thin puff),
 * each for an equal part of its life, then fades away.
 */
export const SMOKE = {
  /** Seconds a puff lives: from leaving the chimney until it has faded away. */
  seconds: 6,
  /** Moves a second. Every puff of both chimneys moves on the same beat, like the frames of an old game. */
  fps: 2,
  /** Puffs in the air over a chimney at once. They leave it evenly spaced: one every seconds / puffs. */
  puffs: 3,
  /** How far a puff climbs in its life. */
  rise: 11,
  /** How far it leans to the right on the way up (negative: to the left). */
  drift: 5,
  /** Where the middle of a new puff is, from the top of the chimney's opening: [to the right, up]. */
  start: [0, 1.5],
  /** How large the puffs are drawn. 1 is the size of the smoke that was painted in the picture. */
  size: 1,
  /** A new puff fades in over this share of its life (0: it is there at once). */
  fadeIn: 0.1,
  /** From this share of its life on, a puff fades away (1: it stays solid and then is gone). */
  fadeFrom: 0.8,
  /**
   * Seconds each chimney's smoke runs ahead of the one before it (the workshop's ahead of the
   * cottage's), so the two are not the same picture at the same moment. A whole number of moves
   * (a multiple of 1 / fps) keeps both on one beat.
   */
  lead: 1,
  /** false: a puff hops from place to place on the beat. true: it glides between them. */
  glide: false,
};

/** What one puff looks like at a moment, as CSS. */
export type SmokePose = {
  /** Transform of the puff: where its middle is from the chimney's opening, in shares of its own size. */
  puff: string;
  opacity: number;
  /** Transform of the row of frames behind the puff's window: which frame shows. */
  sheet: string;
};

/** One puff of a chimney. */
export type SmokePuff = {
  /** How it stands before its animation starts, and for good under reduced motion. */
  rest: SmokePose;
  /** Its animation-delay. Negative: the animation starts that far into the puff's life. */
  at: string;
};

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** Moves in a puff's life. A whole number, so a life is exactly that many beats. */
const beats = () => Math.max(1, Math.round(SMOKE.seconds * SMOKE.fps));

const puffCount = () => Math.max(1, Math.round(SMOKE.puffs));

/** How solid a puff is at `age`, a share of its life from 0 to 1: fading in, solid, fading away. */
function solid(age: number): number {
  const arriving = SMOKE.fadeIn > 0 ? age / SMOKE.fadeIn : 1;
  const leaving = SMOKE.fadeFrom < 1 ? (1 - age) / (1 - SMOKE.fadeFrom) : 1;
  return round(Math.min(1, Math.max(0, Math.min(arriving, leaving))));
}

/** The size a puff is drawn at, in scene units: one frame of the sheet, times SMOKE.size. */
export function puffSize(sheet: SmokeSheet): [w: number, h: number] {
  return [sheet.size[0] * SMOKE.size, sheet.size[1] * SMOKE.size];
}

/** A puff on a beat of its life: beat 0 is the moment it leaves the chimney. */
function pose(beat: number, sheet: SmokeSheet): SmokePose {
  const life = beats();
  const age = beat / life;
  const right = SMOKE.start[0] + SMOKE.drift * age;
  const up = SMOKE.start[1] + SMOKE.rise * age;
  const [w, h] = puffSize(sheet);
  const frame = Math.min(sheet.count - 1, Math.floor(age * sheet.count));
  return {
    puff: `translate(${round((100 * right) / w)}%, ${round((-100 * up) / h)}%)`,
    // A hop is held for a whole beat: it shows how solid the puff is in the middle of that beat.
    opacity: solid(SMOKE.glide ? age : Math.min(1, (beat + 0.5) / life)),
    sheet: `translateX(${round((-100 * frame) / sheet.count)}%)`,
  };
}

/**
 * The puffs of chimney number `chimney` (0 for the first in the sheet's list). At rest they stand
 * evenly up the plume, each a quarter of the way into its stretch, so the youngest is still at the
 * chimney: with three puffs and three frames that is about the smoke as it was painted. Their
 * animations start whole beats apart, so every puff of every chimney moves at the same moments.
 */
export function smokePuffs(sheet: SmokeSheet, chimney: number): SmokePuff[] {
  const life = beats();
  const count = puffCount();
  return Array.from({ length: count }, (_, n) => ({
    rest: pose(Math.floor(((n + 0.25) * life) / count), sheet),
    at: `${round(-(Math.round((n * life) / count) / SMOKE.fps + chimney * SMOKE.lead))}s`,
  }));
}

/**
 * The style sheet for the smoke: a puff's life as two animations that run together. `smoke-rise`
 * moves and fades the puff (`.smoke__puff`), one keyframe per beat. `smoke-age` slides the row of
 * frames behind it (`.smoke__sheet`) on the beats where its look changes. Each puff starts some
 * way into that life (`--smoke-at`, from smokePuffs). Under reduced motion there are no
 * animations and every puff keeps its resting pose.
 */
export function smokeCss(sheet: SmokeSheet): string {
  const life = beats();
  const poses = Array.from({ length: life + 1 }, (_, beat) => pose(beat, sheet));
  const at = (beat: number) => `${round((100 * beat) / life)}%`;
  const rise = poses.map((p, beat) => `${at(beat)} { transform: ${p.puff}; opacity: ${p.opacity}; }`);
  const age = poses.flatMap((p, beat) => (beat === 0 || p.sheet !== poses[beat - 1].sheet ? [`${at(beat)} { transform: ${p.sheet}; }`] : []));
  const time = `${round(life / SMOKE.fps)}s`;
  return [
    `@keyframes smoke-rise { ${rise.join(' ')} }`,
    `@keyframes smoke-age { ${age.join(' ')} }`,
    '@media (prefers-reduced-motion: no-preference) {',
    // step-end: each keyframe holds until the next one. Gliding, the puff moves evenly between them.
    `  .smoke__puff { animation: smoke-rise ${time} ${SMOKE.glide ? 'linear' : 'step-end'} var(--smoke-at, 0s) infinite; }`,
    `  .smoke__sheet { animation: smoke-age ${time} step-end var(--smoke-at, 0s) infinite; }`,
    '}',
  ].join('\n');
}
