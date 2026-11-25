// All portfolio content. Edit text here; the world (src/world/scenes.ts) and the list view read from it.
// Each `slug` ties an entry to its object in the pixel art and to its URL (e.g. #/projects/raft),
// so keep slugs in step with art/approved/<scene>.regions.json.
import type {
  AwardType,
  CurrentlyItem,
  ExperienceType,
  ProfileType,
  ProjectType,
  SkillGroup,
} from '@/types';

export type { CurrentlyItem } from '@/types';

const profile: ProfileType = {
  name: 'Alex Yan',
  role: 'SWE Intern @ Shopify',
  headline: 'Software Engineer Intern at Shopify. Computer Science at Purdue.',
  bio: "Hey, I'm Alex! I'm a CS junior at Purdue and a software engineer intern at Shopify in New York. I'm into distributed systems, backend, and AI development, and I like building things that are a bit playful. Thanks for stopping by my island. Say hi anytime :D",
  links: {
    github: 'https://github.com/alexyan06',
    linkedin: 'https://www.linkedin.com/in/alexyan06/',
    resume: '/images/Alex_Yan_Resume.pdf',
    email: 'mailto:alexyan2309@gmail.com',
  },
  education: {
    school: 'Purdue University',
    degree: 'B.S. Computer Science',
    location: 'West Lafayette, IN',
    graduation: 'May 2028',
    coursework: [
      'Data Structures & Algorithms',
      'Object-Oriented Programming',
      'Systems Programming',
      'Computer Architecture',
      'Programming in C',
      'Discrete Mathematics',
      'Linear Algebra',
      'Introduction to Statistics',
    ],
  },
};

// Workbench order in the Projects scene: three rows of three, left to right.
const projectsData: ProjectType[] = [
  {
    slug: 'raft',
    imgSrc: '',
    title: 'Raft',
    tags: ['Go', 'RPC', 'Distributed Systems'],
    projectLink: 'https://github.com/alexyan06/raft',
    description:
      'Raft consensus in Go for MIT’s distributed systems course (6.5840): leader election, log replication, and crash-durable state that keep replicas consistent through partitions, dropped messages, and restarts.',
  },
  {
    slug: 'perch',
    imgSrc: '',
    title: 'Perch',
    tags: ['Node.js', 'TypeScript', 'Electron', 'GenAI'],
    projectLink: 'https://github.com/alexyan06/Perch',
    description:
      'Desktop app that classifies your active work against a declared task and nudges you back on track through an AI-generated mascot companion.',
  },
  {
    slug: 'pyrotech',
    imgSrc: '',
    title: 'PyroTech',
    tags: ['Next.js', 'TypeScript', 'Gemini', 'WebSocket'],
    projectLink: 'https://github.com/alexyan06/Pyro_Tech',
    description:
      'AI wildfire simulation with Gemini multi-agent orchestration and a physics-based fire spread engine streamed live over WebSocket. Built at LA Hacks (UCLA).',
  },
  {
    slug: 'kvserver',
    imgSrc: '',
    title: 'K/V Server',
    tags: ['Go', 'RPC', 'Concurrency'],
    projectLink: 'https://github.com/alexyan06/mit6824-lab2-kvsrv1',
    description:
      'Linearizable key/value server and distributed lock in Go (MIT 6.5840), using version-conditioned puts to guarantee at-most-once writes over an unreliable network.',
  },
  {
    slug: 'mapreduce',
    imgSrc: '',
    title: 'MapReduce',
    tags: ['Go', 'RPC', 'Distributed Systems'],
    projectLink: 'https://github.com/alexyan06/mit6824-lab1-mapreduce',
    description:
      'Distributed MapReduce in Go (MIT 6.5840) with a coordinator and workers over RPC, timeout-based task reassignment, and atomic output writes.',
  },
  {
    slug: 'iris',
    imgSrc: '/images/Screenshot 2026-02-09 at 5.58.24 PM.png',
    title: 'Iris',
    tags: ['JavaScript', 'Chrome MV3', 'AWS Lambda', 'OpenAI'],
    projectLink: 'https://github.com/jacobselbo/iris',
    description:
      'Voice-driven Google Workspace assistant with wake-word detection and LLM intent planning, letting you run Docs, Gmail, and Calendar hands-free. Built at TartanHacks.',
  },
  {
    slug: 'accessprep',
    imgSrc: '/images/Screenshot 2026-01-09 at 2.07.47 PM.png',
    title: 'Access Prep',
    tags: ['React', 'TypeScript', 'Flask', 'LangChain'],
    projectLink: 'https://github.com/ryanvaby/Access-Prep',
    description:
      'Bilingual document platform guiding users through 5 immigration and financial aid pathways. 3rd place at the Capital One Tech Summit Hackathon.',
  },
  {
    slug: 'boilerfit',
    imgSrc: '/images/Screenshot 2026-01-14 at 10.44.02 AM.png',
    title: 'BoilerFit',
    tags: ['Full Stack', 'HealthTech'],
    projectLink: 'https://github.com/alexyan06/BoilerFit',
    description:
      'Full-stack fitness app for Purdue students with adaptive workout plans, regression-based performance tracking, and gym mapping.',
  },
  {
    slug: 'puritytest',
    imgSrc: '/images/Screenshot 2026-01-14 at 1.58.45 PM.png',
    title: 'Boiler Purity Test',
    tags: ['Web App'],
    projectLink: 'https://github.com/alexyan06/BoilerPurityTest',
    description:
      'Purdue campus life quiz that reached 1,500+ users within 48 hours of launch.',
  },
];

