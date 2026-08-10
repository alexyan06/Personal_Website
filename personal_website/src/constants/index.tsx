import type { ExperienceType, ProjectType } from '@/types';

const projectsData: ProjectType[] = [
  {
    imgSrc: '',
    title: 'Perch',
    tags: ['Node.js', 'TypeScript', 'Electron', 'GenAI'],
    projectLink: 'https://github.com/alexyan06/Perch.git',
    description:
      'Desktop app that classifies your active work against a declared task and nudges you back on track through an AI-generated mascot companion.',
  },
  {
    imgSrc: '',
    title: 'K/V Store',
    tags: ['Go', 'RPC', 'Concurrency'],
    projectLink: '',
    description: 'Built a linearizable key/value server and distributed lock in Go for MIT’s distributed systems course (6.5840), using version-conditioned puts to guarantee at-most-once writes.',
  },
  {
    imgSrc: '',
    title: 'PyroTech',
    tags: ['Next.js', 'TypeScript', 'Gemini', 'WebSocket'],
    projectLink: 'https://github.com/alexyan06/Pyro_Tech',
    description:
      'AI wildfire simulation with Gemini multi-agent orchestration and a physics-based fire spread engine streamed live over WebSocket. Built at LAHacks (UCLA).',
  },
  {
    imgSrc: '/images/Screenshot 2026-02-09 at 5.58.24 PM.png',
    title: 'Iris',
    tags: ['JavaScript', 'Chrome MV3', 'AWS Lambda', 'OpenAI'],
    projectLink: 'https://github.com/jacobselbo/iris',
    description:
      'Voice-driven Google Workspace assistant with wake-word detection and LLM intent planning, letting you run Docs, Gmail, and Calendar hands-free. Built at TartanHacks.',
  },
  {
    imgSrc: '/images/Screenshot 2026-01-09 at 2.07.47 PM.png',
    title: 'Access Prep',
    tags: ['React', 'TypeScript', 'Flask', 'LangChain'],
    projectLink: 'https://github.com/ryanvaby/Access-Prep',
    description:
      'Bilingual document platform guiding users through 5 immigration and financial aid pathways. 3rd place at the Capital One Tech Summit Hackathon.',
  },
  {
    imgSrc: '/images/Screenshot 2026-01-14 at 10.44.02 AM.png',
    title: 'BoilerFit',
    tags: ['Full Stack', 'HealthTech'],
    projectLink: 'https://github.com/alexyan06/BoilerFit',
    description:
      'Full-stack fitness app for Purdue students with adaptive workout plans, regression-based performance tracking, and gym mapping.',
  },
  {
    imgSrc: '/images/Screenshot 2026-01-14 at 1.58.45 PM.png',
    title: 'Boiler Purity Test',
    tags: ['Web App'],
    projectLink: 'https://github.com/alexyan06/BoilerPurityTest',
    description:
      'Purdue campus life quiz that reached 1,500+ users within 48 hours of launch.',
  },
];

const experience: ExperienceType[] = [
  {
    year: 'Sept. 2026 – Present',
    title: 'Software Engineer Intern',
    institute: 'Shopify',
    desc: 'Building buyer identity and session services on the Shop Recognition & Continuity team.',
    imgSrc: '',
  },
  {
    year: 'Jun. 2026 – Aug. 2026',
    title: 'Software Engineer Intern',
    institute: 'PNC Bank',
    desc: 'Built validation features for auto loan applications and internal productivity agents on the Auto Lending Technology team.',
    imgSrc: '',
  },
  {
    year: 'Jul. 2026',
    title: 'Startup School Participant',
    institute: 'Y Combinator',
    desc: 'Selected for YC Startup School in San Francisco, an 8% acceptance rate out of 30,000+ applicants.',
    imgSrc: '',
  },
  {
    year: 'Sept. 2025 – May 2026',
    title: 'Full Stack Developer',
    institute: 'Purdue Stack',
    desc: 'Fall 2025: built a TA assignment optimization system for 150–200 TAs. Spring 2026: shipped a research collaboration platform in Next.js, FastAPI, and PostgreSQL.',
    imgSrc: '/images/Screenshot 2026-01-14 at 1.07.20 PM.png',
  },
  {
    year: 'Jan. 2026',
    title: 'Tech Summit Participant',
    institute: 'Capital One',
    desc: 'Selected as 1 of 42 students nationally for a 5-day program, winning 3rd place in the hackathon.',
    imgSrc: '/images/C1_LOGO.png',
  },
  {
    year: 'Jun. 2025 – Dec. 2025',
    title: 'Software Engineer Intern',
    institute: 'Rooh (Berkeley SkyDeck Incubator)',
    desc: 'Built a real-time conversational AI app in React/Next.js with a Google Cloud STT/TTS pipeline, cutting response latency 20%.',
    imgSrc: '',
  },
];

// Add new items here. "since" is freeform — "May 2026", "this week", etc.
export type CurrentlyItem = {
  label: string;
  type: 'learning' | 'reading';
  since: string;
};

const currently: CurrentlyItem[] = [
  { label: 'Ruby',                                                 type: 'learning', since: 'August 2026 - Present'},
  { label: 'Go',                                               type: 'learning', since: 'May 2026 - Present' },
  { label: 'Designing Data-Intensive Applications',                type: 'reading',  since: 'May 2026 - August 2026' },
];

export { projectsData, experience, currently };
