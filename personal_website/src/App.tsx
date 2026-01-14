import { Hero } from '@/components/Hero';
import { Projects } from '@/components/Projects';
import { About } from '@/components/About';
import { Resume } from '@/components/Resume';
import { Contact } from '@/components/Contact';

const App = () => {
  return (
    <main
      className='flex flex-col container mx-auto p-10
    max-w-4xl lg:pr-10 lg:pl-0 lg:max-w-6xl'
    >
      <Hero />
      <Projects />
      <About />
      <Resume />
      <Contact />
    </main>
  );
};

export default App;
