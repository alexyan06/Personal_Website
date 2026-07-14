import { motion } from 'motion/react';
import { Github, Linkedin, FileText } from 'lucide-react';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: 'easeOut' as const },
});

export const Hero = () => {
  return (
    <section className="pt-16 md:pt-24 pb-6 flex items-center">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-16 w-full">
        {/* Photo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="shrink-0"
        >
          <img
            src="/images/IMG_1894.jpg"
            alt="Alex Yan"
            className="w-32 h-32 md:w-44 md:h-44 rounded-full object-cover ring-1 ring-border"
          />
        </motion.div>

        {/* Text */}
        <div className="flex flex-col gap-4 items-center text-center md:items-start md:text-left">
          <motion.h1
            {...fadeUp(0.1)}
            style={{ fontFamily: "'Playfair Display', serif" }}
            className="text-4xl sm:text-5xl md:text-6xl font-normal leading-tight"
          >
            Alex Yan
          </motion.h1>

          <motion.p
            {...fadeUp(0.22)}
            className="text-base text-muted-foreground max-w-sm leading-relaxed"
          >
            CS student at Purdue building things at the intersection of software
            and real-world impact. Into full-stack dev, AI, and systems.
          </motion.p>

          <motion.div
            {...fadeUp(0.35)}
            className="flex items-center gap-6 mt-1"
          >
            <a
              href="https://www.linkedin.com/in/alexyan06/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground
                hover:text-accent transition-colors duration-200"
            >
              <Linkedin size={14} />
              LinkedIn
            </a>
            <a
              href="https://github.com/alexyan06/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground
                hover:text-accent transition-colors duration-200"
            >
              <Github size={14} />
              GitHub
            </a>
            <a
              href="/images/Alex_Yan_Resume copy.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground
                hover:text-accent transition-colors duration-200"
            >
              <FileText size={14} />
              Resume
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