// Storefront order in the Experience scene, left to right. `highlights` come from the resume.
const experience: ExperienceType[] = [
  {
    slug: 'shopify',
    year: 'Sept. 2026 – Present',
    title: 'Software Engineer Intern',
    institute: 'Shopify',
    location: 'New York, NY',
    desc: 'Building bank-account ownership verification services in Ruby on Rails and GraphQL on the Payments Account Management team.',
    highlights: [
      'Own the EU rollout of Plaid bank-account linking for merchant payouts, replacing manual IBAN entry with bank-verified accounts. Launched in 5 countries, where 8,700+ merchants linked accounts in the first month and processed $4.7M+ in payment volume.',
      'Diagnosed a production bug in bank-account verification for merchants who linked several accounts at once and worked with Plaid on a configuration change, dropping daily verification failures by 78%.',
      'Traced a 2× jump in production errors on bank-account saves to a security-challenge rollout that logged every challenged merchant as a failure. The fix cut falsely logged errors by 99%.',
    ],
    stack: ['Ruby on Rails', 'GraphQL', 'TypeScript', 'Plaid'],
    imgSrc: '',
  },
  {
    slug: 'pnc',
    year: 'Jun. 2026 – Aug. 2026',
    title: 'Software Engineer Intern',
    institute: 'PNC Bank',
    location: 'Pittsburgh, PA',
    desc: 'Built validation features for auto loan applications and internal productivity agents on the Auto Lending Technology team.',
    highlights: [
      'Delivered Spring Boot validation features in Java for loan origination workflows on the application entry REST API, deployed through Red Hat OpenShift.',
      'Expanded JUnit coverage for validation logic and fixed intermittent Jenkins CI failures caused by race conditions in asynchronous tests.',
      'Built an LLM agent that catches convention and coverage gaps in unit tests before PR submission, cutting the PRs needed for approval by 55%.',
    ],
    stack: ['Java', 'Spring Boot', 'JUnit', 'Jenkins', 'OpenShift'],
    imgSrc: '',
  },
  {
    slug: 'purduestack',
    year: 'Sept. 2025 – May 2026',
    title: 'Full Stack Developer',
    institute: 'Purdue Stack',
    location: 'West Lafayette, IN',
    desc: 'Fall 2025: built a TA assignment optimization system for 150–200 TAs. Spring 2026: shipped a research collaboration platform in Next.js, FastAPI, and PostgreSQL.',
    highlights: [
      'Spring 2026: shipped a research collaboration platform in Next.js, FastAPI, and PostgreSQL for Purdue’s Statistics Department, with role-based dashboards, real-time messaging, and JWT authentication.',
      'Fall 2025: cut TA scheduling setup time 25% with a preference-weighted greedy matching algorithm in Python, powering an assignment system for 150–200 TAs per semester in Purdue’s Mathematics Department.',
    ],
    stack: ['Next.js', 'FastAPI', 'PostgreSQL', 'Python'],
    imgSrc: '/images/Screenshot 2026-01-14 at 1.07.20 PM.png',
  },
  {
    slug: 'rooh',
    year: 'Jun. 2025 – Dec. 2025',
    title: 'Software Engineer Intern',
    institute: 'Rooh (Berkeley SkyDeck Incubator)',
    location: 'Berkeley, CA (Remote)',
    desc: 'Built a real-time conversational AI app in React/Next.js with a Google Cloud STT/TTS pipeline, cutting response latency 20%.',
    highlights: [
      'Cut voice response latency 20% by parallelizing TTS and agent prompting ahead of STT in a Google Cloud STT → LLM → TTS pipeline for a real-time conversational AI app in React and Next.js.',
      'Architected Next.js backend data pipelines supporting a live AI simulator and async review tool, handling real-time audio streaming, buffering, and transcription.',
    ],
    stack: ['React', 'Next.js', 'Google Cloud'],
    imgSrc: '',
  },
];

