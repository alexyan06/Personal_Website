// The music player's songs and its one audio element.
//
// Songs are whatever MP3 files are in music/private/ and music/published/ when the site is built
// (see music/README.md). music/private/ is git-ignored, so on the live site only the published
// ones exist. The files are not downloaded until they are played.
//
// Browsers refuse to start sound before the visitor has clicked or pressed a key, and Safari wants
// play() called from inside that event. So start() is called straight from the gesture handlers
// (PRESS START, or the first click or key for someone who arrived on a deep link), never from an effect.
import { useSyncExternalStore } from 'react';

export type Song = {
  url: string;
  title: string;
  /** Shown under the title: the game, album or artist, or the credit a licence asks for. */
  from: string | null;
  /** In music/private/: plays on this computer only. */
  local: boolean;
};

type Listed = { file?: unknown; title?: unknown; from?: unknown; credit?: unknown };

const files = import.meta.glob<string>('../../music/{private,published}/*.mp3', { eager: true, query: '?url', import: 'default' });
const lists = import.meta.glob<{ songs?: Listed[] }>('../../music/{private,published}/playlist.json', { eager: true, import: 'default' });
const logos = import.meta.glob<string>('../../music/logo.{png,webp,jpg,jpeg,svg,gif}', { eager: true, query: '?url', import: 'default' });

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** "my-song_2.mp3" -> "My Song 2" */
const nameFromFile = (file: string) =>
  file
    .replace(/\.mp3$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

function songsIn(folder: 'private' | 'published'): Song[] {
  const prefix = `../../music/${folder}/`;
  const urls = new Map(
    Object.entries(files)
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, url]) => [path.slice(prefix.length), url]),
  );
  const out: Song[] = [];
  // Listed songs first, in the list's order; then any other file in the folder, by name.
  for (const entry of lists[`${prefix}playlist.json`]?.songs ?? []) {
    const file = text(entry.file);
    const url = file ? urls.get(file) : undefined;
    if (!file || !url) continue;
    urls.delete(file);
    out.push({ url, title: text(entry.title) ?? nameFromFile(file), from: text(entry.credit) ?? text(entry.from), local: folder === 'private' });
  }
  for (const file of [...urls.keys()].sort()) out.push({ url: urls.get(file)!, title: nameFromFile(file), from: null, local: folder === 'private' });
  return out;
}

/** Play order: this computer's own songs, then the published ones. */
export const songs: Song[] = [...songsIn('private'), ...songsIn('published')];

/** music/logo.*: the picture the player shows, if there is one. */
export const logoUrl: string | null = Object.values(logos)[0] ?? null;

// ---- state ----------------------------------------------------------------------------------------

export type MusicState = {
  index: number;
  /** The visitor's choice, kept between visits. */
  on: boolean;
  /** Sound is coming out. */
  playing: boolean;
};

const PREF = 'music';
function readPref(): boolean {
  try {
    return window.localStorage.getItem(PREF) !== 'off';
  } catch {
    return true;
  }
}
function writePref(on: boolean) {
  try {
    window.localStorage.setItem(PREF, on ? 'on' : 'off');
  } catch {
    // private window or storage blocked: the choice lasts for this visit only
  }
}

let state: MusicState = { index: 0, on: readPref(), playing: false };
const listeners = new Set<() => void>();
function set(patch: Partial<MusicState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/** A gesture has started the music at least once, so it may be resumed without one. */
let started = false;
/** Paused from outside: the list view, the rotate screen, a hidden tab. */
let held = false;
/** Songs that failed in a row, so a folder of broken files does not spin forever. */
let failures = 0;
let audio: HTMLAudioElement | null = null;

function element(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'none';
  audio.addEventListener('ended', () => step(1));
  audio.addEventListener('playing', () => {
    failures = 0;
    set({ playing: true });
  });
  audio.addEventListener('pause', () => set({ playing: false }));
  audio.addEventListener('error', () => {
    set({ playing: false });
    if (++failures < songs.length) step(1);
  });
  return audio;
}

function play() {
  const song = songs[state.index];
  if (!song || held) return;
  const el = element();
  if (el.getAttribute('src') !== song.url) el.src = song.url;
  // Refused (no gesture yet) or interrupted by the next song: either way there is nothing to do.
  el.play().catch(() => {});
}

function step(by: number) {
  if (!songs.length) return;
  set({ index: (state.index + by + songs.length) % songs.length });
  if (state.on && started) play();
}

/** Starts the music if the visitor has it on. Call from inside a click or key handler. */
export function startMusic() {
  if (!songs.length || !state.on) return;
  started = true;
  if (!state.playing) play();
}

/** The next song. From a button, so it also counts as the gesture that starts the sound. */
export function nextSong() {
  started = true;
  step(1);
}

/** The visitor's on/off switch. */
export function toggleMusic() {
  const on = !state.on;
  writePref(on);
  set({ on });
  if (on) {
    started = true;
    play();
  } else {
    audio?.pause();
  }
}

/** Holds the music while its player is out of reach, and lets it go on afterwards. */
export function holdMusic(hold: boolean) {
  if (held === hold) return;
  held = hold;
  if (hold) audio?.pause();
  else if (state.on && started) play();
}

export function useMusic(): MusicState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
