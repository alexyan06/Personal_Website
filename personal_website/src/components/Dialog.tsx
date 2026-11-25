import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { BodyText, NewTabIcon } from '@/components/BodyText';
import { PixelArrow } from '@/components/PixelArrow';
import { focusByKey, isSecondClick, noteOpening, type Opening } from '@/world/input';
import { roomLabelPx, stageDotPx } from '@/world/pixels';
import { useStageMetrics } from '@/world/StageContext';
import type { DialogContent, DialogLink } from '@/world/types';
import '@/styles/dialog.css';

type DialogProps = {
  /** The hotspot id this dialog belongs to (`data-dialog`). */
  id: string;
  content: DialogContent;
  /** Go back to the room. The engine navigates; the dialog only asks. */
  onClose: () => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** scenes.ts joins the parts of a meta line (dates, place) with this; here each part gets its own line. */
const META_SEPARATOR = ' · ';
/** The left column takes up to this many tags; a longer list goes with the text. */
const MAX_TAGS_BESIDE = 5;
/** Comfortably longer than the opening effect in dialog.css (120 ms). */
const ENTER_MS = 400;
/**
 * Scene pixels across the inside of the box: the stage, less the dialog layer's 8 at each side
 * (.stage__dialog in world.css) and the box's own frame and gutter, 5 at each side (dialog.css).
 */
const INNER_WIDTH = 320 - 2 * 8 - 2 * 5;
/** Two columns once the inside of the box is this many dots of the body face across: 72 letters. */
const SPLIT_FROM_DOTS = 720;
/** MORE shows while this many dots or more are hidden below: a row of text, not the blank leading under the last line. */
const MORE_FROM_DOTS = 5;

/** Everything Tab can land on inside the dialog, in order. */
function tabStops(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
}

/** The ▼ of "more below", 7 x 4 font pixels. Sized in em like PixelArrow, so it matches the text beside it. */
function DownArrow() {
  return (
    <svg className="dialog__more-arrow" viewBox="0 0 7 4" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {[7, 5, 3, 1].map((width, row) => (
        <rect key={row} x={row} y={row} width={width} height={1} />
      ))}
    </svg>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="pixel-tags dialog__tags" role="list">
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  );
}

function Links({ links }: { links: DialogLink[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="dialog__links" role="list">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noopener noreferrer' : undefined}
            aria-label={link.external ? `${link.label} (opens in a new tab)` : undefined}
          >
            <PixelArrow />
            <span className="dialog__link-text">{link.label}</span>
            {link.external && <NewTabIcon />}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The NES dialog box: black fill, chunky white border with stepped corners, and a BACK button.
 *
 * It sits at the bottom of the stage's dialog layer (.stage__dialog in src/styles/world.css), as wide
 * as the layer and as tall as its content needs, up to the whole layer. What the item is (title,
 * subtitle, dates) goes in a column on the left and its text on the right. On a stage too small
 * for two columns of the body face they stack: the facts first, on as few lines as they take, then
 * the text, with the tags after it. Text that is taller than the box scrolls inside it, with a
 * pixel scrollbar and a "MORE" cue, while BACK stays put underneath.
 *
 * The engine frames the opened object in the part of the stage the box leaves free, returns focus
 * to the hotspot that opened the dialog, makes the scene behind it inert, and also closes it on
 * Escape pressed anywhere, on browser Back and on a click outside the box.
 */
export function Dialog({ id, content, onClose }: DialogProps) {
  const titleId = useId();
  const { d, dpr } = useStageMetrics();
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const opening = useRef<Opening>(null);

  // On open: focus moves into the dialog, and the box unfolds (see dialog.css), except on a page
  // that loads straight into a dialog, which shows it at once like everything else on a first load.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    opening.current = noteOpening();
    element.focus({ preventScroll: true });
    if (element.closest('[data-stage]')?.getAttribute('data-transition') === 'loading') return;
    element.setAttribute('data-enter', '');
    // Taken off again once the effect is over, so nothing can set it off a second time.
    const done = window.setTimeout(() => element.removeAttribute('data-enter'), ENTER_MS);
    return () => window.clearTimeout(done);
  }, []);

  // Focus trap. Tab and Shift+Tab go round inside the dialog, and bring focus back into it when it
  // has ended up on the page behind (after a click on the background, say). Every step is made
  // here, not left to the browser: Safari's own Tab skips buttons and links unless the visitor
  // has changed a setting, and would drop focus on the page behind.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const element = root.current;
      if (event.key !== 'Tab' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!element || element.closest('[inert]')) return;
      const stops = tabStops(element);
      const at = stops.indexOf(document.activeElement as HTMLElement);
      let next: HTMLElement = element;
      if (stops.length > 0) {
        if (at === -1) next = event.shiftKey ? stops[stops.length - 1] : stops[0];
        else next = stops[(at + (event.shiftKey ? stops.length - 1 : 1)) % stops.length];
      }
      event.preventDefault();
      focusByKey(next, true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Whether the text scrolls, and whether there is more of it below. Kept on the elements themselves
  // (no state): the CSS shows the cue from these attributes, and text that scrolls becomes a Tab stop
  // so the arrow keys can scroll it.
  useLayoutEffect(() => {
    const element = root.current;
    const scroll = scroller.current;
    const column = head.current;
    if (!element || !scroll || !column) return;
    let alive = true;
    const update = () => {
      if (!alive) return;
      const room = scroll.scrollHeight - scroll.clientHeight;
      const scrolls = room > 1;
      const dotPx = (parseFloat(getComputedStyle(scroll).lineHeight) || 30) / 30;
      element.toggleAttribute('data-scrolls', scrolls);
      element.toggleAttribute('data-more', scrolls && room - scroll.scrollTop >= MORE_FROM_DOTS * dotPx - 0.5);
      // The left column stays in view while the text scrolls, if all of it fits.
      element.toggleAttribute('data-pinned', scrolls && column.offsetHeight <= scroll.clientHeight);
      if (scrolls) {
        scroll.tabIndex = 0;
        scroll.setAttribute('role', 'group');
        scroll.setAttribute('aria-labelledby', titleId);
      } else {
        scroll.removeAttribute('tabindex');
        scroll.removeAttribute('role');
        scroll.removeAttribute('aria-labelledby');
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    if (scroll.firstElementChild) observer.observe(scroll.firstElementChild);
    scroll.addEventListener('scroll', update, { passive: true });
    // The fallback face's lines can overflow a box that the real face fits exactly, without any
    // box changing size when the real face arrives: measure again then.
    document.fonts.addEventListener('loadingdone', update);
    void document.fonts.ready.then(update);
    return () => {
      alive = false;
      observer.disconnect();
      scroll.removeEventListener('scroll', update);
      document.fonts.removeEventListener('loadingdone', update);
    };
  }, [titleId]);

  // The second click of the double click that opened the dialog must not press what the box has
  // put under the mouse (a link, BACK): it is stopped before it gets there.
  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isSecondClick(event, opening.current)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // Handled here: the engine's own Escape listener skips events that are already prevented.
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    const scroll = scroller.current;

    // Left and right move between the links and BACK, like a menu cursor. From the box itself
    // (where focus is when it opens) they go to the first or the last of them.
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const actions = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button')];
      const index = actions.indexOf(target);
      const forward = event.key === 'ArrowRight';
      if (index === -1 && target !== event.currentTarget) return;
      if (actions.length === 0 || (index !== -1 && actions.length < 2)) return;
      event.preventDefault();
      const to = index === -1 ? (forward ? 0 : actions.length - 1) : (index + (forward ? 1 : actions.length - 1)) % actions.length;
      focusByKey(actions[to], true);
      return;
    }

    // Up, down and the paging keys scroll the text wherever focus is in the dialog. (When the text
    // itself has focus the browser scrolls it.)
    if (!scroll || target === scroll || scroll.scrollHeight - scroll.clientHeight <= 1) return;
    const line = parseFloat(getComputedStyle(scroll).lineHeight) || 30;
    const page = Math.max(line, scroll.clientHeight - line);
    const steps: Record<string, number> = { ArrowDown: 2 * line, ArrowUp: -2 * line, PageDown: page, PageUp: -page, Home: -scroll.scrollHeight, End: scroll.scrollHeight };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    scroll.scrollBy({ top: step, behavior: 'instant' });
  };

  const { title, spokenTitle, subtitle, meta, paragraphs = [], bullets = [], tags = [], links = [] } = content;
  const metaLines = meta ? meta.split(META_SEPARATOR) : [];
  const hasProse = paragraphs.length > 0 || bullets.length > 0;
  // The box is always as wide as the dialog layer, so whether two columns fit is known from the
  // stage's scale alone: no measuring, and no layout that changes after the first paint.
  const twoColumns = (INNER_WIDTH * d) / stageDotPx(d, dpr) >= SPLIT_FROM_DOTS;
  // A short list of tags (a stack) joins the facts on the left, so the prose has the right-hand
  // column to itself. A long list is content in its own right and follows the text; so does any
  // list where the columns stack, so the text starts as high in the box as it can.
  const tagsBeside = twoColumns && hasProse && tags.length <= MAX_TAGS_BESIDE;
  const hasText = hasProse || (tags.length > 0 && !tagsBeside);

  // Press Start 2P sizes, in whole device pixels per font pixel. MORE and BACK use the room labels'
  // size (--px), but never under 1.5 CSS px, which a label squeezed onto the art may go below.
  // The title is larger where there is room: three quarters of a scene pixel, like the overworld's labels.
  const uiPx = Math.max(roomLabelPx(d, dpr), Math.ceil(1.5 * dpr - 1e-9));
  const titlePx = Math.max(uiPx, Math.round(0.75 * d));
  const style = { '--ui-px': `${uiPx / dpr}px`, '--title-px': `${titlePx / dpr}px` } as CSSProperties;

  return (
    <div
      ref={root}
      className="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-dialog={id}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClickCapture={onClickCapture}
      style={style}
    >
      <span className="pixel-frame" aria-hidden="true" />
      <div ref={scroller} className="dialog__scroll">
        <div className={hasText && twoColumns ? 'dialog__content dialog__content--split' : 'dialog__content'}>
          <div ref={head} className="dialog__head">
            <h2 id={titleId} className="dialog__title">
              {spokenTitle ? (
                <>
                  {/* A title that is not a word ("???") is shown as it is and read out as what it stands for. */}
                  <span aria-hidden="true">{title}</span>
                  <span className="sr-only">{spokenTitle}</span>
                </>
              ) : (
                title
              )}
            </h2>
            {subtitle && (
              <p className="dialog__subtitle">
                <BodyText>{subtitle}</BodyText>
              </p>
            )}
            {metaLines.length > 0 && (
              <p className="dialog__meta">
                {metaLines.map((line) => (
                  <span key={line}>
                    <BodyText>{line}</BodyText>
                  </span>
                ))}
              </p>
            )}
            {tagsBeside && <Tags tags={tags} />}
            {!hasText && <Links links={links} />}
          </div>
          {hasText && (
            <div className="dialog__text">
              {paragraphs.map((text) => (
                <p key={text}>
                  <BodyText>{text}</BodyText>
                </p>
              ))}
              {bullets.length > 0 && (
                <ul className="pixel-bullets" role="list">
                  {bullets.map((text) => (
                    <li key={text}>
                      <BodyText>{text}</BodyText>
                    </li>
                  ))}
                </ul>
              )}
              {!tagsBeside && <Tags tags={tags} />}
              <Links links={links} />
            </div>
          )}
        </div>
      </div>
      <div className="dialog__footer">
        <span className="dialog__more" aria-hidden="true">
          More
          <DownArrow />
        </span>
        <button type="button" className="dialog__back" onClick={onClose}>
          <PixelArrow />
          Back
        </button>
      </div>
    </div>
  );
}
