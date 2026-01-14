import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/animation.ts';
import type { ToolsType } from '@/types';

export const ToolsCard = ({ tool }: { tool: ToolsType }) => {
  return (
    <motion.div
      variants={fadeUp}
      className='border border-neutral-700 rounded-md
      flex justify-center items-center flex-col py-4'
    >
      <img
        className='w-12 h-12 object-contain'
        src={tool.imgSrc}
        alt={tool.label}
      />

      <p className='font-bold mt-2'>{tool.label}</p>
    </motion.div>
  );
};
