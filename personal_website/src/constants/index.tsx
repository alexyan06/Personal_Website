import type {
  ExperienceType,
  LinksType,
  ProjectType,
  PurdueExperience,
  ToolsType,
} from '@/types';

/**
 * Assets
 */
import {
  Briefcase,
  FileText,
  Github,
  Home,
  Linkedin,
  Mail,
  User,
} from 'lucide-react';

const navLinks: LinksType[] = [
  { label: 'Home', link: '#hero', icon: Home },
  { label: 'Projects', link: '#projects', icon: Briefcase },
  { label: 'About', link: '#about', icon: User },
  { label: 'Resume', link: '#resume', icon: FileText },
  { label: 'Contact', link: '#contact', icon: Mail },
];

const socialLinks: LinksType[] = [
  {
    icon: Linkedin,
    label: 'Linkedin',
    link: 'https://www.linkedin.com/in/alexyan06/',
  },
  {
    icon: Github,
    label: 'Github',
    link: 'https://github.com/alexyan06/',
  },
];

const projectsData: ProjectType[] = [
  {
    imgSrc: '/images/Screenshot 2026-02-09 at 5.58.24 PM.png',
    title: 'Iris',
    tags: ['Chrome Extension', 'Accessibility'],
    projectLink:
      'https://www.linkedin.com/feed/update/urn:li:activity:7426712536009383937/?originTrackingId=ZTQqS9KPkl4YvilWi%2BfTPw%3D%3D',
    description:
      'Iris is a voice-first Chrome extension that turns natural speech into actions across Gmail, Calendar, and Docs—planning and executing tasks via an AWS serverless backend and responding with concise, human-style summaries.',
  },
  {
    imgSrc: '/images/Screenshot 2026-01-09 at 2.07.47 PM.png',
    title: 'Access Prep',
    tags: ['AI', 'FinTech'],
    projectLink: 'https://github.com/ryanvaby/Access-Prep',
    description:
      'A bilingual, AI-powered platform that empowers non-traditional bank applicants to navigate the financial onboarding process through intelligent document validation and conversational guidance. Placed 3rd at Capital One Tech Summit Hackathon. ',
  },
  {
    imgSrc: '/images/Screenshot 2026-01-14 at 10.44.02 AM.png',
    title: 'BoilerFit',
    tags: ['Full Stack', 'HealthTech'],
    projectLink: 'https://github.com/alexyan06/BoilerFit',
    description:
      'A Full-stack fitness app generating adaptive workout plans specifically for Purdue students with a linear regression performance tracking recommender. Built a searchable gym mapping interface and exercise explorer.',
  },
  {
    imgSrc: '/images/Screenshot 2026-01-14 at 1.58.45 PM.png',
    title: 'Boiler Purity Test',
    tags: ['Web App', 'Funny'],
    projectLink: 'https://github.com/alexyan06/BoilerPurityTest',
    description:
      'A humorous web app that gauges Purdue students\' "purity" based on their responses to a series of questions about campus life and culture. Gained over 1,500 users in 48 hours from deployment. First Viral Project!',
  },
  {
    imgSrc: '/images/Screenshot 2026-01-14 at 2.03.50 PM.png',
    title: 'Internship Scraper',
    tags: ['Web Scraping', 'Job-Hunting'],
    projectLink: 'https://github.com/alexyan06/Internship-Scrapper.git',
    description:
      'A Python-based web scraper that aggregates internship listings from multiple job portals and emails it to you on a hourly basis based on your qualification. Did this mainly because most internships required juniors and above standing and I wanted to create something that only sends me internships that I qualify for as a Sophomore.',
  },
];

const education: ExperienceType[] = [
  {
    year: 'September 2020 - May 2024',
    title: 'North Allegheny High School',
    institute: '',
    desc: '',
    imgSrc: '/images/NA_Logo.jpeg',
  },
];

const purdue: PurdueExperience[] = [
  {
    year: 'August 2024 - December 2027',
    title: 'Purdue University',
    institute: 'B.S. in Computer Science',
    desc: 'Pursuing a Bachelor of Science in Computer Science on the Software Engineering Track.',
    courses:
      'Data Structures & Algorithms, Object-Oriented Programming, Systems Programming, Competitive Programming, Discrete Mathematics, Computer Architecture, Programming in C, Linear Algebra, Intro to Statistics, Multivariate Calculus',
    imgSrc: '/images/Purdue_University_CS_Logo.jpg',
  },
];

