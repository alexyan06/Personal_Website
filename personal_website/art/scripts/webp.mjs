// WebP encoding without an image library: the headless Chromium that Playwright already installs
// draws the picture on a canvas and encodes it (lossy, with alpha).
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

let browser;

/** Writes a Jimp image as WebP. Returns the file size in bytes. */
export async function writeWebp(image, file, quality = 0.9) {
  browser ??= await chromium.launch();
  const page = await browser.newPage();
  const png = await image.getBuffer('image/png');
  const dataUrl = await page.evaluate(async ({ src, q }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/webp', q);
  }, { src: 'data:image/png;base64,' + png.toString('base64'), q: quality });
  await page.close();
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  await writeFile(file, buffer);
  return buffer.length;
}

/** Call once when done, or the script will not exit. */
export async function closeWebp() {
  await browser?.close();
  browser = undefined;
}
