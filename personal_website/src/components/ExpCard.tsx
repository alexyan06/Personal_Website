import type { ExperienceType } from '@/types';

export const ExpCard = ({ item }: { item: ExperienceType }) => {
  return (
    <div className='relative group'>
      <div
        className='absolute -left-7.5 top-2 size-3 bg-muted-foreground group-hover:bg-primary
      rounded-full transition duration-300'
      ></div>

      <span
        className='text-neutral-400 lining-nums group-hover:text-primary
      transition duration-300'
      >
        {item.year}
      </span>

      <h3 className='text-lg font-semibold mt-1'>{item.title}</h3>

      <p className='text-sm text-neutral-400 mb-1'>
        {' '}
        <span className='font-medium text-foreground'>{item.institute}</span>
      </p>

      <img
        className='w-16 h-16 object-contain mb-4'
        src={item.imgSrc}
        alt='Test'
      />

      <p className='text-sm text-neutral-400'>{item.desc}</p>
    </div>
  );
};
