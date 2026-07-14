import type { ExperienceType, ProjectType } from '@/types';

const projectsData: ProjectType[] = [
  {
    imgSrc: '',
    title: 'Perch',
    tags: ['Node.js', 'TypeScript', 'Electron', 'GenAI'],
    projectLink: 'https://github.com/alexyan06/Pyro_Tech',
    description:
      'A desktop app that watches your active work session, classifies what you\'re actually doing against a task you declared at the start, and nudges you back on track through an AI generated mascot companion',
  },
  {
    imgSrc: '',
    title: 'PyroTech',
    tags: ['Next.js', 'TypeScript', 'Gemini', 'WebSocket'],
    projectLink: 'https://github.com/alexyan06/Pyro_Tech',
    description:
      'AI wildfire simulation with Gemini multi-agent orchestration and a physics-based fire spread engine streamed live via WebSocket. Built during LAhacks (UCLA Hackathon)',
  },
  {
    imgSrc: '/images/Screenshot 2026-02-09 at 5.58.24 PM.png',
    title: 'Iris',
    tags: ['JavaScript', 'Chrome MV3', 'AWS Lambda', 'OpenAI'],
    projectLink: 'https://github.com/jacobselbo/iris',
    description:
      "Voice-driven Google Workspace assistant built at CMU's 24-hour hackathon with wake-word detection and LLM-driven intent planning. Allows you to work with google docs, gmail, and calendar with just your voice.",
  },
  {
    imgSrc: '/images/Screenshot 2026-01-09 at 2.07.47 PM.png',
    title: 'Access Prep',
    tags: ['React', 'TypeScript', 'Flask', 'LangChain'],
    projectLink: 'https://github.com/ryanvaby/Access-Prep',
    description:
      '3rd place at Capital One Tech Summit Hackathon. Bilingual document platform that validated and guided required documents based on which underrepresented population you belonged to, across 5 immigration and financial aid pathways.',
  },
  {
    imgSrc: '/images/Screenshot 2026-01-14 at 10.44.02 AM.png',
    title: 'BoilerFit',
    tags: ['Full Stack', 'HealthTech'],
    projectLink: 'https://github.com/alexyan06/BoilerFit',
    description:
      'Full-stack fitness app with adaptive workout plans, linear regression performance tracking, and gym mapping for Purdue students.',
  },
  {
    imgSrc: '/images/Screenshot 2026-01-14 at 1.58.45 PM.png',
    title: 'Boiler Purity Test',
    tags: ['Web App'],
    projectLink: 'https://github.com/alexyan06/BoilerPurityTest',
    description:
      'Purdue campus life quiz that gained 1,500+ (!!!) users in 48 hours of deployment.',
  },
];

const experience: ExperienceType[] = [
  {
    year: 'Sept. 2026 – Dec. 2026',
    title: 'Software Engineering Intern',
    institute: 'Shopify',
    desc: 'Incoming Fall 2026 Intern',
    imgSrc: '',
  },
  {
    year: 'Jun. 2026 – Aug. 2026',
    title: 'Software Engineering Intern',
    institute: 'PNC Bank',
    desc: 'Working on the Auto Lending Technology team.',
    imgSrc: '',
  },
  {
    year: 'Jul. 2026',
    title: 'Startup School Participant',
    institute: 'Y Combinator',
    desc: '• Incoming participant in YC Startup School in San Francisco.\n• 8% acceptance rate out of 30,000+ applicants.',
    imgSrc: '',
  },
  {
    year: 'Sept. 2025 – May 2026',
    title: 'Full Stack Developer',
    institute: 'Purdue Stack',
    desc: '• Fall 2025: built a TA assignment optimization system for 150–200 TAs using a preference-weighted greedy algorithm.\n• Spring 2026: shipped a research collaboration platform with role-based dashboards, real-time messaging, and JWT auth in Next.js, FastAPI, and PostgreSQL.',
    imgSrc: '/images/Screenshot 2026-01-14 at 1.07.20 PM.png',
  },
  {
    year: 'Jan. 2026',
    title: 'Tech Summit Participant',
    institute: 'Capital One',
    desc: 'Selected as 1 of 42 students nationally for a competitive 5-day program. Won 3rd place in the hackathon.',
    imgSrc: '/images/C1_LOGO.png',
  },
  {
    year: 'Jun. 2025 – Dec. 2025',
    title: 'Software Engineering Intern',
    institute: 'Rooh (Berkeley SkyDeck Incubator)',
    desc: '• Built a real-time conversational AI app in React/Next.js with Google Cloud STT/TTS, reducing average response latency by 20%.\n• Architected Next.js backend data pipelines for a live AI simulator and async review tool, handling real-time audio streaming and transcription at scale.\n• Designed a React analytics dashboard generating session-based delivery and tone metrics for coach feedback.',
    imgSrc: '/images/Screenshot 2026-01-14 at 1.08.54 PM.png',
  },
];

// Add new items here. "since" is freeform — "May 2026", "this week", etc.
export type CurrentlyItem = {
  label: string;
  type: 'learning' | 'reading';
  since: string;
};

const currently: CurrentlyItem[] = [
  { label: 'GoLang',                                               type: 'learning', since: 'May 2026 - Present' },
  { label: 'Designing Data-Intensive Applications',                type: 'reading',  since: 'May 2026 - Present' },
];

export { projectsData, experience, currently };
