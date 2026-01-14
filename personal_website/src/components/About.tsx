import { motion } from 'framer-motion';
import { fadeUp, staggerContainer } from '@/lib/animation.ts';
import { SectionHeader } from '@/components/SectionHeader.tsx';
import { Button } from '@/components/ui/button.tsx';

export const About = () => {
  return (
    <motion.section
      initial='hidden'
      whileInView='visible'
      viewport={{ once: true, amount: 0.3 }}
      variants={staggerContainer(0)}
      className='mt-30 scroll-mt-10'
      id='about'
    >
      <SectionHeader
        subtitle='About'
        title='Engineering with Purpose'
      />

      <motion.p
        variants={fadeUp}
        className='mt-4 text-neutral-300'
      >
        I am a Computer Science student at Purdue University dedicated to
        building software that bridges the gap between complex backend
        architecture and intuitive user experiences. My approach to engineering
        is driven by a passion for solving real-world problems through scalable,
        intelligent systems. Whether I am optimizing data pipelines or designing
        responsive interfaces, I focus on creating tools that are as performant
        as they are accessible. I thrive in collaborative environments where
        technical rigor meets creative problem-solving to deliver impactful
        digital solutions.
      </motion.p>

      <motion.p
        variants={fadeUp}
        className='mt-2 text-neutral-300'
      >
        Let's collaborate to build something impactful together.
      </motion.p>

      <motion.div
        variants={fadeUp}
        transition={{ delay: 0.2 }}
        className='mt-6'
      >
        <Button
          className='mt-5'
          asChild
        >
          <a
            href='#contact'
            aria-label='Go to contact section'
          >
            Contact Me
          </a>
        </Button>
      </motion.div>
    </motion.section>
  );
};
