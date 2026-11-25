// How the visitor last acted, and focus moved by script on their behalf.

let byKey = false;
/** Where the last press of the mouse or a finger was, in the viewport. */
const press = { x: 0, y: 0 };

if (typeof window !== 'undefined') {
  const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta']);
  window.addEventListener(
    'keydown',
    (event) => {
      if (!MODIFIERS.has(event.key)) byKey = true;
    },
    true,
  );
  window.addEventListener(
    'pointerdown',
    (event) => {
      byKey = false;
      press.x = event.clientX;
      press.y = event.clientY;
    },
    true,
  );
}

/**
 * An object opens its dialog on the first click of a double click (or double tap). The second one
 * then lands on whatever the dialog has put under the mouse: the background, which would close it
 * again, or a link or BACK inside it. It must not count.
 */
const SECOND_CLICK_MS = 500;
/** How far apart, in CSS px, the two clicks of a pair may land. */
const SECOND_CLICK_PX = 24;

/**
 * When a click was made, on the clock of performance.now(): the event's own time stamp, not the
 * moment its handler runs. While the camera eases toward an opened object the page is busy, and on
 * a slow device the second click of a pair can wait in the queue for longer than SECOND_CLICK_MS:
 * judged by when it was handled, it would count as a new click and close the dialog.
 */
function clickTime(timeStamp: number | undefined): number {
  const now = performance.now();
  // An event without a usable stamp (0, or one counted from 1970 in an old browser) is taken as "now".
  return timeStamp !== undefined && timeStamp > 0 && timeStamp <= now ? timeStamp : now;
}

/** When a dialog opened and where the press that opened it was; null when a key opened it. */
export type Opening = { at: number; x: number; y: number } | null;

/** Call as a dialog opens. */
export function noteOpening(): Opening {
  return byKey ? null : { at: performance.now(), x: press.x, y: press.y };
}

/**
 * True for a click that is the second of the pair that opened the dialog: soon after it opened,
 * and either counted as a double click by the browser (`detail`) or on the same spot as the first
 * (touch screens do not always count). A click made with the keyboard (detail 0) is never one, and
 * neither is a quick click somewhere else, on BACK say.
 */
export function isSecondClick(event: { detail: number; clientX: number; clientY: number; timeStamp?: number }, opening: Opening): boolean {
  if (!opening || event.detail === 0 || clickTime(event.timeStamp) - opening.at >= SECOND_CLICK_MS) return false;
  return event.detail > 1 || Math.hypot(event.clientX - opening.x, event.clientY - opening.y) <= SECOND_CLICK_PX;
}

/** True when the visitor's last action was a key press, false after a click or a tap. */
export const lastInputWasKey = () => byKey;

/** `focusVisible` is in every current browser but not yet in TypeScript's FocusOptions. */
type FocusOptionsNow = FocusOptions & { focusVisible?: boolean };

/**
 * Moves focus by script in answer to a key press, with the focus ring showing. Firefox decides
 * whether to draw the ring from how focus moved last, not from this key press, so it has to be told.
 * `reveal` lets the browser scroll the element into view (inside a dialog's scrolling text).
 */
export function focusByKey(element: HTMLElement, reveal = false): void {
  const options: FocusOptionsNow = { preventScroll: !reveal, focusVisible: true };
  element.focus(options);
}

/** Focus moved by script after something the visitor did: the ring shows if they used the keyboard. */
export function focusAfterInput(element: HTMLElement): void {
  if (byKey) focusByKey(element);
  else element.focus({ preventScroll: true });
}
