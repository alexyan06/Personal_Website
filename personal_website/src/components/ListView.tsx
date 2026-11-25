import { useEffect, useState, type ReactNode } from 'react';
import { BodyText, NewTabIcon } from '@/components/BodyText';
import { Ground } from '@/components/Ground';
import { PixelArrow } from '@/components/PixelArrow';
import { awards, currently, experience, profile, projectsData, skills } from '@/constants';
import { images } from '@/world/assets';
import { formatRoute } from '@/world/routes';
import { ROOM_NAMES, ROOM_ORDER } from '@/world/scenes';
import type { RoomId } from '@/world/types';
import '@/styles/list.css';

const WORLD = formatRoute({ view: 'world' });
const WORLD_LABEL = 'Back to the world';
const NEW_TAB = ' (opens in a new tab)';

const CONTACT = [
  { label: 'Resume', href: profile.links.resume, external: true },
  { label: 'GitHub', href: profile.links.github, external: true },
  { label: 'LinkedIn', href: profile.links.linkedin, external: true },
  { label: 'Email', href: profile.links.email, external: false },
];

const headingId = (room: RoomId) => `list-${room}`;

/** A link's address the way people write it (no scheme, no www, no trailing slash). Shown on paper. */
function plainAddress(href: string): string {
  if (href.startsWith('mailto:')) return href.slice('mailto:'.length);
  const url = new URL(href, window.location.href);
  return `${url.host.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`;
}

function learningStatus(item: (typeof currently)[number]): string {
  if (item.finished) return item.type === 'reading' ? 'Finished reading' : 'Finished';
  if (item.type === 'course') return 'Currently taking';
  return item.type === 'reading' ? 'Currently reading' : 'Currently learning';
}

/** How far down the window a heading has to have come for its section to count as the current one, at most. CSS px. */
const READING_LINE_MAX = 320;

/**
 * The section the reader is in: the last one whose heading has passed the upper part of the
 * window (two fifths of the way down, but no further than READING_LINE_MAX: on a tall window the
 * second heading would otherwise have "passed" before any scrolling).
 */
function useCurrentSection(): RoomId {
  const [current, setCurrent] = useState<RoomId>(ROOM_ORDER[0]);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = Math.min(window.innerHeight * 0.4, READING_LINE_MAX);
      const page = document.documentElement;
      const atEnd = window.innerHeight + window.scrollY >= page.scrollHeight - 2;
      let found = ROOM_ORDER[0];
      for (const room of ROOM_ORDER) {
        const heading = document.getElementById(headingId(room));
        if (heading && (atEnd || heading.getBoundingClientRect().top <= line)) found = room;
      }
      setCurrent(found);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
  return current;
}

/** Jumps to a section and moves focus to its heading, so the next Tab continues from there. */
function jumpTo(room: RoomId) {
  const heading = document.getElementById(headingId(room));
  if (!heading) return;
  heading.scrollIntoView({ block: 'start' });
  heading.focus({ preventScroll: true });
}

function Section({ room, children }: { room: RoomId; children: ReactNode }) {
  return (
    <section className="list__section" aria-labelledby={headingId(room)}>
      {/* tabIndex -1: the section menu moves focus here. */}
      <h2 id={headingId(room)} className="list__heading" tabIndex={-1}>
        {ROOM_NAMES[room]}
      </h2>
      {children}
    </section>
  );
}

