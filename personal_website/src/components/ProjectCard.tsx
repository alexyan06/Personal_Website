// personal_website/src/components/ProjectCard.tsx
import { motion } from 'motion/react';
import { fadeUp } from '@/lib/animation';
import type { ProjectType } from '@/types';

export const ProjectCard = ({
  imgSrc,
  projectLink,
  tags,
  title,
  description,
}: ProjectType) => {
  const card = (
    <motion.div
      variants={fadeUp}
      className='relative'
    >
      <figure className='overflow-hidden rounded-md h-48'>
        <img
          src={imgSrc}
          alt={title}
          className='rounded-md transition-transform duration-500 hover:scale-105 w-full h-48 object-cover'
        />
      </figure>

      {/* Bottom overlay: tags and title */}
      <div className='absolute left-0 right-0 bottom-0 p-3 flex flex-col items-start gap-2'>
        <div className='flex gap-2 z-10'>
          {tags.map((tag, i) => (
            <span
              key={i}
              className='bg-background hover:bg-primary hover:text-black py-1 px-2 rounded-sm text-sm cursor-default'
            >
              {tag}
            </span>
          ))}
        </div>

        <div className='text-sm font-semibold text-white bg-black/50 px-2 py-1 rounded-sm z-20'>
          {title}
        </div>
      </div>
    </motion.div>
  );

  const descriptionEl = (
    <h3 className='mt-2 text-sm font-semibold text-white'>{description}</h3>
  );

  if (projectLink) {
    return (
      <a
        href={projectLink}
        target='_blank'
        rel='noopener noreferrer'
        aria-label={`Open ${title}`}
        className='block'
      >
        {card}
        {descriptionEl}
      </a>
    );
  }

  return (
    <>
      {card}
      {descriptionEl}
    </>
  );
};
