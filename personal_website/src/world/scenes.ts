// Joins the art (images and measured regions) with the content in src/constants.
// Each scene lists its hotspots in Tab order: left to right, top to bottom, the doorway last.
import { awards, currently, experience, profile, projectsData, skills } from '@/constants';
import { grounds, images, mascot, regions, titleOverworldRect } from './assets';
import type { DialogContent, DialogHotspot, Hotspot, Region, RoomId, SceneDef, SceneId } from './types';

/** Rooms in content order (also the order of the list view). */
export const ROOM_ORDER: RoomId[] = ['about', 'experience', 'projects', 'skills', 'learning', 'misc'];

export const ROOM_NAMES: Record<RoomId, string> = {
  about: 'About',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Skills',
  learning: 'Learning',
  misc: 'Misc',
};

/** What each overworld location is, for its accessible name. */
const ROOM_PLACES: Record<RoomId, string> = {
  about: 'the cottage',
  experience: 'the town',
  projects: 'the workshop',
  skills: 'the item shop',
  learning: 'the library',
  misc: 'the trophy hall',
};

/** Overworld locations in Tab order: left to right, top to bottom on the map. */
const WORLD_TAB_ORDER: RoomId[] = ['learning', 'projects', 'skills', 'about', 'experience', 'misc'];

/** Fill color of the dive into each room: the building's main color on the map, from the NES palette like the rest of the UI. */
const ROOM_FLASH: Record<RoomId, string> = {
  about: '#A81000',
  experience: '#7C7C7C',
  projects: '#AC7C00',
  skills: '#AC7C00',
  learning: '#7C7C7C',
  misc: '#FCFCFC',
};

/** Looks up a measured region. A missing one is an art/content mismatch: report it and skip the hotspot. */
function regionOf(scene: Exclude<SceneId, 'title'>, id: string): Region | undefined {
  const region = regions[scene][id];
  if (!region) console.error(`[world] No region "${id}" in ${scene === 'world' ? 'overworld' : scene}.regions.json`);
  return region;
}

/** A hotspot before its region is attached. */
type Spec<T extends Hotspot = Hotspot> = T extends unknown ? Omit<T, 'region'> : never;

/**
 * The accessible name has to contain the words shown on the art, so "click About me" finds the
 * control by voice (WCAG 2.5.3). A label with no letters or digits ("???") is a symbol and is exempt.
 */
function checkName(scene: string, spec: { id: string; label: string; name: string }): void {
  if (!/[a-z0-9]/i.test(spec.label)) return;
  if (!spec.name.toLowerCase().includes(spec.label.toLowerCase())) {
    console.error(`[world] ${scene} "${spec.id}": the accessible name "${spec.name}" does not contain its label "${spec.label}"`);
  }
}

/** Builds hotspots, dropping any whose region is missing. */
function place(scene: Exclude<SceneId, 'title'>, specs: Spec[]): Hotspot[] {
  const out: Hotspot[] = [];
  for (const spec of specs) {
    checkName(scene, spec);
    const region = regionOf(scene, spec.id);
    if (region) out.push({ ...spec, region } as Hotspot);
  }
  return out;
}

/** `{ fullName }` where the label on the art is a short form, nothing where it is the whole name. */
const fullNameOf = (label: string, whole: string) => (label === whole ? {} : { fullName: whole });

const door: Spec = {
  kind: 'scene',
  id: 'door',
  label: 'Exit',
  name: 'Exit to the overworld',
  to: { view: 'world' },
  labelMode: 'always',
};

function dialog(id: string, label: string, name: string, content: DialogContent, more: { fullName?: string } = {}): Spec<DialogHotspot> {
  return { kind: 'dialog', id, label, name, dialog: content, labelMode: 'always', ...more };
}

function link(id: string, label: string, href: string, external: boolean): Spec {
  return { kind: 'link', id, label, name: external ? `${label} (opens in a new tab)` : label, href, external, labelMode: 'always' };
}

const projectBySlug = new Map(projectsData.map((p) => [p.slug, p]));

// --- About: the cottage -------------------------------------------------------------------

/** The character's hotspot: its region in about.regions.json and the last part of #/about/me. */
const ME = 'me';

