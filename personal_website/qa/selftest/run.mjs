#!/usr/bin/env node
// Tests the harness itself against qa/selftest/fixture.html, a stand-in app that follows the contract.
//   - a clean fixture must pass every check, with no warnings, on every profile;
//   - each seeded bug must be caught by the check that is meant to catch it;
//   - a dead server and missing regions files must end in a report, not a crash.
//   node qa/selftest/run.mjs [--only <case[,case]>] [--jobs n] [--keep]
// Run folders of cases that behave are deleted unless --keep is given; a failing case leaves qa/out/selftest-<case>/.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { QA_DIR } from '../lib/config.mjs';
import { freePort } from '../lib/server.mjs';
import { startFixture } from './serve.mjs';

const CLEAN = { fail: 0, warn: 0 };
const CASES = [
  { name: 'clean-desktop', args: ['--only', 'desktop'], expect: CLEAN },
  { name: 'clean-sizes', args: ['--only', 'desktop-hd,retina,small', '--flow', 'title,world,keyboard'], expect: CLEAN },
  { name: 'clean-phones', args: ['--only', 'phone-landscape,phone-portrait'], expect: CLEAN },
  { name: 'clean-reduced', args: ['--only', 'reduced-motion'], expect: CLEAN },
  {
    name: 'bugs-world',
    bugs: ['pixelated', 'offset', 'no-name', 'div-hotspot', 'label-overlap', 'label-outside', 'off-palette', 'console-error', 'hscroll', 'wrong-route-attr'],
    args: ['--only', 'desktop', '--flow', 'world'],
    caught: { fail: ['art-smooth', 'hotspots-placed', 'hotspots-named', 'hotspots-present', 'labels-overlap', 'labels-inside', 'console-clean', 'no-horizontal-scroll', 'route'], warn: ['palette'] },
  },
  { name: 'bug-scale', bugs: ['fractional-k'], args: ['--only', 'desktop', '--flow', 'world'], caught: { fail: ['scale'] } },
  {
    name: 'bugs-rooms',
    bugs: ['clip-dialog', 'no-focus-return', 'missing-hotspot', 'stretched-labels'],
    args: ['--only', 'desktop', '--flow', 'rooms'],
    caught: { fail: ['dialog-not-clipped', 'focus-returns', 'hotspots-present', 'enter-room', 'labels-zoomed'] },
  },
  { name: 'bugs-keyboard', bugs: ['no-trap', 'no-outline'], args: ['--only', 'desktop', '--flow', 'keyboard'], caught: { fail: ['focus-trap', 'focus-visible', 'pointer-on-focus'] } },
  { name: 'bug-reduced-motion', bugs: ['reduced-zoom'], args: ['--only', 'reduced-motion', '--flow', 'motion'], caught: { fail: ['no-moving-transforms'] } },
  {
    name: 'bugs-deeplinks',
    bugs: ['title-on-deeplink', 'push-unknown', 'escape-back'],
    args: ['--only', 'desktop', '--flow', 'deeplinks'],
    caught: { fail: ['deeplink-immediate', 'unknown-route-replaced', 'back-not-trapped', 'escape-up'] },
  },
  { name: 'bugs-phone', bugs: ['gate-everywhere', 'missing-name'], args: ['--only', 'phone-portrait'], caught: { fail: ['rotate-gate', 'list-names'] } },
  { name: 'bug-small-target', bugs: ['small-target'], args: ['--only', 'phone-landscape', '--flow', 'deeplinks'], caught: { fail: ['hotspots-size'] } },
  { name: 'bug-never-idle', bugs: ['never-idle'], args: ['--only', 'desktop', '--flow', 'title,rooms'], caught: { fail: ['settled'] }, maxSeconds: 240 },
  { name: 'bug-no-running', bugs: ['no-running'], args: ['--only', 'desktop', '--flow', 'title'], caught: { fail: ['transition-reported'] } },
  // The art: old low-resolution pictures, the old ground colors, the title's island out of place, a zoom that stops short.
  { name: 'bugs-art', bugs: ['low-res', 'old-colors', 'island-off'], args: ['--only', 'desktop', '--flow', 'title'], caught: { fail: ['art-hd', 'art-placed'], warn: ['page-background'] } },
  { name: 'bug-zoom', bugs: ['zoom-short'], args: ['--only', 'desktop', '--flow', 'title'], caught: { fail: ['zoom-lands'] } },
  // The ground: missing, stopping at the old picture's edge (by its box, or only by its tiles), too large, and the sea's motion.
  { name: 'bug-no-ground', bugs: ['no-ground'], args: ['--only', 'desktop', '--flow', 'world'], caught: { fail: ['ground'] } },
  { name: 'bug-flat-band', bugs: ['flat-band'], args: ['--only', 'desktop', '--flow', 'ambient'], caught: { fail: ['ground', 'ground-covers', 'ground-texture'] } },
  { name: 'bugs-ground', bugs: ['flat-color', 'sea-still'], args: ['--only', 'desktop', '--flow', 'ambient'], caught: { fail: ['ground-covers', 'ground-texture', 'ground-motion', 'sea-moves'] } },
  { name: 'bugs-sea', bugs: ['sea-repaint', 'huge-ground'], args: ['--only', 'desktop', '--flow', 'world'], caught: { fail: ['ground-motion', 'ground-size'] } },
  { name: 'bug-sea-reduced', bugs: ['sea-reduced'], args: ['--only', 'reduced-motion', '--flow', 'ambient'], caught: { fail: ['ground-motion', 'sea-still'] } },
  // The character: missing, not animated, not waving, playing frames his sheet does not list for the pose.
  { name: 'bug-no-character', bugs: ['no-character'], args: ['--only', 'desktop', '--flow', 'ambient'], caught: { fail: ['character'] } },
  { name: 'bugs-character', bugs: ['character-still', 'character-no-wave'], args: ['--only', 'desktop', '--flow', 'ambient'], caught: { fail: ['character-motion', 'character-idle-frames', 'character-waves', 'character-pose'] } },
  { name: 'bug-character-frames', bugs: ['character-frames'], args: ['--only', 'desktop', '--flow', 'ambient'], caught: { fail: ['character-idle-frames', 'character-wave-frames'] } },
  { name: 'bug-moved', bugs: ['moved-lost'], args: ['--only', 'desktop', '--flow', 'deeplinks'], caught: { fail: ['moved-route'] } },
  { name: 'no-regions', regions: 'empty', args: ['--only', 'desktop', '--flow', 'world,deeplinks'], caught: { fail: ['regions-file'] } },
  { name: 'dead-server', dead: true, args: ['--only', 'desktop', '--flow', 'title'], caught: { fail: ['site'] } },
];

