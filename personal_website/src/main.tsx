import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// One @font-face each, no unicode-range: the latin files cover everything the site prints.
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import '@/index.css';
import App from '@/App';
import { applyChromePixels } from '@/world/pixels';
import { loadFonts } from '@/world/preload';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Before the first paint: snap the type sizes to the device-pixel grid and start both fonts loading,
// so nothing swaps face or size once the world is showing.
applyChromePixels();
loadFonts();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
);