const experience: ExperienceType[] = [
  {
    year: 'Sep 2025 – Present',
    title: 'Full Stack Developer',
    institute: 'Purdue Mathematics Department',
    desc: 'Developing an automated TA Assignment Optimization System using React and Flask. Streamlined scheduling for up to 200 TAs, reducing faculty setup time by 25% and improving query speeds by 12% through index tuning.',
    imgSrc: '/images/Screenshot 2026-01-14 at 1.07.20 PM.png',
  },
  {
    year: 'Jan 2026',
    title: 'Tech Summit Participant',
    institute: 'Capital One Tech Summit',
    desc: 'Selected as 1 of 42 students nationally for a competitive 5-day program. Won 3rd Place in the C1 Hackathon by architecting a bilingual AI platform using Gemini AI and LangChain to simplify banking for underrepresented groups.',
    imgSrc: '/images/C1_LOGO.png',
  },
  {
    year: 'Jun 2025 – Dec 2025',
    title: 'Software Engineering Intern',
    institute: 'Rooh (Berkeley SkyDeck Incubator)',
    desc: 'Built a real-time conversational AI app using Next.js and TypeScript. Integrated Google Cloud Speech-to-Text/TTS and utilized parallelized API calls to reduce average response latency by 20%.',
    imgSrc: '/images/Screenshot 2026-01-14 at 1.08.54 PM.png',
  },
  {
    year: 'Aug 2025 – Nov 2025',
    title: 'L’SPACE Academy Computer Engineer',
    institute: 'NASA',
    desc: 'Selected for a competitive 15-week academy to design a mission concept for the Lucy Trojan Asteroid Mission. Performed trade studies using Python and MATLAB to architect mission-critical telecommunications systems.',
    imgSrc: '/images/NASA_Logo.webp',
  },
  {
    year: 'Sep 2024 – May 2025',
    title: 'Lead Front-End Software Engineer',
    institute: 'Purdue ACM SIGAPP',
    desc: 'Led a team of 10+ developers building campus navigation tools in React Native. Developed a facility search interface for 400+ locations, achieving sub-150ms query response times.',
    imgSrc: '/images/Screenshot 2026-01-14 at 1.20.02 PM.png',
  },
];
const tools: ToolsType[] = [
  // Low-Level / Systems Languages
  {
    label: 'Python',
    imgSrc: '/images/tools/Python-logo-notext.svg.png',
  },
  {
    label: 'Java',
    imgSrc: '/images/tools/javaSVG.svg',
  },
  {
    label: 'C++',
    imgSrc: '/images/tools/c++.png',
  },
  {
    label: 'C',
    imgSrc: '/images/tools/c.png',
  },
  // Frontend Development & Design
  {
    label: 'Figma',
    imgSrc: '/images/tools/figma.svg',
  },
  {
    label: 'CSS',
    imgSrc: '/images/tools/css3.svg',
  },
  {
    label: 'Tailwind CSS',
    imgSrc: '/images/tools/tailwindcss.svg',
  },
  {
    label: 'JavaScript',
    imgSrc: '/images/tools/javascript.svg',
  },
  {
    label: 'TypeScript',
    imgSrc: '/images/tools/typescript.png',
  },
  {
    label: 'React',
    imgSrc: '/images/tools/react.svg',
  },
  {
    label: 'React Native',
    imgSrc: '/images/tools/react-native.svg',
  },
  {
    label: 'Next.js',
    imgSrc: '/images/tools/plsNEXT.jpeg',
  },
  // Backend Frameworks & Runtimes
  {
    label: 'Node.js',
    imgSrc: '/images/tools/nodejs.svg',
  },
  {
    label: 'Express.js',
    imgSrc: '/images/tools/expressjs.svg',
  },
  {
    label: 'Flask',
    imgSrc: '/images/tools/Untitled design (5).png',
  },
  // Data & Infrastructure
  {
    label: 'SQL',
    imgSrc: '/images/tools/sql-database-generic.svg',
  },
  {
    label: 'PostgreSQL',
    imgSrc: '/images/tools/Postgresql_elephant.svg.png',
  },
  {
    label: 'Mongodb',
    imgSrc: '/images/tools/mongodb.svg',
  },
  {
    label: 'Git',
    imgSrc: '/images/tools/Git_icon.svg.png',
  },
  {
    label: 'Github',
    imgSrc: '/images/tools/github-icon-2.svg',
  },
];

export {
  socialLinks,
  projectsData,
  education,
  experience,
  tools,
  navLinks,
  purdue,
};
