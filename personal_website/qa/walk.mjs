#!/usr/bin/env node
// Headless QA walk of the pixel-art world. See qa/README.md and ENGINE.md section 10.
//   node qa/walk.mjs [--mode preview|dev] [--only <profiles>] [--flow <flows>] [--base <url>] [--out <dir>]
import { existsSync } from 'node:fs';
import { mkdir, rm, symlink, unlink } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { loadArt } from './lib/art.mjs';
import { usePalette } from './lib/checks.mjs';
import { FLOWS, PROFILES, PROJECT_DIR, QA_DIR } from './lib/config.mjs';
import { loadContentNames } from './lib/content.mjs';
import { FLOW_BUDGET, FLOW_RUNNERS } from './lib/flows/index.mjs';
import { loadAllRegions } from './lib/regions.mjs';
import { countChecks, profileEntry, writeReports } from './lib/report.mjs';
import { SiteServer } from './lib/server.mjs';
import { Aborted, Session } from './lib/session.mjs';
import { clip, timestamp } from './lib/util.mjs';

const USAGE = `Headless QA walk (ENGINE.md section 10). Nothing opens on screen.

  node qa/walk.mjs [options]        or        npm run qa -- [options]

  --mode preview|dev     preview (default): production build into the run folder, served by vite preview
                         dev: the Vite dev server
  --base <url>           test a server that is already running; no server is started
  --only <profiles>      comma-separated: ${Object.keys(PROFILES).join(', ')}
  --flow <flows>         comma-separated: ${FLOWS.join(', ')}
  --out <dir>            write this run into <dir> (default: qa/out/<timestamp>)
  --run <name>           name of the run folder under qa/out/ (default: a timestamp)
  --regions <dir>        where the *.regions.json files are (default: art/approved)
  --jobs <n>             profiles to walk at the same time (default: 1)
  --max-minutes <n>      stop the walk and write the report after this long (default: 30)
  --quiet                print only the result
  --help

Exit code: 0 when nothing failed, 1 when any check failed, 2 for a bad option, 130 when interrupted.`;

function fail(message) {
  console.error(`qa: ${message}\n\n${USAGE}`);
  process.exit(2);
}

function parseCli() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        mode: { type: 'string', default: 'preview' },
        base: { type: 'string' },
        only: { type: 'string' },
        flow: { type: 'string' },
        out: { type: 'string' },
        run: { type: 'string' },
        regions: { type: 'string' },
        jobs: { type: 'string', default: '1' },
        'max-minutes': { type: 'string', default: '30' },
        quiet: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (error) {
    fail(error.message);
  }
  const v = parsed.values;
  if (v.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (!['preview', 'dev'].includes(v.mode)) fail(`--mode must be preview or dev, not "${v.mode}"`);
  const pick = (value, known, what) => {
    if (value === undefined) return [...known];
    const names = value.split(',').map((s) => s.trim()).filter(Boolean);
    const bad = names.filter((n) => !known.includes(n));
    if (bad.length || !names.length) fail(`unknown ${what}: ${bad.join(', ') || '(none given)'}. Known: ${known.join(', ')}`);
    return known.filter((k) => names.includes(k));
  };
  const profiles = pick(v.only, Object.keys(PROFILES), 'profile');
  const flows = pick(v.flow, FLOWS, 'flow');
  let base = null;
  if (v.base !== undefined) {
    try {
      const url = new URL(v.base);
      url.hash = '';
      base = url.toString();
    } catch {
      fail(`--base is not a URL: ${v.base}`);
    }
  }
  const jobs = Number(v.jobs);
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 8) fail('--jobs must be a whole number from 1 to 8');
  const maxMinutes = Number(v['max-minutes']);
  if (!(maxMinutes > 0)) fail('--max-minutes must be a positive number');
  if (v.run !== undefined && !/^[\w.-]+$/.test(v.run)) fail('--run may only contain letters, digits, dots, dashes and underscores');
  if (!profiles.some((p) => PROFILES[p].flows.some((f) => flows.includes(f)))) {
    const runs = profiles.map((p) => `${p} runs ${PROFILES[p].flows.join(', ')}`).join('; ');
    fail(`nothing to do: none of the chosen profiles runs the chosen flows (${runs})`);
  }
  return { ...v, profiles, flows, base, jobs, maxMinutes };
}

