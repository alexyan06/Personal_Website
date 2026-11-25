import { useMediaQuery } from './useMediaQuery';
import type { Route } from './types';

/** A touch device held upright with less than 600 CSS px across (ENGINE.md section 7). */
const PHONE_UPRIGHT = '(orientation: portrait) and (max-width: 599.98px) and (pointer: coarse)';

/**
 * A window with a mouse that leaves the stage less than twice its 320x180: under 640 CSS px across,
 * or under 384 down (360 for the stage and 24 for the status bar). The world would be a 320-pixel
 * box in it, with names that do not fit their plates and a dialog two lines tall. Phones on their
 * side are not covered by this (a coarse pointer): they get the world, as the brief asks.
 */
const SMALL_WINDOW = '(pointer: fine) and (max-width: 639.98px), (pointer: fine) and (max-height: 383.98px)';

/** Why the world is covered: the device has to be turned, or the window made larger. */
export type Gate = 'rotate' | 'window';

/**
 * Whether the gate screen should cover the world, and which one. Never on the list view, which
 * reads fine at any size. The app uses the same answer to make the world behind it inert.
 */
export function useRotateGate(route: Route): Gate | null {
  const upright = useMediaQuery(PHONE_UPRIGHT);
  const small = useMediaQuery(SMALL_WINDOW);
  if (route.view === 'list') return null;
  return upright ? 'rotate' : small ? 'window' : null;
}
