// Writes report.json (for tools) and report.md (for people) into the run folder.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PROFILES } from './config.mjs';

export function countChecks(stops) {
  const totals = { pass: 0, fail: 0, warn: 0 };
  for (const stop of stops) for (const check of stop.checks) totals[check.status] = (totals[check.status] ?? 0) + 1;
  return totals;
}

const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const short = (text, n = 420) => {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};
const duration = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
};

export function buildJson(run) {
  // Profiles can run side by side; keep each profile's stops together, in the order they happened.
  const rank = (stop) => (stop.profile === 'run' ? -1 : run.report.profiles.findIndex((p) => p.name === stop.profile));
  const stops = run.report.stops.map((stop, i) => [stop, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([stop]) => stop);
  const totals = countChecks(stops);
  const profiles = run.report.profiles.map((p) => {
    const mine = stops.filter((stop) => stop.profile === p.name);
    return { ...p, stops: mine.length, totals: countChecks(mine) };
  });
  return {
    run: run.name,
    result: run.report.interrupted ? 'interrupted' : totals.fail ? 'fail' : 'pass',
    complete: !!run.report.finishedAt,
    interrupted: run.report.interrupted ?? null,
    startedAt: run.report.startedAt,
    finishedAt: run.report.finishedAt ?? null,
    durationMs: run.report.finishedAt ? new Date(run.report.finishedAt) - new Date(run.report.startedAt) : null,
    command: run.report.command,
    mode: run.report.mode,
    base: run.base,
    server: run.report.server,
    runDir: run.dir,
    totals: { ...totals, stops: stops.length },
    notes: run.report.notes,
    profiles,
    stops,
  };
}

function problemSection(lines, title, stops, status) {
  const hit = stops.filter((stop) => stop.checks.some((c) => c.status === status));
  const count = hit.reduce((n, stop) => n + stop.checks.filter((c) => c.status === status).length, 0);
  lines.push(`## ${title} (${count})`, '');
  if (!count) {
    lines.push('None.', '');
    return;
  }
  let profile = null;
  for (const stop of hit) {
    if (stop.profile !== profile) {
      profile = stop.profile;
      lines.push(`### ${profile}`, '');
    }
    lines.push(`**${stop.id}**${stop.screenshot ? ` · \`${stop.screenshot}\`` : ' · no screenshot'}`, '');
    for (const check of stop.checks.filter((c) => c.status === status)) lines.push(`- \`${check.id}\`: ${short(check.message)}`);
    lines.push('');
  }
}

