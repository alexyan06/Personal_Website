import { ROOMS } from './config.mjs';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Rejects after `ms` so a stuck call can never hold the run up. */
export function withTimeout(promise, ms, what = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** "#/experience/shopify" -> "/experience/shopify"; "", "#" and "#/" -> "/". */
export function routeFromHash(hash) {
  let h = String(hash ?? '').replace(/^#/, '');
  if (h === '' || h === '/') return '/';
  if (!h.startsWith('/')) h = `/${h}`;
  h = h.replace(/\/+$/, '');
  return h || '/';
}

/** The scene a canonical route shows: "title", "world", a room id, or null for the list view. */
export function sceneForRoute(route) {
  if (route === '/') return 'title';
  if (route === '/world') return 'world';
  if (route === '/list') return null;
  const room = route.split('/')[1];
  return ROOMS.includes(room) ? room : null;
}

/** The dialog id a canonical route opens, or null. */
export function itemForRoute(route) {
  const parts = route.split('/').filter(Boolean);
  return parts.length === 2 && ROOMS.includes(parts[0]) ? parts[1] : null;
}

export function routeUrl(base, route, { debug = false } = {}) {
  const url = new URL(base);
  if (debug) url.searchParams.set('debug', 'hotspots');
  url.hash = route === '/' ? '' : `#${route}`;
  return url.toString();
}

export const slug = (s) =>
  String(s)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'stop';

export const fmt = (n) => (typeof n === 'number' ? String(Math.round(n * 100) / 100) : String(n));
export const fmtRect = (r) => (r ? `[${fmt(r.x)}, ${fmt(r.y)}, ${fmt(r.w)}x${fmt(r.h)}]` : 'none');
export const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export function summarize(problems, max = 4) {
  const head = problems.slice(0, max).join('; ');
  return problems.length > max ? `${head}; and ${problems.length - max} more` : head;
}

export const clip = (s, n = 160) => {
  const text = String(s ?? '').replace(/\s+/g, ' ').trim();
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
};

/** Lower-cased, whitespace-collapsed text with typographic quotes and dashes flattened, for "does this name appear". */
export const normText = (s) =>
  String(s ?? '')
    .normalize('NFKC')
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export function timestamp(date = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}