/** Dates, place and the like: one fact after another, each kept whole when the line wraps. */
function Meta({ facts }: { facts: (string | undefined)[] }) {
  const shown = facts.filter((fact): fact is string => Boolean(fact));
  if (shown.length === 0) return null;
  return (
    <p className="list__meta">
      {shown.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </p>
  );
}

function Tags({ label, items }: { label: string; items: string[] }) {
  return (
    <ul className="pixel-tags list__tags" role="list" aria-label={label}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * `#/list`: everything in the world as one plain page, in reading order.
 * The lists carry `role="list"` because they are styled without markers, which makes Safari drop
 * the role from a plain `<ul>`.
 */
export function ListView() {
  const current = useCurrentSection();
  const { education } = profile;

  return (
    <main className="list text-body" data-view="list">
      <div className="list__frame">
        <header className="list__side">
          {/* tabIndex -1: the app moves focus here when the list view opens. */}
          <h1 className="list__name" tabIndex={-1}>
            {profile.name}
          </h1>
          <p className="list__headline">{profile.headline}</p>

          <nav className="list__contact" aria-label="Contact">
            <ul>
              {CONTACT.map((link) => (
                <li key={link.label}>
                  <a className="pixel-box" href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener noreferrer' : undefined}>
                    {link.label}
                    {link.external && <span className="sr-only">{NEW_TAB}</span>}
                    {/* Print only: a box cannot be pressed on paper, so the address is written out. */}
                    <span className="list__address">{plainAddress(link.href)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Shown beside the page on wide screens (see list.css). */}
          <nav className="list__menu" aria-label="Sections">
            <ul>
              {ROOM_ORDER.map((room) => (
                <li key={room}>
                  <button type="button" aria-current={room === current ? 'location' : undefined} onClick={() => jumpTo(room)}>
                    <PixelArrow />
                    {ROOM_NAMES[room]}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <a className="list__world pixel-box" href={WORLD}>
            {/* A window onto the title screen: the sea, moving, and the island small on it. */}
            <span className="list__world-art" aria-hidden="true">
              <Ground ground="ocean" className="list__world-sea" />
              <img className="list__world-isle" src={images.world} alt="" draggable={false} />
            </span>
            <span className="list__world-label">
              <PixelArrow />
              {WORLD_LABEL}
            </span>
          </a>
        </header>

        <div className="list__main">
          <Section room="about">
            <p>
              <BodyText>{profile.bio}</BodyText>
            </p>
            <ul className="list__items" role="list">
              <li className="list__item">
                <h3 className="list__title">{education.school}</h3>
                <p className="list__sub">{education.degree}</p>
                <Meta facts={[education.location, `Graduating ${education.graduation}`]} />
                <p id="list-coursework" className="list__tags-label">
                  Relevant coursework
                </p>
                <ul className="pixel-tags list__tags" role="list" aria-labelledby="list-coursework">
                  {education.coursework.map((course) => (
                    <li key={course}>{course}</li>
                  ))}
                </ul>
              </li>
            </ul>
          </Section>

          <Section room="experience">
            <ul className="list__items" role="list">
              {experience.map((job) => (
                <li key={job.slug} className="list__item">
                  <h3 className="list__title">{job.institute}</h3>
                  <p className="list__sub">{job.title}</p>
                  <Meta facts={[job.year, job.location]} />
                  {job.highlights?.length ? (
                    <ul className="pixel-bullets" role="list">
                      {job.highlights.map((text) => (
                        <li key={text}>
                          <BodyText>{text}</BodyText>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      <BodyText>{job.desc}</BodyText>
                    </p>
                  )}
                  {job.stack && job.stack.length > 0 && <Tags label="Stack" items={job.stack} />}
                </li>
              ))}
            </ul>
          </Section>

          <Section room="projects">
            <ul className="list__items" role="list">
              {projectsData.map((project) => (
                <li key={project.slug} className="list__item">
                  <h3 className="list__title">{project.title}</h3>
                  <p>
                    <BodyText>{project.description}</BodyText>
                  </p>
                  <Tags label="Tags" items={project.tags} />
                  <p className="list__links">
                    {/* The name starts with the visible text and adds which project it is. */}
                    <a className="list__link" href={project.projectLink} target="_blank" rel="noopener noreferrer" aria-label={`View on GitHub: ${project.title}${NEW_TAB}`}>
                      <span className="list__link-text">View on GitHub</span>
                      <NewTabIcon />
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <Section room="skills">
            <ul className="list__items list__items--grid" role="list">
              {skills.map((group) => (
                <li key={group.slug} className="list__item">
                  <h3 className="list__title">{group.label}</h3>
                  <Tags label={group.label} items={group.skills} />
                </li>
              ))}
            </ul>
          </Section>

          <Section room="learning">
            <ul className="list__items" role="list">
              {currently.map((item) => (
                <li key={item.slug} className="list__item">
                  <h3 className="list__title">{item.subtitle ? `${item.label}: ${item.subtitle}` : item.label}</h3>
                  <p className="list__sub">{learningStatus(item)}</p>
                  <Meta facts={[item.source, item.since]} />
                </li>
              ))}
            </ul>
          </Section>

          <Section room="misc">
            <ul className="list__items" role="list">
              {awards.map((award) => (
                <li key={award.slug} className="list__item">
                  <h3 className="list__title">{award.institute}</h3>
                  <p className="list__sub">{award.title}</p>
                  <Meta facts={[award.year]} />
                  <p>
                    <BodyText>{award.desc}</BodyText>
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <footer className="list__footer">
            <a className="list__back pixel-box" href={WORLD}>
              <PixelArrow />
              {WORLD_LABEL}
            </a>
          </footer>
        </div>
      </div>
    </main>
  );
}
