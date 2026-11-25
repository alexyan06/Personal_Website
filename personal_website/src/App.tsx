import { useEffect, useLayoutEffect, useRef } from 'react';
import { Hud } from '@/components/Hud';
import { ListView } from '@/components/ListView';
import { MusicPlayer } from '@/components/MusicPlayer';
import { RotateGate } from '@/components/RotateGate';
import { World } from '@/components/World';
import { profile } from '@/constants';
import { holdMusic } from '@/world/music';
import { applyChromePixels, watchDpr } from '@/world/pixels';
import { crumbsFor, parentRoute, routePath } from '@/world/routes';
import { findHotspot } from '@/world/scenes';
import type { Route } from '@/world/types';
import { navigate, readRoute, useRoute } from '@/world/useRoute';
import { useRotateGate } from '@/world/useRotateGate';

/** `?debug=hotspots` (before the hash) outlines every hotspot and label. */
const debug = new URLSearchParams(window.location.search).get('debug') === 'hotspots';

/** The site's own title, name and role, as index.html gives it to link previews. */
const SITE_TITLE = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content || profile.name;

/**
 * Tab title: the place, then the name. The title screen has the site's title. An item is named in
 * full here, where there is room: the breadcrumb and the art carry short forms of some names.
 */
function titleFor(route: Route): string {
  if (route.view === 'title') return SITE_TITLE;
  if (route.view === 'world') return `Overworld | ${profile.name}`;
  const places = crumbsFor(route)
    .slice(1)
    .map((crumb) => crumb.label);
  if (route.view === 'room' && route.item) {
    const whole = findHotspot(route.room, route.item)?.fullName;
    if (whole) places[places.length - 1] = whole;
  }
  return [...places.reverse(), profile.name].join(' | ');
}

const App = () => {
  const route = useRoute();
  const gated = useRotateGate(route) !== null;
  const title = titleFor(route);
  const isList = route.view === 'list';

  useEffect(() => {
    document.title = title;
  }, [title]);

  // Keep chrome type on whole device pixels when the browser zoom or the screen changes.
  useEffect(() => watchDpr(applyChromePixels), []);

  // The list view is a plain page on the HUD's black; world views set the color from their scene.
  useLayoutEffect(() => {
    if (isList) document.documentElement.style.setProperty('--page-bg', 'var(--color-nes-black)');
  }, [isList]);

  // The music belongs to the world: it waits while the list view or the rotate screen is up.
  useEffect(() => {
    holdMusic(isList || gated || document.hidden);
  }, [isList, gated]);

  // Between the world and the list view the page changes under the reader: move focus to the new
  // view's heading (the world's scene heading, or the list's <h1> if it takes focus).
  const lastView = useRef(route.view);
  useEffect(() => {
    const from = lastView.current;
    lastView.current = route.view;
    if (from === route.view || (from !== 'list' && !isList)) return;
    const heading = document.querySelector<HTMLElement>(isList ? '[data-view="list"] h1' : '[data-scene-heading]');
    heading?.focus({ preventScroll: true });
  }, [route.view, isList]);

  // Escape goes up one level: item, room, overworld. The dialog may close itself on Escape too; if
  // anything has already handled the key (the event is prevented, or the URL moved while it was
  // being dispatched) this listener stays out of it, so one press never goes up two levels.
  useEffect(() => {
    if (gated) return; // behind the gate screen the world answers no keys
    let hashAtPress = window.location.hash;
    const onCapture = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hashAtPress = window.location.hash;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (window.location.hash !== hashAtPress) return;
      const here = readRoute();
      const parent = here.view === 'list' ? null : parentRoute(here);
      if (!parent) return;
      event.preventDefault();
      navigate(parent);
    };
    window.addEventListener('keydown', onCapture, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onCapture, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [gated]);

  if (route.view === 'list') {
    return (
      <div data-route={routePath(route)}>
        <ListView />
        <RotateGate route={route} />
      </div>
    );
  }

  return (
    <div className={debug ? 'app app--debug' : 'app'} data-route={routePath(route)}>
      {/* Behind the rotate screen the world is out of reach, for the keyboard and for screen readers too. */}
      <div className="app__world" inert={gated}>
        <a className="skip-link pixel-box text-pixel" href="#/list">
          View as a list
        </a>
        <Hud route={route} crumbs={crumbsFor(route)} />
        <MusicPlayer visible={route.view !== 'title'} />
        <World route={route} />
      </div>
      <RotateGate route={route} />
    </div>
  );
};

export default App;