async function makeRunDir(opts) {
  const outRoot = path.join(QA_DIR, 'out');
  if (opts.out || opts.run) {
    const dir = opts.out ? path.resolve(opts.out) : path.join(outRoot, opts.run);
    // Reusing a folder from an earlier run: clear its screenshots so old and new do not mix.
    if (existsSync(path.join(dir, 'report.json'))) await rm(path.join(dir, 'shots'), { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    return { dir, name: path.basename(dir), latest: false };
  }
  await mkdir(outRoot, { recursive: true });
  const stamp = timestamp();
  for (let i = 1; ; i++) {
    const name = i === 1 ? stamp : `${stamp}-${i}`;
    try {
      await mkdir(path.join(outRoot, name)); // fails if another run took the name this second
      return { dir: path.join(outRoot, name), name, latest: true };
    } catch (error) {
      if (error.code !== 'EEXIST' || i > 50) throw error;
    }
  }
}

async function main() {
  const opts = parseCli();
  const { dir, name, latest } = await makeRunDir(opts);
  const print = (line) => {
    if (!opts.quiet) console.log(line);
  };

  const run = {
    dir,
    name,
    base: opts.base,
    regions: null,
    art: null,
    content: null,
    aborted: null,
    print,
    report: {
      startedAt: new Date().toISOString(),
      finishedAt: null,
      interrupted: null,
      command: ['node', path.relative(process.cwd(), process.argv[1]) || 'qa/walk.mjs', ...process.argv.slice(2)].join(' '),
      mode: opts.base ? 'base' : opts.mode,
      server: null,
      notes: [],
      profiles: [],
      stops: [],
    },
  };
  const setupFailure = (id, message) => {
    run.report.stops.push({ id: `run/setup/${id}`, profile: 'run', flow: 'setup', name: id, url: null, route: null, screenshot: null, checks: [{ id, status: 'fail', message: clip(message, 1500) }] });
    console.error(`qa: ${message}`);
  };

  let server = null;
  let browser = null;
  let finishing = false;

  // Whatever happens, the report is written and the server is stopped.
  const interrupt = (why) => {
    if (run.aborted) {
      server?.killNow();
      process.exit(130);
    }
    run.aborted = why;
    run.report.interrupted = why;
    console.error(`\nqa: ${why}: stopping the walk and writing the report (again to quit at once)`);
    browser?.close().catch(() => {});
    server?.stop().catch(() => {});
    setTimeout(() => {
      if (finishing) return;
      server?.killNow();
      process.exit(130);
    }, 15_000).unref();
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => interrupt(signal));
  process.on('exit', () => server?.killNow());
  process.on('unhandledRejection', (error) => run.report.notes.push(`unhandled error in the harness: ${clip(error?.stack || error, 400)}`));
  const watchdog = setTimeout(() => interrupt(`time limit of ${opts.maxMinutes} min reached`), opts.maxMinutes * 60_000);
  watchdog.unref();

  print(`qa run ${name} -> ${path.relative(process.cwd(), dir) || dir}`);

  try {
    run.regions = await loadAllRegions(opts.regions ? path.resolve(opts.regions) : path.join(PROJECT_DIR, 'art', 'approved'));
    run.art = await loadArt();
    if (run.art.problems.length) setupFailure('art', `the art's own description could not be read, so the checks that compare the page against it will fail: ${run.art.problems.join('; ')}`);
    run.content = await loadContentNames();
    try {
      const palette = await import(pathToFileURL(path.join(PROJECT_DIR, 'art', 'scripts', 'nes-palette.mjs')).href);
      if (!Array.isArray(palette.NES_PALETTE) || !palette.NES_PALETTE.length) throw new Error('it does not export NES_PALETTE');
      usePalette(palette);
    } catch (error) {
      setupFailure('palette', `art/scripts/nes-palette.mjs could not be loaded, so UI colors are not checked against the NES palette: ${error.message}`);
    }

    // 1. The site.
    if (!run.base) {
      server = new SiteServer({ mode: opts.mode, runDir: dir, log: print });
      try {
        run.base = await server.start();
        print(`serving ${run.base}`);
      } catch (error) {
        if (!run.aborted) setupFailure('server', `could not start the site (${opts.mode}): ${error.message}`);
      }
      run.report.server = { mode: opts.mode, port: server.port, commands: server.commands };
    }

    // 2. The browser, always headless.
    if (run.base && !run.aborted) {
      try {
        // Signals are handled here (report first, then exit), so Playwright must not exit the process itself.
        browser = await chromium.launch({ headless: true, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false });
      } catch (error) {
        setupFailure('browser', `headless Chromium did not start: ${error.message}`);
      }
    }

    // 3. One warm-up load: proves the site answers and lets the dev server finish optimizing dependencies.
    let reachable = !!browser;
    if (browser && !run.aborted) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        const response = await page.goto(run.base, { waitUntil: 'load', timeout: 45_000 });
        if (!response || response.status() >= 400) {
          reachable = false;
          setupFailure('site', `${run.base} answered ${response ? response.status() : 'nothing'}`);
        } else await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      } catch (error) {
        reachable = false;
        if (!run.aborted) setupFailure('site', `${run.base} could not be loaded: ${clip(error.message, 300)}`);
      } finally {
        await context.close().catch(() => {});
      }
    }

    // 4. The walk.
    const plan = opts.profiles.map((profileName) => ({ profileName, flows: PROFILES[profileName].flows.filter((f) => opts.flows.includes(f)) }));
    for (const { profileName, flows } of plan) {
      if (!flows.length) run.report.notes.push(`profile ${profileName} runs none of the chosen flows (it runs: ${PROFILES[profileName].flows.join(', ')})`);
    }
    const walkOne = async ({ profileName, flows }) => {
      const entry = profileEntry(profileName, flows);
      run.report.profiles.push(entry);
      if (!flows.length || !reachable || run.aborted) return;
      const session = new Session({ browser, name: profileName, profile: PROFILES[profileName], run });
      try {
        await session.open();
        for (const flow of flows) {
          if (run.aborted) break;
          session.flow = flow;
          session.misses = 0;
          session.stuck = null;
          session.flowDeadline = Date.now() + FLOW_BUDGET[flow];
          print(`[${profileName}] ${flow}`);
          try {
            await FLOW_RUNNERS[flow](session);
          } catch (error) {
            session.finishStop();
            if (run.aborted) break;
            const stopped = error instanceof Aborted;
            run.report.stops.push({
              id: `${profileName}/${flow}/${stopped ? 'stopped' : 'crashed'}`,
              profile: profileName,
              flow,
              name: stopped ? 'stopped' : 'crashed',
              url: null,
              route: null,
              screenshot: null,
              checks: [{ id: stopped ? 'flow-stopped' : 'flow-crashed', status: 'fail', message: clip(stopped ? error.message : `the ${flow} flow stopped on an error in the harness or the browser: ${error.stack || error.message}`, 1200) }],
            });
            print(`  FAIL ${profileName}/${flow}: ${clip(error.message, 200)}`);
          }
          session.finishStop();
          if (session.page && !session.page.isClosed()) await session.page.close().catch(() => {});
          session.page = null;
          await writeReports(run).catch(() => {});
        }
      } catch (error) {
        if (!run.aborted) setupFailure(`profile-${profileName}`, `profile ${profileName} could not run: ${error.stack || error.message}`);
      } finally {
        entry.env = session.env;
        await session.close().catch(() => {});
      }
    };
    const queue = [...plan];
    await Promise.all(
      Array.from({ length: Math.min(opts.jobs, queue.length || 1) }, async () => {
        while (queue.length && !run.aborted) await walkOne(queue.shift());
      }),
    );
    for (const rest of queue) run.report.profiles.push(profileEntry(rest.profileName, rest.flows));
    run.report.profiles.sort((a, b) => opts.profiles.indexOf(a.name) - opts.profiles.indexOf(b.name));
  } catch (error) {
    setupFailure('harness', `the harness stopped on an error: ${error.stack || error.message}`);
  }

  // 5. Report, clean up, exit code.
  finishing = true;
  clearTimeout(watchdog);
  await browser?.close().catch(() => {});
  await server?.stop().catch(() => {});
  run.report.finishedAt = new Date().toISOString();
  if (!run.report.stops.length && !run.aborted) run.report.notes.push('nothing was walked: no profile runs any of the chosen flows');

  const { json, mdPath } = await writeReports(run);
  if (latest) {
    const link = path.join(QA_DIR, 'out', 'latest');
    await unlink(link).catch(() => {});
    await symlink(name, link).catch(() => {});
  }
  const totals = countChecks(run.report.stops);
  console.log(`\nreport: ${mdPath}`);
  console.log(`${json.totals.stops} stops: ${totals.pass} pass, ${totals.fail} fail, ${totals.warn} warn${run.aborted ? ` (interrupted: ${run.aborted})` : ''}`);
  for (const note of run.report.notes) console.log(`note: ${note}`);
  process.exit(run.aborted ? 130 : totals.fail > 0 || !run.report.stops.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`qa: ${error.stack || error.message}`);
  process.exit(1);
});