// Shelf order in the Skills scene, left to right. The art has 6 potions, 6 scrolls, 4 crates and
// barrels, and 4 tools: the first skills of each list name those. The rest of a list (from the
// resume) shows in the shelf's dialog and in the list view.
const skills: SkillGroup[] = [
  { slug: 'languages', label: 'Languages', skills: ['Python', 'Java', 'TypeScript', 'Go', 'Ruby', 'SQL', 'JavaScript', 'C++', 'C', 'Bash'] },
  { slug: 'frameworks', label: 'Frameworks', skills: ['React', 'Next.js', 'Spring Boot', 'Rails', 'FastAPI', 'Node.js', 'Flask'] },
  { slug: 'infrastructure', label: 'Infrastructure', skills: ['PostgreSQL', 'AWS', 'Docker', 'GCP', 'MongoDB', 'SQLite', 'OpenShift', 'CI/CD'] },
  {
    slug: 'tools',
    label: 'Tools',
    skills: ['Git', 'GitHub Actions', 'GraphQL', 'JUnit', 'Jenkins', 'Postman', 'REST APIs', 'Claude Code', 'GitHub Copilot', 'Cursor'],
  },
];

// The library: three reading desks in a row, left to right. "since" is freeform: "May 2026", "this week", etc.
const currently: CurrentlyItem[] = [
  {
    slug: 'aiengineering',
    label: 'AI Engineering',
    subtitle: 'Building Applications with Foundation Models',
    source: 'Chip Huyen',
    type: 'reading',
    since: 'Nov. 2026 – Present',
  },
  { slug: 'distsys', label: 'Distributed Systems', source: 'MIT 6.5840', type: 'course', since: 'Jun. 2026 – Present' },
  {
    slug: 'ddia',
    label: 'Designing Data-Intensive Applications',
    source: 'Martin Kleppmann',
    type: 'reading',
    since: 'May 2026 – Aug. 2026',
    finished: true,
  },
];

// The trophy hall: five things. The three hackathons are the framed medals on the wall, and
// `yc` and `capitalone` are the two pedestals.
const awards: AwardType[] = [
  {
    slug: 'yc',
    year: 'Jul. 2026',
    title: 'Startup School Participant',
    institute: 'Y Combinator',
    desc: 'Selected for YC Startup School in San Francisco, an 8% acceptance rate out of 30,000+ applicants.',
  },
  {
    slug: 'capitalone',
    year: 'Jan. 2026',
    title: 'Tech Summit Participant',
    institute: 'Capital One',
    desc: 'Selected as 1 of 42 students nationally for a 5-day program, winning 3rd place in the hackathon.',
    project: 'accessprep',
  },
  {
    slug: 'lahacks',
    title: 'Hackathon project: PyroTech',
    institute: 'LA Hacks',
    desc: 'AI wildfire simulation with Gemini multi-agent orchestration and a physics-based fire spread engine streamed live over WebSocket. Built at LA Hacks (UCLA).',
    project: 'pyrotech',
  },
  {
    slug: 'tartanhacks',
    title: 'Hackathon project: Iris',
    institute: 'TartanHacks',
    desc: 'Voice-driven Google Workspace assistant with wake-word detection and LLM intent planning, letting you run Docs, Gmail, and Calendar hands-free. Built at TartanHacks.',
    project: 'iris',
  },
  {
    slug: 'boilermake',
    title: 'Hackathon project: BoilerFit',
    institute: 'BoilerMake',
    desc: 'Full-stack fitness app for Purdue students with adaptive workout plans, regression-based performance tracking, and gym mapping. Built at BoilerMake (Purdue).',
    project: 'boilerfit',
  },
];

export { profile, projectsData, experience, skills, currently, awards };