const { values } = parseArgs({ options: { only: { type: 'string' }, jobs: { type: 'string', default: '4' }, keep: { type: 'boolean', default: false } } });
const chosen = values.only ? CASES.filter((c) => values.only.split(',').includes(c.name)) : CASES;
if (!chosen.length) {
  console.error(`no such case. Cases: ${CASES.map((c) => c.name).join(', ')}`);
  process.exit(2);
}

function walk(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(QA_DIR, 'walk.mjs'), ...args, '--quiet'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('exit', (code) => resolve({ code, output }));
  });
}

async function runCase(test) {
  const started = Date.now();
  const run = `selftest-${test.name}`;
  let fixture = null;
  let base;
  if (test.dead) base = `http://127.0.0.1:${await freePort()}/`;
  else {
    fixture = await startFixture({ bugs: test.bugs ?? [] });
    base = fixture.url;
  }
  const args = ['--base', base, '--run', run, ...test.args];
  if (test.regions === 'empty') args.push('--regions', await mkdtemp(path.join(os.tmpdir(), 'qa-no-regions-')));
  const { code, output } = await walk(args);
  fixture?.server.close();
  fixture?.server.closeAllConnections?.();
  const seconds = Math.round((Date.now() - started) / 1000);

  const problems = [];
  let report = null;
  try {
    report = JSON.parse(await readFile(path.join(QA_DIR, 'out', run, 'report.json'), 'utf8'));
  } catch (error) {
    problems.push(`no readable report.json: ${error.message}`);
  }
  if (report) {
    const ids = (status) => new Set(report.stops.flatMap((s) => s.checks.filter((c) => c.status === status).map((c) => c.id)));
    const failed = ids('fail');
    const warned = ids('warn');
    if (test.expect) {
      if (report.totals.fail !== test.expect.fail) problems.push(`expected ${test.expect.fail} failures, got ${report.totals.fail}: ${[...failed].join(', ')}`);
      if (report.totals.warn !== test.expect.warn) problems.push(`expected ${test.expect.warn} warnings, got ${report.totals.warn}: ${[...warned].join(', ')}`);
      if (code !== 0) problems.push(`expected exit code 0, got ${code}`);
      if (!report.totals.stops) problems.push('nothing was walked');
    }
    if (test.caught) {
      for (const id of test.caught.fail ?? []) if (!failed.has(id)) problems.push(`the seeded bug was not caught: no failing "${id}" check`);
      for (const id of test.caught.warn ?? []) if (!warned.has(id)) problems.push(`the seeded bug was not caught: no "${id}" warning`);
      if (code !== 1) problems.push(`expected exit code 1, got ${code}`);
    }
    if (!report.complete) problems.push('the report is not marked complete');
    if (test.maxSeconds && seconds > test.maxSeconds) problems.push(`took ${seconds} s, more than the ${test.maxSeconds} s allowed`);
  }
  const line = `${problems.length ? 'FAIL' : 'ok  '} ${test.name.padEnd(20)} ${String(seconds).padStart(4)} s  ${report ? `${report.totals.stops} stops, ${report.totals.pass} pass, ${report.totals.fail} fail, ${report.totals.warn} warn` : ''}`;
  console.log(line);
  for (const p of problems) console.log(`       ${p}`);
  if (problems.length && !report) console.log(output.split('\n').slice(-12).map((l) => `       | ${l}`).join('\n'));
  if (!problems.length && !values.keep) await rm(path.join(QA_DIR, 'out', run), { recursive: true, force: true });
  return problems.length === 0;
}

const queue = [...chosen];
const results = [];
await Promise.all(
  Array.from({ length: Math.max(1, Math.min(Number(values.jobs) || 1, queue.length)) }, async () => {
    while (queue.length) results.push(await runCase(queue.shift()));
  }),
);
const bad = results.filter((ok) => !ok).length;
console.log(`\nharness self-test: ${results.length - bad} of ${results.length} cases behaved as expected${bad || values.keep ? ' (reports are in qa/out/selftest-<case>/)' : ''}`);
process.exit(bad ? 1 : 0);