const aboutHotspots = place('about', [
  dialog('diploma', 'Education', `Education: ${profile.education.school}`, {
    title: profile.education.school,
    subtitle: profile.education.degree,
    meta: `${profile.education.location} · Graduating ${profile.education.graduation}`,
    paragraphs: ['Relevant coursework'],
    tags: profile.education.coursework,
  }),
  link('corkboard', 'LinkedIn', profile.links.linkedin, true),
  link('computer', 'GitHub', profile.links.github, true),
  link('scroll', 'Resume', profile.links.resume, true),
  // Alex himself, standing on the rug (the `character` of the scene, below). He opens About me.
  dialog(ME, 'About me', `About me: ${profile.name}`, {
    title: profile.name,
    subtitle: profile.headline,
    paragraphs: [profile.bio],
    links: [
      { label: 'GitHub', href: profile.links.github, external: true },
      { label: 'LinkedIn', href: profile.links.linkedin, external: true },
      { label: 'Resume', href: profile.links.resume, external: true },
      { label: 'Email', href: profile.links.email },
    ],
  }),
  link('mailbox', 'Email', profile.links.email, false),
  door,
]);

// --- Experience: the town street ----------------------------------------------------------

/** Short storefront names where the full one is too long for its plate. */
const EXPERIENCE_LABELS: Record<string, string> = { rooh: 'Rooh' };

const experienceHotspots = place('experience', [
  ...experience.map((job) => {
    const label = EXPERIENCE_LABELS[job.slug] ?? job.institute;
    return dialog(
      job.slug,
      label,
      `${job.institute}: ${job.title}`,
      {
        title: job.institute,
        subtitle: job.title,
        meta: [job.year, job.location].filter(Boolean).join(' · '),
        paragraphs: job.highlights?.length ? undefined : [job.desc],
        bullets: job.highlights,
        tags: job.stack,
      },
      fullNameOf(label, job.institute),
    );
  }),
  door,
]);

// --- Projects: the workshop ---------------------------------------------------------------

const PROJECT_LABELS: Record<string, string> = { puritytest: 'Purity Test' };

const projectHotspots = place('projects', [
  ...projectsData.map((project) => {
    const label = PROJECT_LABELS[project.slug] ?? project.title;
    return dialog(
      project.slug,
      label,
      `${project.title} project`,
      {
        title: project.title,
        paragraphs: [project.description],
        tags: project.tags,
        links: [{ label: 'View on GitHub', href: project.projectLink, external: true }],
      },
      fullNameOf(label, project.title),
    );
  }),
  door,
]);

// --- Skills: the item shop ----------------------------------------------------------------

/** Short shelf names where the full one is wider than its shelf. */
const SHELF_LABELS: Record<string, string> = { infrastructure: 'Infra' };

const skillHotspots: Hotspot[] = [];
for (const group of skills) {
  const shelf = regionOf('skills', group.slug);
  if (!shelf) continue;
  const shelfLabel = SHELF_LABELS[group.slug] ?? group.label;
  const shelfSpec = { id: group.slug, label: shelfLabel, name: `${group.label}: ${group.skills.join(', ')}` };
  checkName('skills', shelfSpec);
  skillHotspots.push({
    kind: 'dialog',
    ...shelfSpec,
    ...fullNameOf(shelfLabel, group.label),
    region: shelf,
    dialog: { title: group.label, tags: group.skills },
    labelMode: 'always',
  });
  // The first skills name the things drawn on the shelf; any more show in the dialog only.
  const items = shelf.items ?? [];
  if (items.length > group.skills.length) {
    console.error(`[world] Skills shelf "${group.slug}" has ${items.length} items in the art but only ${group.skills.length} skills in the content`);
  }
  items.slice(0, group.skills.length).forEach((box, index) => {
    const itemSpec = { id: `${group.slug}-${index}`, label: group.skills[index], name: `${group.skills[index]} (${group.label})` };
    checkName('skills', itemSpec);
    skillHotspots.push({ kind: 'item', ...itemSpec, region: { box }, parent: group.slug, labelMode: 'active' });
  });
}
skillHotspots.push(...place('skills', [door]));

// --- Learning: the library ----------------------------------------------------------------

/** Short names where the full one is wider than the gap between two desks. */
const LEARNING_LABELS: Record<string, string> = { ddia: 'DDIA' };

function learningStatus(item: (typeof currently)[number]): string {
  if (item.finished) return item.type === 'reading' ? 'Finished reading' : 'Finished';
  if (item.type === 'course') return 'Currently taking';
  return item.type === 'reading' ? 'Currently reading' : 'Currently learning';
}

