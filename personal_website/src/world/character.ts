// The character's two animations as CSS, written from the sprite sheet's own description
// (art/approved/hd/mascot.json): which frames, in which order, how fast. Nothing about the sheet
// is known here ahead of time, so a new sheet with other frames needs no change in the code.
import type { Sprite, SpriteAnimation } from './types';

/** How the character stands: at rest, or waving (pointed at, focused, or his dialog is open). */
export type Pose = 'idle' | 'wave';

/** Where the sheet has to slide for a frame to show in the frame-sized window: a share of the sheet's width. */
const shift = (frame: number, count: number) => `translateX(${round((-100 * frame) / count)}%)`;

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** One step per frame; each holds until the next (step-end), and the last holds until the loop starts over. */
function keyframes(name: string, animation: SpriteAnimation, count: number): string {
  const steps = animation.frames.map((frame, index) => `${round((100 * index) / animation.frames.length)}% { transform: ${shift(frame, count)}; }`);
  return `@keyframes ${name} { ${steps.join(' ')} }`;
}

const seconds = (animation: SpriteAnimation) => `${round(animation.frames.length / animation.fps)}s`;

/** The transform that shows the frame the character rests on: the first of his idle animation. */
export function restingFrame(sprite: Sprite): string {
  return shift(sprite.animations.idle.frames[0], sprite.count);
}

/**
 * The style sheet for a sprite: both animations, played on `.character__sheet` according to
 * `data-pose` on the character. Under reduced motion there is none, and the sheet stays on its
 * resting frame. `id` keeps the names apart should two sprites ever share a page.
 */
export function spriteCss(id: string, sprite: Sprite): string {
  const { idle, wave } = sprite.animations;
  const scope = `[data-sprite="${id}"]`;
  return [
    keyframes(`${id}-idle`, idle, sprite.count),
    keyframes(`${id}-wave`, wave, sprite.count),
    '@media (prefers-reduced-motion: no-preference) {',
    `  ${scope} .character__sheet { animation: ${id}-idle ${seconds(idle)} step-end infinite; }`,
    `  ${scope}[data-pose="wave"] .character__sheet { animation: ${id}-wave ${seconds(wave)} step-end infinite; }`,
    '}',
  ].join('\n');
}
