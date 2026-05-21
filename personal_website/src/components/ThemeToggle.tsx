import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  dark: boolean;
  onToggle: () => void;
}

export const ThemeToggle = ({ dark, onToggle }: Props) => {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle theme"
      className="fixed top-6 right-6 z-50 p-2 rounded-full
        text-muted-foreground hover:text-foreground transition-colors duration-200"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={dark ? 'sun' : 'moon'}
          initial={{ opacity: 0, rotate: -20, scale: 0.85 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 20, scale: 0.85 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </motion.div>
      </AnimatePresence>
    </button>
  );
};
