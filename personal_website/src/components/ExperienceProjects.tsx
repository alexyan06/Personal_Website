import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { experience, projectsData } from '@/constants';
import { Currently } from '@/components/Currently';

const experienceItems = experience.map((e) => ({
  role: e.title,
  company: e.institute,
  period: e.year,
  desc: e.desc,
}));

const projectItems = projectsData.map((p) => ({
  name: p.title,
  tags: p.tags,
  desc: p.description,
  link: p.projectLink,
}));

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export const ExperienceProjects = () => {
  return (
    <section className="pt-2 pb-12">
      <Currently />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 w-full">

        {/* Experience */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-7">
            Experience
          </p>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="flex flex-col gap-5"
          >
            {experienceItems.map((exp, i) => (
              <motion.div key={i} variants={item}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium leading-snug">{exp.role}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{exp.period}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{exp.company}</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {exp.desc.split('\n').map((line, j) => (
                    <p key={j}>{line.trim()}</p>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Projects */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-7">
            Projects
          </p>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="flex flex-col gap-5"
          >
            {projectItems.map((proj, i) => (
              <motion.div key={i} variants={item} className="group">
                <div className="flex items-center gap-1.5">
                  {proj.link ? (
                    <a
                      href={proj.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:text-accent transition-colors duration-200
                        flex items-center gap-1"
                    >
                      {proj.name}
                      <ArrowUpRight
                        size={12}
                        className="opacity-0 group-hover:opacity-60 transition-opacity duration-200 -translate-y-px"
                      />
                    </a>
                  ) : (
                    <span className="text-sm font-medium">{proj.name}</span>
                  )}
                </div>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {proj.tags.map((tag, j) => (
                    <span
                      key={j}
                      className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{proj.desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

      </div>
    </section>
  );
};
