// Nano Banana Pro via Gemini's Interactions API (same call shape as Perch's
// openai-image-client.ts). Reads GEMINI_API_KEY from personal_website/.env.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const IMAGE_MODEL = 'gemini-3-pro-image';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function apiKey() {
  if (!process.env.GEMINI_API_KEY) {
    try {
      process.loadEnvFile(path.join(projectRoot, '.env'));
    } catch {
      // fall through to the error below
    }
  }
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is not set (expected in personal_website/.env)');
  return key;
}

/** Load a local image as a reference input. */
export async function loadReference(file) {
  const ext = path.extname(file).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return { mimeType, data: (await readFile(file)).toString('base64') };
}

/**
 * Generate one image. Returns { buffer, mimeType }.
 * @param {{ prompt: string, references?: {mimeType: string, data: string}[], aspectRatio?: string, imageSize?: string }} opts
 */
export async function generateImage({ prompt, references = [], aspectRatio = '16:9', imageSize = '1K' }) {
  const start = Date.now();
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      input: [
        { type: 'text', text: prompt },
        ...references.map((r) => ({ type: 'image', mime_type: r.mimeType, data: r.data })),
      ],
      response_format: {
        type: 'image',
        mime_type: 'image/jpeg', // the only output format this endpoint supports (per Perch)
        aspect_ratio: aspectRatio,
        image_size: imageSize,
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Gemini request failed (${res.status}): ${body.error?.message ?? res.statusText}`);

  const image = body.steps
    ?.flatMap((s) => s.content ?? [])
    .filter((c) => c.type === 'image' && typeof c.data === 'string' && c.data.length > 0)
    .at(-1);
  if (!image) throw new Error('Gemini response contained no image');

  return {
    buffer: Buffer.from(image.data, 'base64'),
    mimeType: image.mime_type ?? 'image/jpeg',
    latencyMs: Date.now() - start,
  };
}