export function buildMarkdown(json) {
  const { totals } = json;
  const lines = [];
  const verdict = json.result === 'interrupted' ? 'INTERRUPTED' : totals.fail ? 'FAIL' : 'PASS';
  lines.push(`# QA report: ${json.run}`, '');
  lines.push(`Result: **${verdict}**: ${totals.fail} failed, ${totals.warn} warnings, ${totals.pass} passed, at ${totals.stops} stops.`, '');
  lines.push(`- Site: ${json.base ?? 'not started'} (${json.mode})`);
  if (json.server?.commands?.length) lines.push(`- Server: ${json.server.commands.map((c) => `\`${c}\``).join(', then ')}`);
  lines.push(`- Command: \`${json.command}\``);
  lines.push(`- Started ${json.startedAt}${json.durationMs !== null ? `, took ${duration(json.durationMs)}` : ''}`);
  lines.push(`- Folder: \`${json.runDir}\` (screenshot paths below are relative to it)`);
  if (json.interrupted) lines.push(`- The run was interrupted (${json.interrupted}); what follows is what it got to.`);
  lines.push('');
  if (json.notes.length) {
    lines.push('## Notes', '');
    for (const note of json.notes) lines.push(`- ${note}`);
    lines.push('');
  }

  lines.push('## Summary', '');
  lines.push('| Profile | Viewport | Flows | Stops | Pass | Warn | Fail |', '|---|---|---|---:|---:|---:|---:|');
  for (const p of json.profiles) {
    const view = `${p.width}x${p.height} @${p.dpr}x${p.touch ? ' touch' : ''}${p.reducedMotion ? ' reduced motion' : ''}`;
    lines.push(`| ${p.name} | ${view} | ${p.flows.join(', ') || 'none'} | ${p.stops} | ${p.totals.pass} | ${p.totals.warn} | ${p.totals.fail} |`);
  }
  const other = json.stops.filter((stop) => !json.profiles.some((p) => p.name === stop.profile));
  if (other.length) {
    const t = countChecks(other);
    lines.push(`| (run setup) | | | ${other.length} | ${t.pass} | ${t.warn} | ${t.fail} |`);
  }
  lines.push('');

  lines.push('| Profile | Flow | Stops | Pass | Warn | Fail |', '|---|---|---:|---:|---:|---:|');
  const seen = new Map();
  for (const stop of json.stops) {
    const key = `${stop.profile} | ${stop.flow}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(stop);
  }
  for (const [key, stops] of seen) {
    const t = countChecks(stops);
    lines.push(`| ${key} | ${stops.length} | ${t.pass} | ${t.warn} | ${t.fail} |`);
  }
  lines.push('');

  // The same problem at many stops is usually one bug: list those first.
  const groups = new Map();
  for (const stop of json.stops) {
    for (const check of stop.checks) {
      if (check.status === 'pass') continue;
      const key = `${check.status}|${check.id}|${check.message.replace(/\d+(\.\d+)?/g, '#')}`;
      if (!groups.has(key)) groups.set(key, { check, first: stop, count: 0 });
      groups.get(key).count++;
    }
  }
  const repeated = [...groups.values()].filter((g) => g.count > 1).sort((a, b) => (a.check.status === b.check.status ? b.count - a.count : a.check.status === 'fail' ? -1 : 1));
  if (repeated.length) {
    lines.push('## Repeated problems', '', 'The same check with the same message at more than one stop. Fixing one of these usually clears many lines below.', '');
    lines.push('| Times | Status | Check | Message | First seen at |', '|---:|---|---|---|---|');
    for (const g of repeated.slice(0, 40)) lines.push(`| ${g.count} | ${g.check.status} | \`${g.check.id}\` | ${cell(short(g.check.message, 260))} | ${g.first.id} |`);
    if (repeated.length > 40) lines.push('', `And ${repeated.length - 40} more repeated problems; see the sections below.`);
    lines.push('');
  }

  problemSection(lines, 'Failures', json.stops, 'fail');
  problemSection(lines, 'Warnings', json.stops, 'warn');

  const films = json.stops.filter((stop) => stop.film);
  if (films.length) {
    lines.push('## Film strips', '', 'Frames taken over the first second after the trigger. Open the contact sheet to judge the motion.', '');
    lines.push('| Arriving at | Contact sheet | Frames (ms after the trigger) | Stage said "running" for | Largest scale seen |', '|---|---|---|---|---|');
    for (const stop of films) {
      const f = stop.film;
      lines.push(`| ${stop.id} | ${f.sheet ? `\`${f.sheet}\`` : 'none'} | ${f.frames.map((fr) => fr.t).join(', ')} | ${f.runningMs === null ? 'never' : `${f.runningMs} ms`} | ${f.largestScale}x |`);
    }
    lines.push('');
  }

  lines.push('## All stops', '', '| Stop | Pass | Warn | Fail | Screenshot |', '|---|---:|---:|---:|---|');
  for (const stop of json.stops) {
    const t = countChecks([stop]);
    const shots = [stop.screenshot, stop.fullPage, ...(stop.extraShots ?? [])].filter(Boolean).map((s) => `\`${s}\``).join(' ');
    lines.push(`| ${stop.id} | ${t.pass} | ${t.warn} | ${t.fail} | ${shots} |`);
  }
  lines.push('');
  return lines.join('\n');
}

export async function writeReports(run) {
  const json = buildJson(run);
  const jsonPath = path.join(run.dir, 'report.json');
  const mdPath = path.join(run.dir, 'report.md');
  await writeFile(jsonPath, `${JSON.stringify(json, null, 2)}\n`);
  await writeFile(mdPath, buildMarkdown(json));
  return { json, jsonPath, mdPath };
}

export function profileEntry(name, flows, env = null) {
  const p = PROFILES[name];
  return { name, width: p.width, height: p.height, dpr: p.dpr, touch: !!p.touch, reducedMotion: !!p.reducedMotion, flows, env };
}
