// Draws the images in public/ that are made from the site itself:
//   og.png                 the link-preview picture: the title screen, 1200 x 630
//   favicon.ico            src/assets/favicon.svg at 32 x 32 (a PNG inside an .ico)
//   apple-touch-icon.png   the same icon, 176 px on a 180 px black square
//
//   node scripts/site-images.mjs
//
// It builds the site into a temporary folder, serves it on a free port, takes the pictures with
// headless Chromium (Playwright, already a dev dependency) and stops the server again. Run it when
// the art, the title screen or the icon changes, and commit what it writes. index.html links the files.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build, preview } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const OG = { width: 1200, height: 630 };

/** A .ico file holding one PNG: a 6-byte header, one 16-byte entry, then the PNG as it is. */
function icoFrom(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt8(0, 8); // no palette
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10); // color planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // where the PNG starts
  return Buffer.concat([header, png]);
}

const outDir = await mkdtemp(path.join(os.tmpdir(), 'site-images-'));
let server = null;
let browser = null;
try {
  await build({ root: ROOT, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
  server = await preview({ root: ROOT, logLevel: 'warn', build: { outDir }, preview: { host: '127.0.0.1', port: 0, strictPort: false, open: false } });
  const address = server.httpServer.address();
  const base = `http://127.0.0.1:${address.port}/`;
  browser = await chromium.launch();

  // The title screen as a visitor first sees it. Reduced motion, so PRESS START is not caught mid-blink.
  {
    const context = await browser.newContext({ viewport: OG, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForSelector('[data-stage][data-transition="idle"]');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(PUBLIC, 'og.png') });
    await context.close();
  }

  // The icon is a 16 x 16 grid of pixels: drawn at whole multiples, nearest neighbor, so it stays sharp.
  const svg = await readFile(path.join(ROOT, 'src', 'assets', 'favicon.svg'));
  const icon = `data:image/svg+xml;base64,${svg.toString('base64')}`;
  const draw = async (canvas, size, background) => {
    const context = await browser.newContext({ viewport: { width: canvas, height: canvas }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const inset = (canvas - size) / 2;
    await page.setContent(
      `<body style="margin:0;background:${background}"><img src="${icon}" style="position:absolute;left:${inset}px;top:${inset}px;width:${size}px;height:${size}px;image-rendering:pixelated"></body>`,
    );
    const png = await page.screenshot({ omitBackground: background === 'transparent' });
    await context.close();
    return png;
  };
  await writeFile(path.join(PUBLIC, 'favicon.ico'), icoFrom(await draw(32, 32, 'transparent'), 32));
  await writeFile(path.join(PUBLIC, 'apple-touch-icon.png'), await draw(180, 176, '#000000'));
  console.log('Wrote public/og.png, public/favicon.ico and public/apple-touch-icon.png');
} finally {
  await browser?.close();
  await new Promise((resolve) => (server ? server.httpServer.close(resolve) : resolve()));
  await rm(outDir, { recursive: true, force: true });
}
