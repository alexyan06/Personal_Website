import { motion } from 'motion/react';
import { fadeUp, staggerContainer } from '@/lib/animation';
import { SectionHeader } from '@/components/SectionHeader';
import { education, experience, tools, purdue } from '@/constants';
import { ExpCard } from '@/components/ExpCard';
import { PurdueEducation } from '@/components/PurdueEducation';
import { ToolsCard } from '@/components/ToolsCard';

export const Resume = () => {
  return (
    <motion.section
      initial='hidden'
      whileInView='visible'
      viewport={{ once: true, amount: 0.1, margin: '-120px 0px 0px 0px' }}
      variants={staggerContainer(0.1)}
      className='mt-12 scroll-mt-10 relative'
      id='resume'
    >
      <SectionHeader
        subtitle='Resume'
        title='Education and practical experience'
      />

      <motion.p
        variants={fadeUp}
        className='mt-4 text-neutral-300'
      >
        Currently, I am a Full Stack Developer for the Purdue Mathematics
        Department, where I am building an automated TA optimization system
        using React, Flask, and PostgreSQL to streamline faculty workflows. I
        recently led a team to win 3rd Place at the Capital One Tech Summit
        Hackathon by architecting a bilingual, AI-powered document validation
        platform using Gemini AI and LangChain. My professional background also
        includes a Software Engineering internship at Rooh, where I developed
        real-time conversational pipelines with Next.js and integrated Google
        Cloud APIs to reduce latency by 20%. Additionally, as a Computer
        Engineer for the NASA L'SPACE Academy, I contributed to mission-critical
        telecommunications and computing architectures for asteroid exploration
        concepts. These experiences have honed my ability to architect robust
        full-stack features while maintaining high standards for system
        reliability and data throughput.
      </motion.p>

      <div className='grid gap-x-10 my-16 md:grid-cols-2'>
        <motion.div
          variants={fadeUp}
          className='mb-16 md:mb-0'
        >
          <h2 className='text-3xl font-semibold mb-8'>Education</h2>

          <div className='space-y-8 border-l border-neutral-700 pl-6'>
            {purdue.map((item, i) => (
              <PurdueEducation
                key={i}
                item={item}
              />
            ))}
            {education.map((item, i) => (
              <ExpCard
                key={i}
                item={item}
              />
            ))}
          </div>
        </motion.div>
        <motion.div variants={fadeUp}>
          <h2 className='text-3xl font-semibold mb-8'>Work Experience</h2>

          <div className='space-y-8 border-l border-border pl-6'>
            {experience.map((item, i) => (
              <ExpCard
                key={i}
                item={item}
              />
            ))}
          </div>
        </motion.div>
      </div>

      <div className='my-16'>
        <motion.h2
          variants={fadeUp}
          className='text-3xl font-semibold mb-8 capitalize'
        >
          My Favorite Tools
        </motion.h2>

        <motion.div
          initial='hidden'
          whileInView='visible'
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer(0.02)}
          className='grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-5'
        >
          {tools.map((tool, i) => (
            <ToolsCard
              key={i}
              tool={tool}
            />
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};
