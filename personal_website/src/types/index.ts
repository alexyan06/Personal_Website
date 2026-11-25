// Content types. The data lives in src/constants/index.tsx.
// Every `slug` is also the item's URL segment and its region id in art/approved/<scene>.regions.json.

export type ProjectType = {
  slug: string;
  imgSrc: string;
  title: string;
  tags: string[];
  projectLink: string;
  description: string;
};

export type ExperienceType = {
  slug: string;
  year: string;
  title: string;
  institute: string;
  location?: string;
  /** One-sentence summary. */
  desc: string;
  /** Longer bullets shown in the dialog and the list view. */
  highlights?: string[];
  stack?: string[];
  imgSrc: string;
};

export type CurrentlyItem = {
  slug: string;
  label: string;
  /** The rest of a long title, e.g. a book's subtitle. */
  subtitle?: string;
  /** Who it is by or where it is from: an author, a school and course number. */
  source?: string;
  type: 'learning' | 'reading' | 'course';
  since: string;
  /** True once it is done. */
  finished?: boolean;
};

export type SkillGroup = {
  /** Also the shelf's region id in the Skills scene. */
  slug: 'languages' | 'frameworks' | 'infrastructure' | 'tools';
  label: string;
  /**
   * The first ones name the things drawn on the shelf, left to right (6 potions, 6 scrolls,
   * 4 crates and barrels, 4 tools). Any after those show in the shelf's dialog and the list view only.
   */
  skills: string[];
};

export type AwardType = {
  slug: string;
  year?: string;
  title: string;
  institute: string;
  desc: string;
  /** Slug of the project this award was won with, if any. */
  project?: string;
};

export type ProfileType = {
  name: string;
  /** Short line for the status bar. */
  role: string;
  /** Longer line for the About dialog and list view. */
  headline: string;
  bio: string;
  links: {
    github: string;
    linkedin: string;
    resume: string;
    email: string;
  };
  education: {
    school: string;
    degree: string;
    location: string;
    graduation: string;
    coursework: string[];
  };
};
