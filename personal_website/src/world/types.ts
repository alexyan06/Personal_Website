// Types for the zoomable world. See ENGINE.md for how the pieces fit together.

export type RoomId = 'about' | 'experience' | 'projects' | 'skills' | 'learning' | 'misc';
export type SceneId = 'title' | 'world' | RoomId;

/** [x, y, w, h] in scene units: the 320x180 grid every picture is drawn across. */
export type Box = [x: number, y: number, w: number, h: number];

/** One entry of art/approved/<scene>.regions.json. */
export type Region = {
  /** The click area. */
  box: Box;
  /** A blank label plate drawn in the art for this object. */
  plate?: Box;
  /** Individual things on a Skills shelf, left to right. */
  items?: Box[];
};

export type Route =
  | { view: 'title' }
  | { view: 'world' }
  | { view: 'room'; room: RoomId; item?: string }
  | { view: 'list' };

export type Crumb = {
  label: string;
  /** Missing on the last crumb (the current place). */
  href?: string;
};

export type DialogLink = {
  label: string;
  href: string;
  /** Opens in a new tab. */
  external?: boolean;
};

export type DialogContent = {
  title: string;
  /** What a screen reader says for the title where the title is not a word ("???"). */
  spokenTitle?: string;
  subtitle?: string;
  /** Dates, place and similar. */
  meta?: string;
  paragraphs?: string[];
  bullets?: string[];
  tags?: string[];
  links?: DialogLink[];
};

type HotspotBase = {
  /** Region id; also the `data-hotspot` value and, for dialogs, the URL segment. */
  id: string;
  /** Short visible label in natural case; the UI sets the case. */
  label: string;
  /** The whole name where `label` is a short form of it. The tab title uses it. */
  fullName?: string;
  /** Accessible name. */
  name: string;
  region: Region;
  /** `always`: the label is always shown. `active`: only while hovered or focused. */
  labelMode: 'always' | 'active';
};

/** Navigates to another scene: an overworld location or a doorway. */
export type SceneHotspot = HotspotBase & { kind: 'scene'; to: Route };
/** Opens a dialog at #/<room>/<id>. */
export type DialogHotspot = HotspotBase & { kind: 'dialog'; dialog: DialogContent };
/** A real link. */
export type LinkHotspot = HotspotBase & { kind: 'link'; href: string; external: boolean };
/** One thing on a Skills shelf; activating it opens the shelf's dialog. */
export type ItemHotspot = HotspotBase & { kind: 'item'; parent: string };

export type Hotspot = SceneHotspot | DialogHotspot | LinkHotspot | ItemHotspot;

/** The two grounds of art/approved/hd/backdrops.json. */
export type GroundId = 'ocean' | 'grass';

/** The ground that covers the whole view behind a scene's picture. */
export type Ground = {
  id: GroundId;
  /** The tile's base color: what shows until the tile has loaded, and the page background. */
  color: string;
  /** Size of one tile in scene units. */
  tile: [w: number, h: number];
  /** URLs of the tile's frames. One frame is a still ground; two are the sea's idle motion. */
  frames: string[];
};

/** Frames of a sprite sheet, in the order they play, and how fast. */
export type SpriteAnimation = { frames: number[]; fps: number };

/** A sprite sheet: one row of equal frames (art/approved/hd/mascot.json). */
export type Sprite = {
  /** URL of the sheet. */
  image: string;
  /** Size of one frame in the sheet's own pixels. */
  frame: [w: number, h: number];
  /** How many frames the row holds. */
  count: number;
  /** Size of one frame in scene units. */
  size: [w: number, h: number];
  /** Where the bottom center of a frame stands in its scene, in scene units. */
  anchor: [x: number, y: number];
  animations: { idle: SpriteAnimation; wave: SpriteAnimation };
};

/** A character drawn in a scene. It is the look of one hotspot, which gives it its name and what it opens. */
export type Character = {
  /** Id of the hotspot it stands for. */
  hotspot: string;
  sprite: Sprite;
};

/** The smoke of a picture's chimneys: a sheet of puffs and where the chimneys are (art/approved/hd/smoke.json). */
export type SmokeSheet = {
  /** URL of the sheet: one row of equal frames, a puff as it ages, youngest first. */
  image: string;
  /** URL of the picture whose chimneys these are. The smoke is drawn wherever that picture is. */
  over: string;
  /** How many frames the row holds. */
  count: number;
  /** Size of one frame in scene units. A puff's middle is the middle of its frame. */
  size: [w: number, h: number];
  /** Where each chimney's smoke comes out, in the picture's scene units: the top of its opening. */
  chimneys: [x: number, y: number][];
};

export type SceneDef = {
  id: SceneId;
  /** Human name, announced on arrival and used in the breadcrumb. */
  name: string;
  /** URL of the scene's picture, drawn across the 320x180 scene units. */
  image: string;
  /** Where the picture goes, in scene units, when it does not fill the scene (the title's small island). */
  imageBox?: Box;
  /** The ground behind the picture; its color is also the page background while this scene shows. */
  ground: GroundId;
  /** Fill color of the overworld-to-room transition. */
  flash: string;
  /** In Tab order: left to right, top to bottom, the doorway last. */
  hotspots: Hotspot[];
  /** Someone who stands in the scene. */
  character?: Character;
};
