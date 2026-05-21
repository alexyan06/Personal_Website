import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { currently } from '@/constants';

export const Currently = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="block pb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm text-muted-foreground
          hover:text-foreground transition-colors duration-200"
      >
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent opacity-80" />
        </span>
        What I'm currently learning
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' as const }}
            className="overflow-hidden"
          >
            <div className="mt-3 w-full rounded-lg border border-border bg-background p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                Currently
              </p>
              <div className="flex flex-col gap-2.5">
                {currently.map((item, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground">{item.type}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{item.since}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