const learningHotspots = place('learning', [
  ...currently.map((item) => {
    const label = LEARNING_LABELS[item.slug] ?? item.label;
    const status = learningStatus(item);
    // A short label leads the name, so the name still starts with what is shown on the art.
    const name = label === item.label ? `${item.label}: ${status}` : `${label}: ${item.label}, ${status.toLowerCase()}`;
    return dialog(
      item.slug,
      label,
      name,
      { title: item.label, subtitle: status, meta: [item.source, item.since].filter(Boolean).join(' · '), paragraphs: item.subtitle ? [item.subtitle] : undefined },
      fullNameOf(label, item.label),
    );
  }),
  door,
]);

// --- Misc: the trophy hall ----------------------------------------------------------------

/** The medals on the wall (left to right), then the pedestals. */
const MISC_TAB_ORDER = ['lahacks', 'tartanhacks', 'boilermake', 'yc', 'capitalone'];

const awardSpecs = MISC_TAB_ORDER.flatMap((slug) => {
  const award = awards.find((a) => a.slug === slug);
  if (!award) return [];
  const project = award.project ? projectBySlug.get(award.project) : undefined;
  return [
    dialog(award.slug, award.institute, `${award.institute}: ${award.title}`, {
      title: award.institute,
      subtitle: award.title,
      meta: award.year,
      paragraphs: [award.desc],
      links: project ? [{ label: `See ${project.title} in the workshop`, href: `#/projects/${project.slug}` }] : undefined,
    }),
  ];
});

const miscHotspots = place('misc', [...awardSpecs, door]);

// --- The overworld --------------------------------------------------------------------------

const worldHotspots = place(
  'world',
  WORLD_TAB_ORDER.map(
    (room): Spec => ({
      kind: 'scene',
      id: room,
      label: ROOM_NAMES[room],
      name: `${ROOM_NAMES[room]}: enter ${ROOM_PLACES[room]}`,
      to: { view: 'room', room },
      labelMode: 'always',
    }),
  ),
);

// --- Scenes ---------------------------------------------------------------------------------

const roomHotspots: Record<RoomId, Hotspot[]> = {
  about: aboutHotspots,
  experience: experienceHotspots,
  projects: projectHotspots,
  skills: skillHotspots,
  learning: learningHotspots,
  misc: miscHotspots,
};

function room(id: RoomId): SceneDef {
  return { id, name: ROOM_NAMES[id], image: images[id], ground: 'grass', flash: ROOM_FLASH[id], hotspots: roomHotspots[id] };
}

const sea = grounds.ocean.color;

export const scenes: Record<SceneId, SceneDef> = {
  // The title screen is the sea with the overworld's own picture drawn small on it.
  title: { id: 'title', name: 'Title screen', image: images.title, imageBox: titleOverworldRect, ground: 'ocean', flash: sea, hotspots: [] },
  world: { id: 'world', name: 'Overworld', image: images.world, ground: 'ocean', flash: sea, hotspots: worldHotspots },
  // The character is drawn only when the art has a place for him to be clicked.
  about: { ...room('about'), character: aboutHotspots.some((h) => h.id === ME) ? { hotspot: ME, sprite: mascot } : undefined },
  experience: room('experience'),
  projects: room('projects'),
  skills: room('skills'),
  learning: room('learning'),
  misc: room('misc'),
};

/** The hotspot with this id in a scene. */
export function findHotspot(scene: SceneId, id: string): Hotspot | undefined {
  return scenes[scene].hotspots.find((h) => h.id === id);
}

/** The dialog hotspot behind #/<room>/<item>, if that item exists. */
export function findDialog(roomId: RoomId, item: string): DialogHotspot | undefined {
  const hotspot = findHotspot(roomId, item);
  return hotspot?.kind === 'dialog' ? hotspot : undefined;
}

/** Where a room sits on the overworld: the target of the dive into it. */
export function worldRegionOf(roomId: RoomId): Region | undefined {
  return regions.world[roomId];
}

/**
 * Items that have moved: the old id of each, and where it lives now. A link to the old address is
 * sent on to the new one (routes.ts), so it never ends in the bare room.
 */
export const MOVED_ITEMS: Partial<Record<RoomId, Record<string, string>>> = {
  // The framed portrait on the cottage wall became the character standing in the room.
  about: { portrait: ME },
};
