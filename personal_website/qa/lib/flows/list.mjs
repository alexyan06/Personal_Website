// list: full-page screenshot of #/list and a check that every experience entry and project is named.
import { normText, summarize } from '../util.mjs';
import { checkImmediate } from './common.mjs';

const SECTIONS = ['About', 'Experience', 'Projects', 'Skills', 'Learning', 'Misc'];

export async function list(s) {
  const page = await s.fresh('/list');
  const stop = await s.stop(page, 'list', { kind: 'list', expect: { route: '/list' }, fullPage: true });
  await checkImmediate(page, stop);

  const content = s.run.content;
  if (content.problems.length) stop.fail('content-source', content.problems.join('; '));

  const view = stop.facts?.list;
  if (!view || !view.visible) return; // the generic list-view check has already failed

  const text = normText(view.text);
  const missing = [];
  const partial = [];
  const groups = [
    ['experience entry', content.experience],
    ['project', content.projects],
  ];
  for (const [kind, names] of groups) {
    for (const name of names) {
      if (text.includes(normText(name))) continue;
      const brief = name.replace(/\s*\(.*\)\s*$/, '');
      if (brief && brief !== name && text.includes(normText(brief))) partial.push(`${kind} "${name}" appears only as "${brief}"`);
      else missing.push(`${kind} "${name}"`);
    }
  }
  const total = content.experience.length + content.projects.length;
  if (missing.length) stop.fail('list-names', `the list view does not name: ${summarize(missing, 8)}`, missing);
  else if (partial.length) stop.warn('list-names', summarize(partial), partial);
  else if (total) stop.pass('list-names', `all ${content.experience.length} experience entries and ${content.projects.length} projects from ${content.file} are named`);

  // Real headings, in reading order.
  if (!view.headings.length) stop.fail('list-headings', 'the list view has no headings (h1 to h6)');
  else {
    const at = SECTIONS.map((section) => view.headings.findIndex((h) => normText(h.text).includes(section.toLowerCase())));
    const absent = SECTIONS.filter((_, i) => at[i] === -1);
    const found = at.filter((i) => i !== -1);
    const ordered = found.every((v, i) => i === 0 || v > found[i - 1]);
    const problems = [];
    if (absent.length) problems.push(`no heading for ${absent.join(', ')} (headings are: ${summarize(view.headings.map((h) => h.text), 10)})`);
    if (!ordered) problems.push(`the sections are not in the order ${SECTIONS.join(', ')}`);
    if (problems.length) stop.warn('list-headings', problems.join('; '));
    else stop.pass('list-headings', `headings for ${SECTIONS.join(', ')} in reading order`);
  }

  const home = view.links.some((l) => /#\/world$/.test(l.href || ''));
  stop.expect('list-world-link', home, 'the list links back to the world', 'the list view has no link back to the world (#/world)');
}
