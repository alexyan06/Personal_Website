// Serves qa/selftest/fixture.html: a stand-in app that follows the ENGINE.md contract.
// It exists to test the harness, not the site.  node qa/selftest/serve.mjs [--port n] [--bug a,b]
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PROJECT_DIR, ROOMS } from '../lib/config.mjs';
import { loadContentNames } from '../lib/content.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPROVED = path.join(PROJECT_DIR, 'art', 'approved');
const TYPES = { '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.html': 'text/html; charset=utf-8' };
const FILES = {
  '/fonts/press-start-2p.woff2': path.join(PROJECT_DIR, 'node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2'),
  '/fonts/vt323.woff2': path.join(PROJECT_DIR, 'node_modules/@fontsource/vt323/files/vt323-latin-400-normal.woff2'),
  '/images/Alex_Yan_Resume.pdf': path.join(PROJECT_DIR, 'public/images/Alex_Yan_Resume.pdf'),
};

async function page(bugs) {
  const regions = {};
  for (const scene of ['world', ...ROOMS]) {
    const file = path.join(APPROVED, scene === 'world' ? 'overworld.regions.json' : `${scene}.regions.json`);
    regions[scene] = JSON.parse(await readFile(file, 'utf8'));
  }
  const title = JSON.parse(await readFile(path.join(APPROVED, 'title.json'), 'utf8'));
  // The art's own description, as the site reads it: the grounds and the character's sprite sheet.
  const art = {
    backdrops: JSON.parse(await readFile(path.join(APPROVED, 'hd', 'backdrops.json'), 'utf8')),
    mascot: JSON.parse(await readFile(path.join(APPROVED, 'hd', 'mascot.json'), 'utf8')),
  };
  const names = await loadContentNames();
  const config = { regions, title, art, names: { experience: names.experience, projects: names.projects }, bugs };
  const html = await readFile(path.join(HERE, 'fixture.html'), 'utf8');
  // The colors index.html paints before anything runs. Seeded bug: the old sea and grass.
  const old = bugs.includes('old-colors');
  return html
    .replaceAll('__OCEAN__', old ? '#0078F8' : art.backdrops.ocean.color)
    .replaceAll('__GRASS__', old ? '#00A800' : art.backdrops.grass.color)
    .replace('/*__FIXTURE__*/ null', JSON.stringify(config).replace(/</g, '\\u003c'));
}

export function startFixture({ port = 0, bugs = [] } = {}) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      // Pages are never cached (each case seeds its own bugs); the art is, like the site's hashed files.
      const send = (status, type, body, cache = 'no-store') => {
        response.writeHead(status, { 'content-type': type, 'cache-control': cache });
        response.end(body);
      };
      if (url.pathname === '/' || url.pathname === '/index.html') return send(200, TYPES['.html'], await page(bugs));
      const art = /^\/art\/((?:hd\/)?[a-z-]+\.(?:png|webp))$/.exec(url.pathname);
      const file = art ? path.join(APPROVED, art[1]) : FILES[url.pathname];
      if (!file) return send(404, 'text/plain', 'not found');
      return send(200, TYPES[path.extname(file)] ?? 'application/octet-stream', await readFile(file), art ? 'max-age=3600' : 'no-store');
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain' });
      response.end(String(error.stack || error));
    }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '0' }, bug: { type: 'string', default: '' } } });
  const { url } = await startFixture({ port: Number(values.port), bugs: values.bug.split(',').filter(Boolean) });
  console.log(`fixture at ${url}${values.bug ? ` with bugs: ${values.bug}` : ''}`);
}
