import { useState } from 'react';
import { Hero } from '@/components/Hero';
import { ExperienceProjects } from '@/components/ExperienceProjects';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Cursor } from '@/components/Cursor';
import { BackgroundOrbs } from '@/components/BackgroundOrbs';

const App = () => {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <div className="relative overflow-x-hidden">
      <Cursor />
      <BackgroundOrbs dark={dark} />
      <ThemeToggle dark={dark} onToggle={toggleTheme} />

      <main className="relative z-10 max-w-4xl mx-auto px-10 md:px-16">
        <Hero />
        <ExperienceProjects />
      </main>

      <footer className="relative z-10 max-w-4xl mx-auto px-10 md:px-16 py-5 border-t border-border">
        <p className="text-[11px] text-muted-foreground">Alex Yan © 2026</p>
      </footer>
    </div>
  );
};

export default App;
