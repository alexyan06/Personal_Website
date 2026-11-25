// Hash routes: parsing, formatting and the "up one level" rule. Pure functions; see ENGINE.md section 3.
import { MOVED_ITEMS, ROOM_NAMES, ROOM_ORDER, findDialog, findHotspot } from './scenes';
import type { Crumb, RoomId, Route } from './types';

const isRoom = (value: string): value is RoomId => (ROOM_ORDER as string[]).includes(value);

/**
 * One segment of the hash as text. A broken percent escape (`%`, `%E0%A4%A`) makes
 * decodeURIComponent throw; the segment is then kept as typed, matches no route and is replaced
 * like any other unknown one.
 */
function decodePart(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

/**
 * Reads a location hash. `canonical` is false when the hash was not a valid route and the
 * returned route is the nearest valid one; the caller should then replace the URL.
 */
export function parseRoute(hash: string): { route: Route; canonical: boolean } {
  const parts = hash
    .replace(/^#/, '')
    .split('/')
    .filter((part) => part.length > 0)
    .map((part) => decodePart(part).toLowerCase());

  if (parts.length === 0) return { route: { view: 'title' }, canonical: true };
  const [first, second, ...rest] = parts;

  if (first === 'world' && second === undefined) return { route: { view: 'world' }, canonical: true };
  if (first === 'list' && second === undefined) return { route: { view: 'list' }, canonical: true };
  if (isRoom(first)) {
    if (second === undefined) return { route: { view: 'room', room: first }, canonical: true };
    if (rest.length === 0 && findDialog(first, second)) {
      return { route: { view: 'room', room: first, item: second }, canonical: true };
    }
    // An item that has moved (#/about/portrait) leads to where it is now, not to the bare room.
    const moved = rest.length === 0 ? MOVED_ITEMS[first]?.[second] : undefined;
    if (moved && findDialog(first, moved)) return { route: { view: 'room', room: first, item: moved }, canonical: false };
    return { route: { view: 'room', room: first }, canonical: false };
  }
  return { route: { view: 'world' }, canonical: false };
}

/** The hash for a route, e.g. `#/experience/shopify`. The title screen is `#/`. */
export function formatRoute(route: Route): string {
  switch (route.view) {
    case 'title':
      return '#/';
    case 'world':
      return '#/world';
    case 'list':
      return '#/list';
    case 'room':
      return route.item ? `#/${route.room}/${route.item}` : `#/${route.room}`;
  }
}

/** The route without the `#`, e.g. `/experience/shopify`; `/` for the title. Used for `data-route`. */
export function routePath(route: Route): string {
  return formatRoute(route).slice(1);
}

export function sameRoute(a: Route, b: Route): boolean {
  return formatRoute(a) === formatRoute(b);
}

/** One level up: item → room → overworld. Null where there is nowhere to go up to. */
export function parentRoute(route: Route): Route | null {
  switch (route.view) {
    case 'room':
      return route.item ? { view: 'room', room: route.room } : { view: 'world' };
    case 'list':
      return { view: 'world' };
    case 'world':
    case 'title':
      return null;
  }
}

/** Breadcrumb for a route. Every crumb but the last links to its place. */
export function crumbsFor(route: Route): Crumb[] {
  const world: Crumb = { label: 'World', href: formatRoute({ view: 'world' }) };
  switch (route.view) {
    case 'title':
      return [];
    case 'world':
      return [{ label: 'World' }];
    case 'list':
      return [world, { label: 'List' }];
    case 'room': {
      const roomName = ROOM_NAMES[route.room];
      if (!route.item) return [world, { label: roomName }];
      const hotspot = findHotspot(route.room, route.item);
      return [
        world,
        { label: roomName, href: formatRoute({ view: 'room', room: route.room }) },
        { label: hotspot?.label ?? route.item },
      ];
    }
  }
}
