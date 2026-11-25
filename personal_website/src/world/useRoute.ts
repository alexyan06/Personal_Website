// The current hash route, and the one way to change it. See ENGINE.md section 3.
import { useSyncExternalStore } from 'react';
import { formatRoute, parseRoute } from './routes';
import type { Route } from './types';

const TITLE_HASHES = new Set(['', '#', '#/']);

const listeners = new Set<() => void>();

/**
 * Replaces a hash that is not a valid route (or is a sloppy spelling of one) with its canonical
 * form. A replace, never a push: the bad URL must not stay in history and trap the Back button.
 */
function normalize(): void {
  const hash = window.location.hash;
  const { route } = parseRoute(hash);
  if (route.view === 'title' && TITLE_HASHES.has(hash)) return;
  const wanted = formatRoute(route);
  if (hash !== wanted) window.history.replaceState(window.history.state, '', wanted);
}

function emit(): void {
  normalize();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('hashchange', emit);
    window.addEventListener('popstate', emit);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('hashchange', emit);
      window.removeEventListener('popstate', emit);
    }
  };
}

const getHash = () => window.location.hash;

/** Goes to a route. Every navigation pushes a history entry, including "up". */
export function navigate(route: Route): void {
  const hash = formatRoute(route);
  if (window.location.hash === hash) return;
  window.location.hash = hash;
  emit(); // do not wait for the hashchange event: render the new route in this tick
}

/** The route in the address bar right now (for event handlers, which must not use a stale render). */
export function readRoute(): Route {
  return parseRoute(window.location.hash).route;
}

// Fix the URL the page was opened with before anything renders.
if (typeof window !== 'undefined') normalize();

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash);
  return parseRoute(hash).route;
}
