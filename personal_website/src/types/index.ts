export type ProjectType = {
  imgSrc: string;
  title: string;
  tags: string[];
  projectLink: string;
  description: string;
};

export type ExperienceType = {
  year: string;
  title: string;
  institute: string;
  desc: string;
  imgSrc: string;
};

export type PurdueExperience = {
  year: string;
  title: string;
  institute: string;
  desc: string;
  courses: string;
  imgSrc: string;
};

export type ToolsType = {
  imgSrc: string;
  label: string;
};

export type LinksType = {
  label: string;
  link: string;
  icon: React.ElementType;
};
