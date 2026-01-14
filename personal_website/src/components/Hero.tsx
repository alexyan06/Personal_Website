import { motion } from 'motion/react';
import { fadeUp, staggerContainer } from '@/lib/animation.ts';

import { Button } from '@/components/ui/button';

import { SparkleIcon } from 'lucide-react';

export const Hero = () => {
  return (
    <motion.section
      initial='hidden'
      whileInView='visible'
      viewport={{ once: true, amount: 0.3 }}
      variants={staggerContainer(0)}
      className='pt-20'
      id='hero'
    >
      <motion.p
        variants={fadeUp}
        className='flex items-center justify-center
        py-1 gap-2 border border-neutral-600 rounded-sm w-32'
      >
        <SparkleIcon size={15} /> <span>Introduction</span>
      </motion.p>

      <motion.h1
        variants={fadeUp}
        className='text-4xl md:text-5xl lg:text-6xl font-semibold capitalize
        mt-2 max-w-3xl md:leading-16'
      >
        I'm <span className='text-primary'>Alex Yan</span>
      </motion.h1>
      <motion.h1
        variants={fadeUp}
        className='text-4xl md:text-5xl lg:text-6xl font-semibold capitalize
        mt-2 max-w-3xl md:leading-16'
      >
        Full Stack Developer & CS Student at Purdue
      </motion.h1>

      <motion.div
        variants={fadeUp}
        className='mt-5 flex gap-2 text-4xl md:text-5xl lg:text-6xl font-semibold capitalize
        mt-2 max-w-3xl md:leading-16'
      >
        <Button asChild>
          <a href='#projects'>My projects</a>
        </Button>

        <Button
          variant='outline'
          asChild
        >
          <a
            href='/images/Alex_Yan_Resume.pdf'
            download
            aria-label='Download Resume'
          >
            Download Resume
          </a>
        </Button>
      </motion.div>
    </motion.section>
  );
};
